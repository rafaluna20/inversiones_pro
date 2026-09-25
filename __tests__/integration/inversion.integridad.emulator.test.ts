/**
 * @jest-environment node
 */

/**
 * Integridad del dinero en app/actions/inversion.ts (modelo legado con
 * `producto.inversores[]`), extremo a extremo contra los emuladores.
 *
 * Cubre los huecos reales que se corrigieron:
 *  - eliminar la inversión después de que el creador depositó lo recaudado
 *    devolvía el dinero al inversor sin descontárselo a nadie (dinero creado);
 *  - invertir después de ese depósito dejaba el dinero atrapado;
 *  - `aportarGanancia` (crear saldo de la nada) lo podía usar cualquier creador;
 *  - la liquidación redondeaba cada parte por separado (descuadre de céntimos).
 *
 * Requiere los emuladores: `npm run test:emulator`.
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import {
  depositarRecaudadoAction,
  distribuirGananciaLegacyAction,
  eliminarInversionAction,
  invertirEnProyectoAction,
} from '@/app/actions/inversion';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Este test requiere los emuladores de Firestore Y Auth. Usa `npm run test:emulator`.');
}

afterAll(async () => {
  await terminate(db);
});

beforeEach(() => {
  delete process.env.PLATAFORMA_MODO_DEMO;
});

const unico = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function crearUsuarioAuth(prefijo: string, saldo: number, extra: Record<string, unknown> = {}) {
  const email = `${unico(prefijo)}@test.com`;
  const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-123');
  const idToken = await cred.user.getIdToken();
  await setDoc(doc(db, 'usuarios', cred.user.uid), { saldo, saldoRecaudado: [], ...extra });
  return { uid: cred.user.uid, idToken };
}
async function crearPerfilSinAuth(uid: string, saldo: number) {
  await setDoc(doc(db, 'usuarios', uid), { saldo, saldoRecaudado: [] });
}
async function crearProducto(id: string, creadorId: string, extra: Record<string, unknown> = {}) {
  await setDoc(doc(db, 'productos', id), {
    precio: 1000,
    creador: { id: creadorId },
    inversores: [],
    estado: true,
    depositoRecaudado: false,
    ...extra,
  });
}
const leer = async (col: string, id: string) => (await getDoc(doc(db, col, id))).data()!;
const saldo = async (uid: string) => (await leer('usuarios', uid)).saldo as number;

describe('eliminar / invertir cuando el proyecto ya no admite cambios', () => {
  test('flujo normal (regresión): invertir y eliminar ANTES del depósito devuelve el dinero y ajusta lo recaudado', async () => {
    const creador = await crearUsuarioAuth('int-creador', 0);
    const inversor = await crearUsuarioAuth('int-inversor', 500);
    const id = unico('proy');
    await crearProducto(id, creador.uid);

    expect((await invertirEnProyectoAction(inversor.idToken, id, { descripcion: 'x', cubos: 50, categoria: 'c' }, false)).ok).toBe(true);
    expect(await saldo(inversor.uid)).toBe(0); // 50 cubos de 1000 = 500
    expect((await leer('usuarios', creador.uid)).saldoRecaudado).toEqual([{ idProducto: id, monto: 500 }]);

    expect((await eliminarInversionAction(inversor.idToken, id)).ok).toBe(true);
    expect(await saldo(inversor.uid)).toBe(500);
    expect((await leer('usuarios', creador.uid)).saldoRecaudado).toEqual([]);
  });

  test('DESPUÉS de que el creador depositó lo recaudado, eliminar la inversión se rechaza (antes creaba dinero)', async () => {
    const creador = await crearUsuarioAuth('dep-creador', 0);
    const inversor = await crearUsuarioAuth('dep-inversor', 500);
    const id = unico('proy');
    await crearProducto(id, creador.uid);
    await invertirEnProyectoAction(inversor.idToken, id, { descripcion: 'x', cubos: 50, categoria: 'c' }, false);
    expect((await depositarRecaudadoAction(creador.idToken, id)).ok).toBe(true);
    expect(await saldo(creador.uid)).toBe(500);

    const r = await eliminarInversionAction(inversor.idToken, id);

    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('ya retiró los fondos');
    expect(await saldo(inversor.uid)).toBe(0); // NO recibió los 500 de vuelta
    expect((await leer('productos', id)).inversores).toHaveLength(1);
    // Conservación: el total del sistema sigue siendo 500.
    expect((await saldo(inversor.uid)) + (await saldo(creador.uid))).toBe(500);
  });

  test('DESPUÉS del depósito, invertir (o editar) se rechaza: el dinero no queda atrapado en saldoRecaudado', async () => {
    const creador = await crearUsuarioAuth('atr-creador', 0);
    const inversor = await crearUsuarioAuth('atr-inversor', 500);
    const nuevo = await crearUsuarioAuth('atr-nuevo', 300);
    const id = unico('proy');
    await crearProducto(id, creador.uid);
    await invertirEnProyectoAction(inversor.idToken, id, { descripcion: 'x', cubos: 50, categoria: 'c' }, false);
    await depositarRecaudadoAction(creador.idToken, id);

    const r = await invertirEnProyectoAction(nuevo.idToken, id, { descripcion: 'x', cubos: 20, categoria: 'c' }, false);
    const edicion = await invertirEnProyectoAction(inversor.idToken, id, { descripcion: 'x', cubos: 10, categoria: 'c' }, true);

    expect(r.ok).toBe(false);
    expect(edicion.ok).toBe(false);
    expect(await saldo(nuevo.uid)).toBe(300);
    expect((await leer('usuarios', creador.uid)).saldoRecaudado).toEqual([]);
  });

  test('un proyecto ya liquidado (estado=false) no admite invertir ni eliminar', async () => {
    const creador = await crearUsuarioAuth('liq-creador', 0);
    const inversor = await crearUsuarioAuth('liq-inversor', 500);
    const id = unico('proy');
    await crearProducto(id, creador.uid, { estado: false, inversores: [{ usuarioId: inversor.uid, cubos: 10 }] });

    expect((await invertirEnProyectoAction(inversor.idToken, id, { descripcion: 'x', cubos: 5, categoria: 'c' }, false)).ok).toBe(false);
    expect((await eliminarInversionAction(inversor.idToken, id)).ok).toBe(false);
    expect(await saldo(inversor.uid)).toBe(500);
  });
});

describe('distribuirGananciaLegacyAction', () => {
  async function proyectoConSocios(creadorUid: string, socios: Array<{ uid: string; cubos: number }>, precio = 300) {
    const id = unico('dist');
    await crearProducto(id, creadorUid, { precio, inversores: socios.map((s) => ({ usuarioId: s.uid, cubos: s.cubos })) });
    return id;
  }

  test('EXPLOIT cerrado: un creador normal NO puede "aportar ganancia" (crear saldo de la nada) con un proyecto propio y un cómplice', async () => {
    const creador = await crearUsuarioAuth('ex-creador', 1); // solo S/ 1
    const complice = unico('complice');
    await crearPerfilSinAuth(complice, 0);
    const id = await proyectoConSocios(creador.uid, [{ uid: complice, cubos: 100 }], 1);

    const r = await distribuirGananciaLegacyAction(creador.idToken, id, 1_000_000, true);

    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('Solo un administrador');
    expect(await saldo(complice)).toBe(0);
    expect(await saldo(creador.uid)).toBe(1);
    expect((await leer('productos', id)).estado).toBe(true);
  });

  test('con PLATAFORMA_MODO_DEMO=true el aporte de ganancia (simulación de pruebas) sí está permitido', async () => {
    process.env.PLATAFORMA_MODO_DEMO = 'true';
    const creador = await crearUsuarioAuth('demo-creador', 100);
    const socio = unico('demo-socio');
    await crearPerfilSinAuth(socio, 0);
    const id = await proyectoConSocios(creador.uid, [{ uid: socio, cubos: 100 }], 100);

    const r = await distribuirGananciaLegacyAction(creador.idToken, id, 150, true);

    expect(r.ok).toBe(true);
    expect(await saldo(socio)).toBe(150);
    // El creador paga 150 (100 de su saldo + 50 "aportados" de la nada): queda en 0.
    // El sistema pasó de 100 a 150: justo el dinero que el modo demo permite simular.
    expect(await saldo(creador.uid)).toBe(0);
  });

  test('un administrador sí puede aportar la ganancia', async () => {
    const admin = await crearUsuarioAuth('adm-creador', 100, { roles: ['admin'] });
    const socio = unico('adm-socio');
    await crearPerfilSinAuth(socio, 0);
    const id = await proyectoConSocios(admin.uid, [{ uid: socio, cubos: 100 }], 100);

    const r = await distribuirGananciaLegacyAction(admin.idToken, id, 150, true);

    expect(r.ok).toBe(true);
    expect(await saldo(socio)).toBe(150);
  });

  test('sin aportar: el creador paga desde su propio saldo y el dinero total del sistema se CONSERVA', async () => {
    const creador = await crearUsuarioAuth('con-creador', 1000);
    const a = unico('con-a');
    const b = unico('con-b');
    await crearPerfilSinAuth(a, 0);
    await crearPerfilSinAuth(b, 0);
    const id = await proyectoConSocios(creador.uid, [{ uid: a, cubos: 60 }, { uid: b, cubos: 40 }], 500);

    const r = await distribuirGananciaLegacyAction(creador.idToken, id, 700, false);

    expect(r.ok).toBe(true);
    expect(await saldo(a)).toBe(420);
    expect(await saldo(b)).toBe(280);
    expect(await saldo(creador.uid)).toBe(300);
    expect((await saldo(a)) + (await saldo(b)) + (await saldo(creador.uid))).toBe(1000);
  });

  test('sin saldo suficiente no distribuye nada (y no se puede compensar con aportarGanancia siendo un creador normal)', async () => {
    const creador = await crearUsuarioAuth('pobre-creador', 100);
    const a = unico('pobre-a');
    await crearPerfilSinAuth(a, 0);
    const id = await proyectoConSocios(creador.uid, [{ uid: a, cubos: 100 }], 100);

    expect((await distribuirGananciaLegacyAction(creador.idToken, id, 500, false)).ok).toBe(false);
    expect(await saldo(a)).toBe(0);
    expect((await leer('productos', id)).estado).toBe(true);
  });

  test('reparto exacto al céntimo: 100.00 entre tres socios iguales paga 33.34 + 33.33 + 33.33 y nada se crea ni se pierde', async () => {
    const creador = await crearUsuarioAuth('cent-creador', 100);
    const socios = [unico('cent-1'), unico('cent-2'), unico('cent-3')];
    for (const s of socios) await crearPerfilSinAuth(s, 0);
    const id = await proyectoConSocios(creador.uid, socios.map((uid) => ({ uid, cubos: 1 })), 100);

    const r = await distribuirGananciaLegacyAction(creador.idToken, id, 100, false);

    expect(r.ok).toBe(true);
    const pagos = await Promise.all(socios.map(saldo));
    expect(pagos.slice().sort()).toEqual([33.33, 33.33, 33.34]);
    expect(Math.round(pagos.reduce((x, y) => x + y, 0) * 100)).toBe(10000);
    expect(await saldo(creador.uid)).toBe(0);
  });

  test('el creador que también es socio: su parte vuelve a su saldo y el total se conserva', async () => {
    const creador = await crearUsuarioAuth('mix-creador', 1000);
    const otro = unico('mix-otro');
    await crearPerfilSinAuth(otro, 0);
    const id = await proyectoConSocios(creador.uid, [{ uid: creador.uid, cubos: 50 }, { uid: otro, cubos: 50 }], 400);

    const r = await distribuirGananciaLegacyAction(creador.idToken, id, 600, false);

    expect(r.ok).toBe(true);
    expect(await saldo(otro)).toBe(300);
    expect(await saldo(creador.uid)).toBe(700); // 1000 - 600 + 300
    expect((await saldo(otro)) + (await saldo(creador.uid))).toBe(1000);
  });

  test.each([
    ['NaN', NaN],
    ['cero', 0],
    ['negativo', -100],
    ['Infinity', Infinity],
    ['más de 2 decimales', 100.005],
  ])('ganancia total inválida (%s) se rechaza', async (_n, monto) => {
    const creador = await crearUsuarioAuth('val-creador', 1000);
    const a = unico('val-a');
    await crearPerfilSinAuth(a, 0);
    const id = await proyectoConSocios(creador.uid, [{ uid: a, cubos: 100 }], 100);

    const r = await distribuirGananciaLegacyAction(creador.idToken, id, monto as number, false);

    expect(r.ok).toBe(false);
    expect(await saldo(a)).toBe(0);
    expect(await saldo(creador.uid)).toBe(1000);
  });

  test('solo el creador del proyecto puede liquidar', async () => {
    const creador = await crearUsuarioAuth('own-creador', 1000);
    const intruso = await crearUsuarioAuth('own-intruso', 1000);
    const a = unico('own-a');
    await crearPerfilSinAuth(a, 0);
    const id = await proyectoConSocios(creador.uid, [{ uid: a, cubos: 100 }], 100);

    const r = await distribuirGananciaLegacyAction(intruso.idToken, id, 100, false);

    expect(r.ok).toBe(false);
    expect(await saldo(a)).toBe(0);
    expect(await saldo(intruso.uid)).toBe(1000);
  });
});
