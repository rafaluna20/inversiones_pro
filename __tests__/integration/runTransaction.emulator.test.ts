/**
 * @jest-environment node
 */

/**
 * Tests de INTEGRACIÓN contra el emulador real de Firestore (no mocks).
 *
 * El objetivo específico de este archivo: probar que las transacciones del
 * retiro hacia la billetera REALMENTE previenen condiciones de carrera bajo
 * llamadas concurrentes — algo que un test unitario con mocks no puede
 * demostrar, porque un mock no reproduce el comportamiento de reintento/
 * aislamiento de Firestore ante contención real.
 *
 * (Los tests de carrera de restarSaldo/sumarSaldo/restarSaldoGanancia/
 * acreditarDesdeBilletera se retiraron junto con esas funciones: escribían
 * `usuarios.saldo` desde el navegador y ya no existen. Sus equivalentes de
 * servidor están en plataforma-saldo.emulator.test.ts.)
 *
 * Requiere el emulador corriendo: `npm run test:emulator` (lo levanta y
 * apaga automáticamente vía `firebase emulators:exec`).
 */

import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { descontarParaRetiro } from '@/Validacion/retirarHaciaBilletera';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'Este test requiere el emulador de Firestore. Usa `npm run test:emulator`, ' +
      'no `npm test` directamente.'
  );
}

async function crearUsuario(uid: string, saldo: number) {
  await setDoc(doc(db, 'usuarios', uid), { saldo });
}

async function leerSaldo(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.data()?.saldo ?? null;
}

describe('Condiciones de carrera reales (emulador de Firestore)', () => {
  afterAll(async () => {
    // Cierra la conexión gRPC del SDK cliente para que Jest pueda salir
    // limpio (si no, queda un handle abierto y Jest avisa "did not exit").
    await terminate(db);
  });

  test('descontarParaRetiro: dos retiros concurrentes que exceden el saldo — solo uno debe tener éxito', async () => {
    const uid = `race-retiro-${Date.now()}`;
    await crearUsuario(uid, 100);

    const [r1, r2] = await Promise.all([
      descontarParaRetiro(uid, 80, `WTH-A-${Date.now()}`),
      descontarParaRetiro(uid, 80, `WTH-B-${Date.now()}`),
    ]);

    const exitosos = [r1, r2].filter((r) => r.success);
    expect(exitosos).toHaveLength(1);

    const saldoFinal = await leerSaldo(uid);
    expect(saldoFinal).toBe(20); // 100 - 80, nunca negativo.
    expect(saldoFinal).toBeGreaterThanOrEqual(0);
  });

  test('descontarParaRetiro: la misma transactionId llamada dos veces no descuenta dos veces (idempotencia)', async () => {
    const uid = `race-retiro-idem-${Date.now()}`;
    await crearUsuario(uid, 100);
    const txId = `WTH-IDEM-${Date.now()}`;

    const [r1, r2] = await Promise.all([
      descontarParaRetiro(uid, 30, txId),
      descontarParaRetiro(uid, 30, txId),
    ]);

    expect([r1, r2].filter((r) => r.success)).toHaveLength(1);
    expect(await leerSaldo(uid)).toBe(70);
  });
});
