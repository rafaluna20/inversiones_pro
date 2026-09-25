/**
 * @jest-environment node
 */

/**
 * Prueba firestore.rules DE VERDAD contra el emulador de Firestore, usando
 * @firebase/rules-unit-testing (la herramienta hecha específicamente para
 * esto — no el SDK cliente normal). Objetivo concreto: demostrar que el
 * agujero real encontrado en producción (cualquier usuario autenticado
 * puede escribir el documento de cualquier otro) queda cerrado, y que las
 * funciones que SÍ deben seguir andando (votar, comentar, recargar la
 * propia billetera) no se rompen.
 *
 * Requiere el emulador de Firestore corriendo: `npm run test:emulator`.
 */

import { readFileSync } from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este test requiere el emulador de Firestore. Usa `npm run test:emulator`.');
}

const [host, portStr] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-test-inversiones',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host,
      port: Number(portStr),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup().catch(() => undefined);

  // Este archivo deja las reglas ESTRICTAS (firestore.rules) activas en el
  // emulador compartido. Los otros archivos de __tests__/integration/
  // (runTransaction.emulator.test.ts, inversion.serverAction.emulator.test.ts)
  // asumen el ruleset permisivo de firestore.test.rules — sin restaurarlo acá,
  // fallarían con PERMISSION_DENIED si corren después de este archivo en la
  // misma sesión del emulador (jest.integration.config.js ya fuerza
  // maxWorkers: 1, pero el ORDEN entre archivos no está garantizado).
  const restaurador = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-test-inversiones',
    firestore: {
      rules: readFileSync('firestore.test.rules', 'utf8'),
      host,
      port: Number(portStr),
    },
  });
  await restaurador.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seed(coleccion: string, id: string, datos: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(coleccion).doc(id).set(datos);
  });
}

describe('firestore.rules — usuarios (el agujero real que encontramos en producción)', () => {
  test('un usuario NO puede escribir el saldo de otro usuario', async () => {
    await seed('usuarios', 'bob', { saldo: 100 });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('usuarios').doc('bob').update({ saldo: 999999 }));
  });

  test('un usuario NO puede escribir su propio saldo (el saldo es de solo-servidor)', async () => {
    await seed('usuarios', 'alice', { saldo: 100 });
    // Ojo: un contexto de rules-unit-testing solo admite UNA llamada a .firestore().
    const ref = testEnv.authenticatedContext('alice').firestore().collection('usuarios').doc('alice');
    await assertFails(ref.update({ saldo: 150 }));
    await assertFails(ref.update({ saldo: 1000000 }));
  });

  test('un usuario NO puede escribir su propio saldoRecaudado', async () => {
    await seed('usuarios', 'alice', { saldo: 100, saldoRecaudado: [] });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice.firestore().collection('usuarios').doc('alice').update({ saldoRecaudado: [{ idProducto: 'p', monto: 999999 }] })
    );
  });

  test('ni siquiera un admin puede escribir el saldo desde el cliente', async () => {
    await seed('usuarios', 'admin1', { saldo: 0, roles: ['admin'] });
    await seed('usuarios', 'bob', { saldo: 100 });
    const admin = testEnv.authenticatedContext('admin1');
    await assertFails(admin.firestore().collection('usuarios').doc('bob').update({ saldo: 5000 }));
  });

  test('un usuario SÍ puede seguir editando campos de perfil que no son dinero', async () => {
    await seed('usuarios', 'alice', { saldo: 100, phone: '111' });
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('usuarios').doc('alice').update({ phone: '999' }));
  });

  test('un usuario NO puede crear su perfil con saldoRecaudado no vacío', async () => {
    const carol = testEnv.authenticatedContext('carol');
    await assertFails(
      carol.firestore().collection('usuarios').doc('carol').set({
        saldo: 0,
        saldoRecaudado: [{ idProducto: 'p', monto: 5000 }],
      })
    );
  });

  test('un usuario NO puede autoasignarse el rol admin', async () => {
    await seed('usuarios', 'alice', { saldo: 100, roles: ['usuario'] });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('usuarios').doc('alice').update({ roles: ['admin'] }));
  });

  test('un usuario NO autenticado no puede leer ningún perfil', async () => {
    await seed('usuarios', 'alice', { saldo: 100 });
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().collection('usuarios').doc('alice').get());
  });

  test('un usuario autenticado SÍ puede leer el perfil de otro (ej. teléfono del creador de un proyecto)', async () => {
    await seed('usuarios', 'alice', { saldo: 100, phone: '987654321' });
    const bob = testEnv.authenticatedContext('bob');
    await assertSucceeds(bob.firestore().collection('usuarios').doc('alice').get());
  });

  test('un usuario nuevo SÍ puede crear su perfil al registrarse (shape real de crear-cuenta/page.tsx, sin campo roles)', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(
      alice.firestore().collection('usuarios').doc('alice').set({
        saldo: 0,
        like: 0,
        phone: '987654321',
        departamento: 'Lima',
        provincia: 'Lima',
        distrito: 'San Juan de Miraflores',
        ganancia: 0,
        inversionesCompletadas: 0,
        nombre: 'Alice',
        email: 'alice@test.com',
        photoURL: '',
        votantes: [],
        saldoRecaudado: [],
        createdAt: Date.now(),
      })
    );
  });

  test('un usuario nuevo NO puede autoasignarse un rol distinto de "usuario" al crear su perfil', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice.firestore().collection('usuarios').doc('alice').set({ saldo: 0, roles: ['admin'] })
    );
  });
});

