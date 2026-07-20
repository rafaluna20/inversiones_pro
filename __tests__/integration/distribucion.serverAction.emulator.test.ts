/**
 * @jest-environment node
 */

/**
 * Test de integración de extremo a extremo para ejecutarDistribucionAction
 * (app/actions/distribucion.ts) tras migrarla a Admin SDK + verificación de
 * ID token real — mismo patrón que
 * __tests__/integration/inversion.serverAction.emulator.test.ts.
 *
 * A diferencia de withdrawFromPlatformAction (app/actions/wallet.ts), esta
 * acción no depende de next/headers ni de un servidor Odoo externo — solo
 * de Firestore + Auth, así que sí se puede probar de punta a punta acá.
 *
 * Requiere el emulador de Firestore + Auth: `npm run test:emulator`.
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, addDoc, collection, terminate } from 'firebase/firestore';
import { ejecutarDistribucionAction } from '@/app/actions/distribucion';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Este test requiere los emuladores de Firestore Y Auth. Usa `npm run test:emulator`.');
}

async function crearUsuarioDeAuth(email: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-verificacion-123');
  const idToken = await cred.user.getIdToken();
  return { uid: cred.user.uid, idToken };
}

describe('ejecutarDistribucionAction con Admin SDK (extremo a extremo, emulador)', () => {
  afterAll(async () => {
    await terminate(db);
  });

  test('el gestor real liquida el proyecto: crea distribución inmutable, marca el proyecto y actualiza cada inversión', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-${Date.now()}@test.com`);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      gestorId: gestor.uid,
      comisionGestor: 10,
      distribucionEjecutada: false,
    });

    const inv1 = await addDoc(collection(db, 'inversiones'), {
      proyectoId,
      usuarioId: 'socio-a',
      montoInvertido: 30000,
      confirmada: true,
    });
    await addDoc(collection(db, 'inversiones'), {
      proyectoId,
      usuarioId: 'socio-b',
      montoInvertido: 10000,
      confirmada: true,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 100000, gestor.idToken);

    expect(resultado.ok).toBe(true);
    expect(resultado.feeGestor).toBe(10000); // 10% de 100000
    expect(resultado.poolSocios).toBe(90000);
    expect(resultado.socioBeneficiados).toBe(2);

    // El proyecto queda marcado como liquidado
    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    expect(proyectoSnap.data()?.distribucionEjecutada).toBe(true);
    expect(proyectoSnap.data()?.estado).toBe(false);

    // La inversión del socio A (75% del capital) refleja su ganancia real
    const inv1Snap = await getDoc(doc(db, 'inversiones', inv1.id));
    expect(inv1Snap.data()?.gananciaReal).toBe(67500); // 75% de 90000

    // El documento de distribución existe con el hash de auditoría
    expect(resultado.distribucionId).toBeTruthy();
    const distSnap = await getDoc(doc(db, 'distribuciones', resultado.distribucionId!));
    expect(distSnap.exists()).toBe(true);
    expect(typeof distSnap.data()?.hashSHA256).toBe('string');
    expect(distSnap.data()?.hashSHA256.length).toBe(64); // SHA-256 en hex
  });

  test('rechaza a alguien que no es el gestor del proyecto', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor2-${Date.now()}@test.com`);
    const intruso = await crearUsuarioDeAuth(`intruso-${Date.now()}@test.com`);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      gestorId: gestor.uid,
      comisionGestor: 10,
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 100000, intruso.idToken);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/autorización/i);
  });

  test('rechaza liquidar el mismo proyecto dos veces (idempotencia)', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor3-${Date.now()}@test.com`);

    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      gestorId: gestor.uid,
      comisionGestor: 10,
      distribucionEjecutada: false,
    });
    await addDoc(collection(db, 'inversiones'), {
      proyectoId,
      usuarioId: 'socio-a',
      montoInvertido: 10000,
      confirmada: true,
    });

    const primero = await ejecutarDistribucionAction(proyectoId, 50000, gestor.idToken);
    expect(primero.ok).toBe(true);

    const segundo = await ejecutarDistribucionAction(proyectoId, 50000, gestor.idToken);
    expect(segundo.ok).toBe(false);
    expect(segundo.mensaje).toMatch(/ya fue liquidado/i);
  });

  test('rechaza un ID token inválido sin tocar el proyecto', async () => {
    const proyectoId = `proj-dist-${Date.now()}`;
    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto de prueba',
      gestorId: 'quien-sea',
      comisionGestor: 10,
      distribucionEjecutada: false,
    });

    const resultado = await ejecutarDistribucionAction(proyectoId, 50000, 'token-falso');
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/sesión/i);

    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    expect(proyectoSnap.data()?.distribucionEjecutada).toBe(false);
  });
});
