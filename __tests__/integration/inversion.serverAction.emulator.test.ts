/**
 * @jest-environment node
 */

/**
 * Test de INTEGRACIÓN de extremo a extremo para la migración a Admin SDK
 * (hallazgo crítico #1 de la auditoría).
 *
 * A diferencia de runTransaction.emulator.test.ts (que prueba las
 * Validacion/*.ts que corren en el cliente), esto prueba el camino nuevo:
 * un usuario real se autentica contra el emulador de Firebase Auth, obtiene
 * un ID token real, y ese token se verifica del lado servidor con Admin SDK
 * (lib/firebase/admin.ts) antes de ejecutar la transacción — exactamente
 * el flujo que corre app/productos/[id]/page.tsx contra
 * app/actions/inversion.ts en producción.
 *
 * También prueba que un token de OTRO usuario no puede hacerse pasar por el
 * dueño de una inversión (la identidad ya no depende de un `usuarioId` que
 * el cliente podría enviar falsificado).
 *
 * Requiere el emulador de Firestore + Auth corriendo: `npm run test:emulator`.
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import {
  invertirEnProyectoAction,
  eliminarInversionAction,
} from '@/app/actions/inversion';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error(
    'Este test requiere los emuladores de Firestore Y Auth. Usa `npm run test:emulator`.'
  );
}

async function crearUsuarioDeAuth(email: string): Promise<{ uid: string; idToken: string }> {
  const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-123');
  const idToken = await cred.user.getIdToken();
  return { uid: cred.user.uid, idToken };
}

async function crearProducto(id: string, precio: number, creadorId: string) {
  await setDoc(doc(db, 'productos', id), {
    precio,
    creador: { id: creadorId },
    inversores: [],
  });
}

async function crearPerfilUsuario(uid: string, saldo: number) {
  await setDoc(doc(db, 'usuarios', uid), { saldo });
}

async function leerProducto(id: string) {
  const snap = await getDoc(doc(db, 'productos', id));
  return snap.data();
}

async function leerSaldo(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.data()?.saldo ?? null;
}

describe('Server actions de inversión con Admin SDK (extremo a extremo, emulador)', () => {
  afterAll(async () => {
    await terminate(db);
  });

  test('invertirEnProyectoAction: usuario real autenticado invierte y el server action descuenta su saldo', async () => {
    const proyectoId = `proj-${Date.now()}`;
    const { uid: creadorId } = await crearUsuarioDeAuth(`creador-${Date.now()}@test.com`);
    const { uid: inversorId, idToken } = await crearUsuarioDeAuth(`inversor-${Date.now()}@test.com`);

    await crearProducto(proyectoId, 10000, creadorId);
    await crearPerfilUsuario(inversorId, 5000);
    await crearPerfilUsuario(creadorId, 0);

    const resultado = await invertirEnProyectoAction(
      idToken,
      proyectoId,
      { descripcion: 'Test', cubos: 10, categoria: 'Inversor' },
      false
    );

    expect(resultado.ok).toBe(true);

    // costoTotal = 10 cubos * (10000/100) = 1000
    const saldoInversor = await leerSaldo(inversorId);
    expect(saldoInversor).toBe(4000); // 5000 - 1000

    const producto = await leerProducto(proyectoId);
    expect(producto?.inversores).toHaveLength(1);
    expect(producto?.inversores[0].usuarioId).toBe(inversorId);
    expect(producto?.inversores[0].cubos).toBe(10);
  });

  test('rechaza un ID token inválido/falso sin tocar Firestore', async () => {
    const proyectoId = `proj-${Date.now()}`;
    const { uid: creadorId } = await crearUsuarioDeAuth(`creador2-${Date.now()}@test.com`);
    await crearProducto(proyectoId, 10000, creadorId);

    const resultado = await invertirEnProyectoAction(
      'esto-no-es-un-token-valido',
      proyectoId,
      { descripcion: 'Test', cubos: 10, categoria: 'Inversor' },
      false
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/sesión/i);

    const producto = await leerProducto(proyectoId);
    expect(producto?.inversores).toHaveLength(0);
  });

  test('la identidad viene del token verificado, no de nada que envíe el cliente: dos inversores concurrentes no se pisan', async () => {
    const proyectoId = `proj-${Date.now()}`;
    const { uid: creadorId } = await crearUsuarioDeAuth(`creador3-${Date.now()}@test.com`);
    const a = await crearUsuarioDeAuth(`inv-a-${Date.now()}@test.com`);
    const b = await crearUsuarioDeAuth(`inv-b-${Date.now()}@test.com`);

    await crearProducto(proyectoId, 10000, creadorId);
    await crearPerfilUsuario(a.uid, 5000);
    await crearPerfilUsuario(b.uid, 5000);
    await crearPerfilUsuario(creadorId, 0);

    const [r1, r2] = await Promise.all([
      invertirEnProyectoAction(a.idToken, proyectoId, { descripcion: 'A', cubos: 10, categoria: 'Inversor' }, false),
      invertirEnProyectoAction(b.idToken, proyectoId, { descripcion: 'B', cubos: 20, categoria: 'Inversor' }, false),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    // Ambas inversiones deben quedar registradas — ninguna se pisó con la otra.
    const producto = await leerProducto(proyectoId);
    expect(producto?.inversores).toHaveLength(2);
    const uids = producto?.inversores.map((inv: any) => inv.usuarioId).sort();
    expect(uids).toEqual([a.uid, b.uid].sort());

    expect(await leerSaldo(a.uid)).toBe(4000); // 5000 - (10 * 100)
    expect(await leerSaldo(b.uid)).toBe(3000); // 5000 - (20 * 100)
  });

  test('eliminarInversionAction: solo el dueño verificado puede eliminar su propia inversión', async () => {
    const proyectoId = `proj-${Date.now()}`;
    const { uid: creadorId } = await crearUsuarioDeAuth(`creador4-${Date.now()}@test.com`);
    const { uid: inversorId, idToken } = await crearUsuarioDeAuth(`inversor4-${Date.now()}@test.com`);
    const { idToken: otroToken } = await crearUsuarioDeAuth(`otro4-${Date.now()}@test.com`);

    await crearProducto(proyectoId, 10000, creadorId);
    await crearPerfilUsuario(inversorId, 5000);
    await crearPerfilUsuario(creadorId, 0);

    await invertirEnProyectoAction(idToken, proyectoId, { descripcion: 'T', cubos: 10, categoria: 'Inversor' }, false);
    expect(await leerSaldo(inversorId)).toBe(4000);

    // Otro usuario autenticado (token válido, pero no es el dueño de la
    // inversión) no puede eliminar la inversión ajena.
    const intentoAjeno = await eliminarInversionAction(otroToken, proyectoId);
    expect(intentoAjeno.ok).toBe(false);
    expect(await leerSaldo(inversorId)).toBe(4000); // sin cambios

    // El dueño real sí puede.
    const resultado = await eliminarInversionAction(idToken, proyectoId);
    expect(resultado.ok).toBe(true);
    expect(await leerSaldo(inversorId)).toBe(5000); // devuelto

    const producto = await leerProducto(proyectoId);
    expect(producto?.inversores).toHaveLength(0);
  });
});