describe('firestore.rules — bookmarks (favoritos)', () => {
  test('el dueño puede leer y escribir sus propios favoritos', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(aliceDb.collection('bookmarks').doc('alice').set({ userId: 'alice', productos: ['p1'] }));
    await assertSucceeds(aliceDb.collection('bookmarks').doc('alice').get());
  });

  test('un usuario NO puede leer ni escribir los favoritos de otro', async () => {
    await seed('bookmarks', 'alice', { userId: 'alice', productos: ['p1'] });
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    await assertFails(bobDb.collection('bookmarks').doc('alice').get());
    await assertFails(bobDb.collection('bookmarks').doc('alice').update({ productos: ['p2'] }));
  });
});

describe('firestore.rules — productos', () => {
  async function seedProducto(id: string, creadorId: string) {
    await seed('productos', id, {
      nombre: 'Test',
      precio: 1000,
      creador: { id: creadorId },
      inversores: [],
      votos: 0,
      haVotado: [],
      comentarios: [],
    });
  }

  test('cualquiera (sin autenticar) puede leer un producto — catálogo público', async () => {
    await seedProducto('p1', 'creador-x');
    const anon = testEnv.unauthenticatedContext();
    await assertSucceeds(anon.firestore().collection('productos').doc('p1').get());
  });

  test('un usuario que no es el dueño SÍ puede votar (solo toca votos/haVotado)', async () => {
    await seedProducto('p1', 'creador-x');
    const bob = testEnv.authenticatedContext('bob');
    await assertSucceeds(bob.firestore().collection('productos').doc('p1').update({ votos: 1, haVotado: ['bob'] }));
  });

  test('un usuario que no es el dueño NO puede cambiar el precio', async () => {
    await seedProducto('p1', 'creador-x');
    const bob = testEnv.authenticatedContext('bob');
    await assertFails(bob.firestore().collection('productos').doc('p1').update({ precio: 1 }));
  });

  test('el dueño SÍ puede cambiar el precio de su propio producto mientras NO haya inversores', async () => {
    await seedProducto('p1', 'creador-x');
    const creador = testEnv.authenticatedContext('creador-x');
    await assertSucceeds(creador.firestore().collection('productos').doc('p1').update({ precio: 5000 }));
  });

  describe('campos monetarios de solo-servidor', () => {
    async function seedConInversores(id: string, creadorId: string) {
      await seed('productos', id, {
        nombre: 'Test',
        precio: 1000,
        comisionGestor: 10,
        creador: { id: creadorId },
        inversores: [{ usuarioId: 'inv1', cubos: 50 }],
        estado: true,
        monto: 0,
        depositoRecaudado: false,
        distribucionEjecutada: false,
        votos: 0,
        haVotado: [],
        comentarios: [],
      });
    }

    test('el dueño NO puede bajar el precio una vez que hay inversores (pagaría menos capital al liquidar)', async () => {
      await seedConInversores('p2', 'creador-x');
      const creador = testEnv.authenticatedContext('creador-x');
      await assertFails(creador.firestore().collection('productos').doc('p2').update({ precio: 1 }));
    });

    test('el dueño NO puede subirse la comisión de gestor una vez que hay inversores', async () => {
      await seedConInversores('p2', 'creador-x');
      const creador = testEnv.authenticatedContext('creador-x');
      await assertFails(creador.firestore().collection('productos').doc('p2').update({ comisionGestor: 20 }));
    });

    test('el dueño NO puede editar la lista de inversores, el estado ni los flags de depósito/liquidación', async () => {
      await seedConInversores('p2', 'creador-x');
      const creador = testEnv.authenticatedContext('creador-x');
      const ref = creador.firestore().collection('productos').doc('p2');
      await assertFails(ref.update({ inversores: [] }));
      await assertFails(ref.update({ estado: false }));
      await assertFails(ref.update({ monto: 999999 }));
      await assertFails(ref.update({ depositoRecaudado: true }));
      await assertFails(ref.update({ distribucionEjecutada: true }));
      await assertFails(ref.update({ creador: { id: 'otro' } }));
    });

    test('el dueño SÍ puede editar datos descriptivos aunque haya inversores (nombre, descripción)', async () => {
      await seedConInversores('p2', 'creador-x');
      const creador = testEnv.authenticatedContext('creador-x');
      await assertSucceeds(
        creador.firestore().collection('productos').doc('p2').update({ nombre: 'Nuevo nombre', descripcion: 'Texto' })
      );
    });

    test('el dueño SÍ puede seguir registrando los totales de gastos (los calcula el cliente)', async () => {
      await seedConInversores('p2', 'creador-x');
      const creador = testEnv.authenticatedContext('creador-x');
      await assertSucceeds(
        creador.firestore().collection('productos').doc('p2').update({ totalGastos: 100, costoTotalProyecto: 1100, gananciaNeta: -100 })
      );
    });

    test('un producto NO puede crearse con inversores inventados ni ya liquidado', async () => {
      const creador = testEnv.authenticatedContext('creador-x');
      const col = creador.firestore().collection('productos');
      await assertFails(col.doc('nuevo1').set({ nombre: 'X', creador: { id: 'creador-x' }, inversores: [{ usuarioId: 'complice', cubos: 100 }] }));
      await assertFails(col.doc('nuevo2').set({ nombre: 'X', creador: { id: 'creador-x' }, inversores: [], estado: false }));
      await assertFails(col.doc('nuevo3').set({ nombre: 'X', creador: { id: 'creador-x' }, inversores: [], monto: 500 }));
      await assertSucceeds(col.doc('nuevo4').set({ nombre: 'X', creador: { id: 'creador-x' }, inversores: [], estado: true, monto: 0, depositoRecaudado: false }));
    });
  });

  describe('gastos (subcolección real de productos/{id}/gastos, no colección de nivel superior)', () => {
    async function seedGasto(proyectoId: string, gastoId: string) {
      await seed(`productos/${proyectoId}/gastos`, gastoId, {
        concepto: 'Notaría',
        categoria: 'notaria',
        monto: 500,
        proyectoId,
      });
    }

    test('cualquier usuario autenticado (ej. el gestor viendo su propio proyecto) puede leer los gastos', async () => {
      await seedProducto('p1', 'creador-x');
      await seedGasto('p1', 'g1');
      const creador = testEnv.authenticatedContext('creador-x');
      await assertSucceeds(creador.firestore().collection('productos/p1/gastos').doc('g1').get());
    });

    test('el gestor del proyecto SÍ puede agregar un gasto', async () => {
      await seedProducto('p1', 'creador-x');
      const creador = testEnv.authenticatedContext('creador-x');
      await assertSucceeds(
        creador.firestore().collection('productos/p1/gastos').add({ concepto: 'Notaría', monto: 500, proyectoId: 'p1' })
      );
    });

    test('un usuario que no es el gestor NO puede agregar un gasto', async () => {
      await seedProducto('p1', 'creador-x');
      const bob = testEnv.authenticatedContext('bob');
      await assertFails(
        bob.firestore().collection('productos/p1/gastos').add({ concepto: 'Falso', monto: 999999, proyectoId: 'p1' })
      );
    });
  });
});

