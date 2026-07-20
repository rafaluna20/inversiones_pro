/**
 * @jest-environment node
 */

/**
 * Tests de INTEGRACIÓN contra el emulador real de Firestore (no mocks).
 *
 * El objetivo específico de este archivo: probar que las `runTransaction`
 * agregadas en esta sesión (ver auditoría, hallazgos críticos #2 y #3)
 * REALMENTE previenen condiciones de carrera bajo llamadas concurrentes —
 * algo que un test unitario con mocks no puede demostrar, porque un mock no
 * reproduce el comportamiento de reintento/aislamiento de Firestore ante
 * contención real.
 *
 * Requiere el emulador corriendo: `npm run test:emulator` (lo levanta y
 * apaga automáticamente vía `firebase emulators:exec`).
 */

import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import restarSaldo from '@/Validacion/restarSaldo';
import sumarSaldo from '@/Validacion/sumarSaldo';
import restarSaldoGanancia from '@/Validacion/restarSaldoGanancia';
import acreditarDesdeBilletera from '@/Validacion/acreditarDesdeBilletera';
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


  test('restarSaldo: dos descuentos concurrentes que exceden el saldo — solo uno debe tener éxito', async () => {
    const uid = `race-restar-${Date.now()}`;
    await crearUsuario(uid, 100);

    // Dos intentos concurrentes de restar 60 sobre un saldo de 100: juntos
    // exceden el saldo, así que exactamente uno debe fallar.
    const [r1, r2] = await Promise.all([
      restarSaldo(uid, 'creador-x', 60),
      restarSaldo(uid, 'creador-x', 60),
    ]);

    const resultados = [r1, r2];
    const exitosos = resultados.filter((r) => r === null);
    const fallidos = resultados.filter((r) => r !== null);

    expect(exitosos).toHaveLength(1);
    expect(fallidos).toHaveLength(1);
    expect(fallidos[0]).toBe('Saldo insuficiente');

    // El saldo final NUNCA debe ser negativo, y debe reflejar exactamente
    // una resta aplicada (100 - 60 = 40) — no ambas (-20) ni ninguna (100).
    const saldoFinal = await leerSaldo(uid);
    expect(saldoFinal).toBe(40);
  });

  test('sumarSaldo: dos sumas concurrentes se aplican ambas (sin lost update)', async () => {
    const uid = `race-sumar-${Date.now()}`;
    await crearUsuario(uid, 0);

    await Promise.all([sumarSaldo(uid, 10), sumarSaldo(uid, 10)]);

    // Si la operación NO fuera atómica, ambas llamadas leerían saldo=0 y
    // escribirían 10, perdiéndose una de las dos sumas (lost update).
    const saldoFinal = await leerSaldo(uid);
    expect(saldoFinal).toBe(20);
  });

  test('restarSaldoGanancia: mismo patrón de carrera que restarSaldo, para el saldo del gestor', async () => {
    const uid = `race-ganancia-${Date.now()}`;
    await crearUsuario(uid, 1000);

    const [r1, r2] = await Promise.all([
      restarSaldoGanancia(uid, 'creador-x', 700),
      restarSaldoGanancia(uid, 'creador-x', 700),
    ]);

    const exitosos = [r1, r2].filter((r) => r === null);
    expect(exitosos).toHaveLength(1);

    const saldoFinal = await leerSaldo(uid);
    expect(saldoFinal).toBe(300);
  });

  test('acreditarDesdeBilletera: la MISMA transactionId llamada concurrentemente solo acredita una vez (idempotencia bajo concurrencia)', async () => {
    const uid = `race-credito-${Date.now()}`;
    const txId = `TRN-RACE-${Date.now()}`;
    await crearUsuario(uid, 0);

    const [r1, r2] = await Promise.all([
      acreditarDesdeBilletera(uid, 50, txId),
      acreditarDesdeBilletera(uid, 50, txId),
    ]);

    // Ambas llamadas deben reportar éxito (una aplica, la otra detecta
    // already_applied), pero el saldo solo debe reflejar UN crédito de 50.
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    const yaAplicadas = [r1, r2].filter((r) => r.already_applied === true);
    expect(yaAplicadas.length).toBeGreaterThanOrEqual(1);

    const saldoFinal = await leerSaldo(uid);
    expect(saldoFinal).toBe(50); // NO 100 — si fuera 100, hubo doble crédito.
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
});
