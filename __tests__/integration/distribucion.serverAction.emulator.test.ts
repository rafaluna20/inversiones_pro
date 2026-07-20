/**
 * @jest-environment node
 */

/**
 * Test de integración de extremo a extremo para ejecutarDistribucionAction
 * (app/actions/distribucion.ts) v3 — modelo real (producto.inversores[]) y
 * movimiento de saldo de verdad, no solo el documento de auditoría.
 *
 * Reemplaza la versión anterior de este archivo, que probaba contra la
 * colección `inversiones` del modelo bifásico — se confirmó contra
 * producción real (scripts/verificarModeloInversion.ts) que esa colección
 * está vacía y ningún proyecto real la usa.
 *
 * Requiere el emulador de Firestore + Auth: `npm run test:emulator`.
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import { ejecutarDistribucionAction } from '@/app/actions/distribucion';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Este test requiere los emuladores de Firestore Y Auth. Usa `npm run test:emulator`.');
}

async function crearUsuarioDeAuth(email: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-verificacion-123');
  const idToken = await cred.user.getIdToken();
  return { uid: cred.user.uid, idToken };
}

async function crearPerfilUsuario(uid: string, saldo: number) {
  await setDoc(doc(db, 'usuarios', uid), { saldo });
}

async function leerSaldo(uid: string): Promise<number | undefined> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.data()?.saldo;
}

describe('ejecutarDistribucionAction v3 (modelo real, extremo a extremo, emulador)', () => {
  afterAll(async () => {
    await terminate(db);
  });

  test('el gestor real liquida el proyecto: paga a los socios, se queda con su comisión, y deja el registro inmutable', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-${Date.now()}@test.com`);
    const socioA = `socio-a-${Date.now()}`;
    const socioB = `socio-b-${Date.now()}`;

    await crearPerfilUsuario(gestor.uid, 95000); // debe cubrir poolSocios (90000)
    await crearPerfilUsuario(socioA, 0);
    await crearPerfilUsuario(socioB, 0);

    // Proyecto real: precio 100000, 75 cubos para socioA, 25 para socioB (100 cubos = 100%)
    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      precio: 100000,
      creador: { id: gestor.uid },
      inversores: [
        { usuarioId: socioA, cubos: 75 },
        { usuarioId: socioB, cubos: 25 },
      ],
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 100000, gestor.idToken);

    expect(resultado.ok).toBe(true);
    expect(resultado.feeGestor).toBe(10000); // 10% de 100000
    expect(resultado.poolSocios).toBe(90000);
    expect(resultado.socioBeneficiados).toBe(2);

    // El gestor pagó poolSocios (90000), no utilidadNeta completa — su
    // comisión (feeGestor = 10000) nunca salió de su saldo. No es socio acá.
    expect(await leerSaldo(gestor.uid)).toBe(95000 - 90000);

    expect(await leerSaldo(socioA)).toBe(67500); // 75% de 90000
    expect(await leerSaldo(socioB)).toBe(22500); // 25% de 90000

    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    expect(proyectoSnap.data()?.distribucionEjecutada).toBe(true);
    expect(proyectoSnap.data()?.estado).toBe(false);

    // El array inversores[] queda con la ganancia real anotada
    const inversorAActualizado = proyectoSnap.data()?.inversores.find((i: any) => i.usuarioId === socioA);
    expect(inversorAActualizado?.gananciaReal).toBe(67500);

    // Documento de distribución inmutable con hash
    expect(resultado.distribucionId).toBeTruthy();
    const distSnap = await getDoc(doc(db, 'distribuciones', resultado.distribucionId!));
    expect(distSnap.exists()).toBe(true);
    expect(distSnap.data()?.hashSHA256).toHaveLength(64);
  });

  test('si el gestor también invirtió en su propio proyecto, su delta se acumula (paga a otros, cobra lo suyo)', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-mixto-${Date.now()}@test.com`);
    const socio = `socio-mixto-${Date.now()}`;

    await crearPerfilUsuario(gestor.uid, 20000);
    await crearPerfilUsuario(socio, 0);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto mixto',
      precio: 10000,
      creador: { id: gestor.uid },
      // El gestor tiene 50 cubos propios, el socio 50.
      inversores: [
        { usuarioId: gestor.uid, cubos: 50 },
        { usuarioId: socio, cubos: 50 },
      ],
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 10000, gestor.idToken);
    expect(resultado.ok).toBe(true);
    // poolSocios = 9000 (10% comisión), 50/50 → 4500 cada uno
    // Gestor: -9000 (paga el pool) + 4500 (su propia parte) = -4500 neto
    expect(await leerSaldo(gestor.uid)).toBe(20000 - 4500);
    expect(await leerSaldo(socio)).toBe(4500);
  });

  test('rechaza a alguien que no es el dueño del proyecto', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor2-${Date.now()}@test.com`);
    const intruso = await crearUsuarioDeAuth(`intruso-${Date.now()}@test.com`);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      precio: 1000,
      creador: { id: gestor.uid },
      inversores: [],
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 1000, intruso.idToken);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/autorización/i);
  });

  test('rechaza liquidar el mismo proyecto dos veces (idempotencia)', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor3-${Date.now()}@test.com`);
    await crearPerfilUsuario(gestor.uid, 10000);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      precio: 1000,
      creador: { id: gestor.uid },
      inversores: [{ usuarioId: 'socio-x', cubos: 100 }],
      distribucionEjecutada: false,
    });
    await crearPerfilUsuario('socio-x', 0);

    const primero = await ejecutarDistribucionAction(proyectoId, 1000, gestor.idToken);
    expect(primero.ok).toBe(true);

    const segundo = await ejecutarDistribucionAction(proyectoId, 1000, gestor.idToken);
    expect(segundo.ok).toBe(false);
    expect(segundo.mensaje).toMatch(/ya fue liquidado/i);
  });

  test('rechaza si la utilidad declarada es menor al capital invertido (protección de capital)', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor4-${Date.now()}@test.com`);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      precio: 100000,
      creador: { id: gestor.uid },
      inversores: [{ usuarioId: 'socio-y', cubos: 100 }],
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 50000, gestor.idToken); // < precio
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/capital invertido/i);
  });

  test('rechaza si el gestor no tiene saldo suficiente para pagar a los socios', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor5-${Date.now()}@test.com`);
    await crearPerfilUsuario(gestor.uid, 100); // insuficiente
    await crearPerfilUsuario('socio-z', 0);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      precio: 100000,
      creador: { id: gestor.uid },
      inversores: [{ usuarioId: 'socio-z', cubos: 100 }],
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 100000, gestor.idToken);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/saldo insuficiente/i);

    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    expect(proyectoSnap.data()?.distribucionEjecutada).toBe(false);
  });

  test('rechaza un ID token inválido sin tocar el proyecto', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      precio: 1000,
      creador: { id: 'quien-sea' },
      inversores: [],
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 1000, 'token-falso');
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/sesión/i);

    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    expect(proyectoSnap.data()?.distribucionEjecutada).toBe(false);
  });
});