describe('firestore.rules — inversiones (modelo bifásico, server-only)', () => {
  test('ningún cliente puede crear una inversión directamente, ni siquiera pagándose a sí mismo (solo invertirEnEtapaAction, vía Admin SDK)', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice.firestore().collection('inversiones').add({
        proyectoId: 'p1',
        usuarioId: 'alice',
        confirmada: false,
        gananciaReal: 0,
      })
    );
  });

  test('el dueño de la inversión sí puede leerla', async () => {
    await seed('inversiones', 'inv1', { proyectoId: 'p1', usuarioId: 'alice' });
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('inversiones').doc('inv1').get());
  });
});

describe('firestore.rules — distribuciones (documento "inmutable")', () => {
  test('nadie puede escribir distribuciones desde el cliente, ni siquiera el propio gestor', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('distribuciones').add({ proyectoId: 'p1', gestorId: 'alice' }));
  });
});

describe('firestore.rules — puente Odoo (plataforma_cargas / plataforma_retiros / plataforma_transferencias, solo servidor)', () => {
  test('un usuario NO puede crear registros de carga, ni siquiera a su nombre (solo el servidor)', async () => {
    const cargas = testEnv.authenticatedContext('alice').firestore().collection('plataforma_cargas');
    await assertFails(cargas.doc('tx1').set({ firebase_uid: 'alice', amount_credited: 50 }));
    await assertFails(cargas.doc('tx2').set({ firebase_uid: 'bob', amount_credited: 50 }));
  });

  test('un usuario SÍ puede leer sus propias cargas pero no las de otro', async () => {
    await seed('plataforma_cargas', 'c-alice', { firebase_uid: 'alice', amount_credited: 10 });
    const alice = testEnv.authenticatedContext('alice');
    const bob = testEnv.authenticatedContext('bob');
    await assertSucceeds(alice.firestore().collection('plataforma_cargas').doc('c-alice').get());
    await assertFails(bob.firestore().collection('plataforma_cargas').doc('c-alice').get());
  });

  test('un usuario NO puede modificar el monto de su propio retiro pendiente', async () => {
    await seed('plataforma_retiros', 'WTH-alice-1', { firebase_uid: 'alice', amount: 10, status: 'pending' });
    const retiro = testEnv.authenticatedContext('alice').firestore().collection('plataforma_retiros').doc('WTH-alice-1');
    await assertFails(retiro.update({ amount: 999999 }));
    await assertFails(retiro.update({ status: 'completed' }));
  });

  test('un usuario NO puede crear transferencias ni verlas si no participa en ellas', async () => {
    await seed('plataforma_transferencias', 't1', { origen_uid: 'alice', destino_uid: 'bob', monto: 5 });
    const transferencias = (uid: string) => testEnv.authenticatedContext(uid).firestore().collection('plataforma_transferencias');
    await assertSucceeds(transferencias('alice').doc('t1').get());
    await assertSucceeds(transferencias('bob').doc('t1').get());
    const eve = transferencias('eve');
    await assertFails(eve.doc('t1').get());
    await assertFails(eve.doc('t2').set({ origen_uid: 'eve', destino_uid: 'eve', monto: 1 }));
  });
});
