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
  await testEnv.cleanup();

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

  test('un usuario SÍ puede escribir su propio saldo (recargar billetera sigue funcionando)', async () => {
    await seed('usuarios', 'alice', { saldo: 100 });
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('usuarios').doc('alice').update({ saldo: 150 }));
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

  test('el dueño SÍ puede cambiar el precio de su propio producto', async () => {
    await seedProducto('p1', 'creador-x');
    const creador = testEnv.authenticatedContext('creador-x');
    await assertSucceeds(creador.firestore().collection('productos').doc('p1').update({ precio: 5000 }));
  });
});

describe('firestore.rules — distribuciones (documento "inmutable")', () => {
  test('nadie puede escribir distribuciones desde el cliente, ni siquiera el propio gestor', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('distribuciones').add({ proyectoId: 'p1', gestorId: 'alice' }));
  });
});

describe('firestore.rules — puente Odoo (plataforma_cargas)', () => {
  test('un usuario puede crear su propio registro de carga', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(
      alice.firestore().collection('plataforma_cargas').doc('tx1').set({ firebase_uid: 'alice', amount_credited: 50 })
    );
  });

  test('un usuario NO puede crear un registro de carga a nombre de otro', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice.firestore().collection('plataforma_cargas').doc('tx2').set({ firebase_uid: 'bob', amount_credited: 50 })
    );
  });
});
