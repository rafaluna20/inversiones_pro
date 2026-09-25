/**
 * @jest-environment node
 */

/**
 * Integración contra el emulador de Firestore de lib/plataforma-saldo.ts: el
 * código de servidor que reemplaza a las escrituras de `usuarios.saldo` que
 * antes hacía el navegador. La billetera Odoo se simula con un "Odoo falso"
 * idempotente por clave, igual que /api/wallet/platform-load.
 *
 * Requiere el emulador de Firestore: `npm run test:emulator`.
 */

import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  acreditarSaldoDemo,
  debitarSaldoDemoBanco,
  procesarCargaPlataforma,
  transferirSaldoEntreUsuarios,
  type DebitarBilletera,
} from '@/lib/plataforma-saldo';
import type { ResultadoMovimientoOdoo } from '@/lib/odoo-wallet';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este test requiere el emulador de Firestore. Usa `npm run test:emulator`.');
}

const unico = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function crearUsuario(uid: string, saldo: number, extra: Record<string, unknown> = {}) {
  await setDoc(doc(db, 'usuarios', uid), { saldo, ...extra });
}
async function leerSaldo(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.data()?.saldo;
}
async function leerDoc(coleccion: string, id: string) {
  const snap = await getDoc(doc(db, coleccion, id));
  return snap.exists() ? snap.data()! : undefined;
}

/** Odoo falso: idempotente por llave, con respuestas programables. */
function odooFalso(respuestas: Array<'ok' | 'rechaza' | 'indeterminado' | 'lanza'> = ['ok']) {
  const llamadas: Array<{ llave: string; monto: number }> = [];
  const yaDebitado = new Map<string, ResultadoMovimientoOdoo>();
  let i = 0;
  const debitar: DebitarBilletera = async (llave, monto) => {
    llamadas.push({ llave, monto });
    const previo = yaDebitado.get(llave);
    if (previo) return previo; // idempotencia de Odoo: misma llave, misma transacción

    const modo = respuestas[Math.min(i++, respuestas.length - 1)];
    if (modo === 'lanza') throw new Error('timeout de red');
    if (modo === 'rechaza') return { estado: 'rechazada', mensaje: 'Saldo insuficiente en la billetera' };
    if (modo === 'indeterminado') return { estado: 'indeterminado', mensaje: 'timeout' };

    const resultado: ResultadoMovimientoOdoo = { estado: 'ok', transactionId: `TRN-${llave}`, monto };
    yaDebitado.set(llave, resultado);
    return resultado;
  };
  return { debitar, llamadas };
}

// A nivel de archivo (no dentro de un describe): si se cerrara la conexión al
// terminar el primer describe, los siguientes fallarían por "terminated".
afterAll(async () => {
  await terminate(db);
});

describe('procesarCargaPlataforma (billetera Odoo → saldo de plataforma)', () => {
  test('carga exitosa: acredita el saldo, cierra el registro y llama a Odoo una sola vez', async () => {
    const uid = unico('carga-ok');
    const llave = unico('PLAT');
    await crearUsuario(uid, 20);
    const odoo = odooFalso();

    const r = await procesarCargaPlataforma({ uid, llave, monto: 50, debitar: odoo.debitar });

    expect(r).toMatchObject({ ok: true, yaAplicada: false, nuevoSaldo: 70 });
    expect(await leerSaldo(uid)).toBe(70);
    expect(odoo.llamadas).toEqual([{ llave, monto: 50 }]);

    const registro = await leerDoc('plataforma_cargas', llave);
    expect(registro).toMatchObject({
      firebase_uid: uid,
      status: 'completed',
      amount_credited: 50,
      odoo_transaction_id: `TRN-${llave}`,
      saldo_anterior: 20,
      saldo_resultante: 70,
    });
  });

  test('idempotencia: repetir la misma llave no acredita dos veces ni vuelve a llamar a Odoo', async () => {
    const uid = unico('carga-idem');
    const llave = unico('PLAT');
    await crearUsuario(uid, 0);
    const odoo = odooFalso();

    await procesarCargaPlataforma({ uid, llave, monto: 30, debitar: odoo.debitar });
    const segunda = await procesarCargaPlataforma({ uid, llave, monto: 30, debitar: odoo.debitar });

    expect(segunda).toMatchObject({ ok: true, yaAplicada: true, nuevoSaldo: 30 });
    expect(await leerSaldo(uid)).toBe(30);
    expect(odoo.llamadas).toHaveLength(1);
  });

  test('concurrencia: dos solicitudes simultáneas con la MISMA llave acreditan una sola vez y debitan Odoo una sola vez', async () => {
    const uid = unico('carga-race');
    const llave = unico('PLAT');
    await crearUsuario(uid, 0);
    const odoo = odooFalso();

    const [a, b] = await Promise.all([
      procesarCargaPlataforma({ uid, llave, monto: 40, debitar: odoo.debitar }),
      procesarCargaPlataforma({ uid, llave, monto: 40, debitar: odoo.debitar }),
    ]);

    expect([a, b].some((r) => r.ok)).toBe(true);
    expect(await leerSaldo(uid)).toBe(40); // NO 80
    expect(odoo.llamadas).toHaveLength(1);
  });

  test('Odoo rechaza (saldo insuficiente): no se acredita nada y la carga queda como fallida', async () => {
    const uid = unico('carga-rechaza');
    const llave = unico('PLAT');
    await crearUsuario(uid, 15);
    const odoo = odooFalso(['rechaza']);

    const r = await procesarCargaPlataforma({ uid, llave, monto: 100, debitar: odoo.debitar });

    expect(r).toMatchObject({ ok: false, error: 'Saldo insuficiente en la billetera' });
    expect((r as { pendiente?: boolean }).pendiente).toBeUndefined();
    expect(await leerSaldo(uid)).toBe(15);
    expect((await leerDoc('plataforma_cargas', llave))?.status).toBe('failed');

    // Una carga rechazada no se puede "revivir" con la misma llave.
    const reintento = await procesarCargaPlataforma({ uid, llave, monto: 100, debitar: odoo.debitar });
    expect(reintento.ok).toBe(false);
    expect(odoo.llamadas).toHaveLength(1);
  });

  test('sin respuesta de Odoo (timeout) NO se da por fallida: queda pendiente y el reintento con la misma llave la completa una sola vez', async () => {
    const uid = unico('carga-timeout');
    const llave = unico('PLAT');
    await crearUsuario(uid, 0);
    // 1ª llamada: red caída (Odoo pudo haber debitado o no). 2ª: responde bien.
    const odoo = odooFalso(['lanza', 'ok']);

    const primera = await procesarCargaPlataforma({ uid, llave, monto: 60, debitar: odoo.debitar });
    expect(primera).toMatchObject({ ok: false, pendiente: true, llave });
    expect(await leerSaldo(uid)).toBe(0);
    expect((await leerDoc('plataforma_cargas', llave))?.status).toBe('pending');

    // Reintento de recuperación: solo retoma la carga existente y usa el monto GUARDADO.
    const segunda = await procesarCargaPlataforma({
      uid,
      llave,
      monto: 9999, // se ignora
      soloExistente: true,
      debitar: odoo.debitar,
    });
    expect(segunda).toMatchObject({ ok: true, yaAplicada: false, nuevoSaldo: 60 });
    expect(odoo.llamadas[1]).toEqual({ llave, monto: 60 });

    // Un tercer reintento ya no acredita nada más.
    const tercera = await procesarCargaPlataforma({ uid, llave, monto: 0, soloExistente: true, debitar: odoo.debitar });
    expect(tercera).toMatchObject({ ok: true, yaAplicada: true });
    expect(await leerSaldo(uid)).toBe(60);
  });

  test('respuesta indeterminada (estado "indeterminado") también deja la carga pendiente', async () => {
    const uid = unico('carga-indet');
    const llave = unico('PLAT');
    await crearUsuario(uid, 5);
    const odoo = odooFalso(['indeterminado']);

    const r = await procesarCargaPlataforma({ uid, llave, monto: 10, debitar: odoo.debitar });

    expect(r).toMatchObject({ ok: false, pendiente: true, llave });
    expect(await leerSaldo(uid)).toBe(5);
  });

  test('un usuario NO puede completar ni ver la carga de otro usuario', async () => {
    const dueno = unico('carga-dueno');
    const intruso = unico('carga-intruso');
    const llave = unico('PLAT');
    await crearUsuario(dueno, 0);
    await crearUsuario(intruso, 0);
    const odoo = odooFalso(['lanza', 'ok']);

    await procesarCargaPlataforma({ uid: dueno, llave, monto: 25, debitar: odoo.debitar });

    const r = await procesarCargaPlataforma({ uid: intruso, llave, monto: 0, soloExistente: true, debitar: odoo.debitar });
    expect(r).toMatchObject({ ok: false, error: 'No autorizado para esta carga.' });
    expect(await leerSaldo(intruso)).toBe(0);
    expect(await leerSaldo(dueno)).toBe(0);
    expect(odoo.llamadas).toHaveLength(1); // el intruso no logró que se llamara a Odoo
  });

  test('soloExistente con una llave que no existe no crea ningún registro ni llama a Odoo', async () => {
    const uid = unico('carga-inexistente');
    const llave = unico('PLAT');
    await crearUsuario(uid, 0);
    const odoo = odooFalso();

    const r = await procesarCargaPlataforma({ uid, llave, monto: 0, soloExistente: true, debitar: odoo.debitar });

    expect(r).toMatchObject({ ok: false, error: 'No se encontró esa carga.' });
    expect(await leerDoc('plataforma_cargas', llave)).toBeUndefined();
    expect(odoo.llamadas).toHaveLength(0);
  });

  test('una carga con la reserva vigente (otra solicitud en curso) no vuelve a llamar a Odoo', async () => {
    const uid = unico('carga-lease');
    const llave = unico('PLAT');
    await crearUsuario(uid, 0);
    await setDoc(doc(db, 'plataforma_cargas', llave), {
      firebase_uid: uid,
      amount: 10,
      status: 'pending',
      en_proceso_hasta: Date.now() + 60_000,
    });
    const odoo = odooFalso();

    const r = await procesarCargaPlataforma({ uid, llave, monto: 10, debitar: odoo.debitar });

    expect(r).toMatchObject({ ok: false, pendiente: true, llave });
    expect(odoo.llamadas).toHaveLength(0);
  });

  test('Odoo debitó pero el usuario no tiene perfil: queda pendiente con el dato de Odoo para resolverlo a mano', async () => {
    const uid = unico('carga-sinperfil');
    const llave = unico('PLAT');
    const odoo = odooFalso();

    const r = await procesarCargaPlataforma({ uid, llave, monto: 10, debitar: odoo.debitar });

    expect(r).toMatchObject({ ok: false, pendiente: true, llave });
    const registro = await leerDoc('plataforma_cargas', llave);
    expect(registro).toMatchObject({ status: 'pending', ultimo_error: 'usuario_sin_perfil', odoo_transaction_id: `TRN-${llave}` });
  });
});

describe('transferirSaldoEntreUsuarios', () => {
  test('mueve el saldo de forma atómica y registra la transferencia; la suma total se conserva', async () => {
    const a = unico('trf-a');
    const b = unico('trf-b');
    const emailB = `${b}@test.com`;
    await crearUsuario(a, 100, { email: `${a}@test.com` });
    await crearUsuario(b, 5, { email: emailB });

    const r = await transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: emailB, monto: 30.5 });

    expect(r).toMatchObject({ ok: true, yaAplicada: false, nuevoSaldoOrigen: 69.5 });
    expect(await leerSaldo(a)).toBe(69.5);
    expect(await leerSaldo(b)).toBe(35.5);
    expect((await leerSaldo(a)) + (await leerSaldo(b))).toBe(105);
  });

  test('saldo insuficiente: no cambia nada', async () => {
    const a = unico('trf-poco');
    const b = unico('trf-dest');
    await crearUsuario(a, 10, { email: `${a}@test.com` });
    await crearUsuario(b, 0, { email: `${b}@test.com` });

    const r = await transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${b}@test.com`, monto: 10.01 });

    expect(r).toEqual({ ok: false, error: 'Saldo insuficiente.' });
    expect(await leerSaldo(a)).toBe(10);
    expect(await leerSaldo(b)).toBe(0);
  });

  test.each([
    ['cero', 0],
    ['negativo (robar saldo al destinatario)', -50],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['más de 2 decimales', 0.001],
    ['sobre el máximo', 2_000_000],
  ])('monto inválido (%s) se rechaza sin tocar ningún saldo', async (_nombre, monto) => {
    const a = unico('trf-inv-a');
    const b = unico('trf-inv-b');
    await crearUsuario(a, 100, { email: `${a}@test.com` });
    await crearUsuario(b, 100, { email: `${b}@test.com` });

    const r = await transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${b}@test.com`, monto: monto as number });

    expect(r.ok).toBe(false);
    expect(await leerSaldo(a)).toBe(100);
    expect(await leerSaldo(b)).toBe(100);
  });

  test('no se puede transferir a uno mismo ni a un correo que no existe', async () => {
    const a = unico('trf-self');
    await crearUsuario(a, 100, { email: `${a}@test.com` });

    expect(await transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${a}@test.com`, monto: 10 })).toEqual({
      ok: false,
      error: 'No puedes transferir a ti mismo.',
    });
    expect(await transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `nadie-${a}@test.com`, monto: 10 })).toEqual({
      ok: false,
      error: 'Usuario destinatario no encontrado.',
    });
    expect(await leerSaldo(a)).toBe(100);
  });

  test('idempotencia: la misma llave (doble clic / reintento) transfiere una sola vez', async () => {
    const a = unico('trf-idem-a');
    const b = unico('trf-idem-b');
    await crearUsuario(a, 100, { email: `${a}@test.com` });
    await crearUsuario(b, 0, { email: `${b}@test.com` });
    const llave = unico('intento');

    const [r1, r2] = await Promise.all([
      transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${b}@test.com`, monto: 40, llave }),
      transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${b}@test.com`, monto: 40, llave }),
    ]);

    expect(r1.ok && r2.ok).toBe(true);
    expect(await leerSaldo(a)).toBe(60); // NO 20
    expect(await leerSaldo(b)).toBe(40); // NO 80
  });

  test('concurrencia: dos transferencias que juntas exceden el saldo — solo una se aplica y el saldo nunca es negativo', async () => {
    const a = unico('trf-race-a');
    const b = unico('trf-race-b');
    await crearUsuario(a, 100, { email: `${a}@test.com` });
    await crearUsuario(b, 0, { email: `${b}@test.com` });

    const [r1, r2] = await Promise.all([
      transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${b}@test.com`, monto: 80 }),
      transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${b}@test.com`, monto: 80 }),
    ]);

    expect([r1, r2].filter((r) => r.ok)).toHaveLength(1);
    expect(await leerSaldo(a)).toBe(20);
    expect(await leerSaldo(b)).toBe(80);
  });

  test('llave con formato inválido se rechaza', async () => {
    const a = unico('trf-llave');
    const b = unico('trf-llave-b');
    await crearUsuario(a, 100, { email: `${a}@test.com` });
    await crearUsuario(b, 0, { email: `${b}@test.com` });

    const r = await transferirSaldoEntreUsuarios({ origenUid: a, destinatarioEmail: `${b}@test.com`, monto: 10, llave: 'a/b' });
    expect(r.ok).toBe(false);
    expect(await leerSaldo(a)).toBe(100);
  });
});

describe('modo demo (solo con PLATAFORMA_MODO_DEMO=true)', () => {
  test('deshabilitado por defecto: no acredita nada', async () => {
    const uid = unico('demo-off');
    await crearUsuario(uid, 10);

    const r = await acreditarSaldoDemo({ uid, monto: 500, habilitado: false });

    expect(r).toEqual({ ok: false, error: 'El modo demo está deshabilitado en este entorno.' });
    expect(await leerSaldo(uid)).toBe(10);
  });

  test('habilitado: acredita con registro auditable y respeta el tope por operación', async () => {
    const uid = unico('demo-on');
    await crearUsuario(uid, 10);

    expect(await acreditarSaldoDemo({ uid, monto: 500, habilitado: true })).toEqual({ ok: true, nuevoSaldo: 510 });
    expect(await leerSaldo(uid)).toBe(510);

    expect((await acreditarSaldoDemo({ uid, monto: 10_001, habilitado: true })).ok).toBe(false);
    expect((await acreditarSaldoDemo({ uid, monto: -5, habilitado: true })).ok).toBe(false);
    expect((await acreditarSaldoDemo({ uid, monto: NaN, habilitado: true })).ok).toBe(false);
    expect(await leerSaldo(uid)).toBe(510);
  });

  test('retiro demo a banco: descuenta con saldo suficiente, rechaza si no alcanza, y nunca deja saldo negativo', async () => {
    const uid = unico('demo-retiro');
    await crearUsuario(uid, 100);

    expect(await debitarSaldoDemoBanco({ uid, monto: 30, habilitado: true })).toEqual({ ok: true, nuevoSaldo: 70 });
    expect(await debitarSaldoDemoBanco({ uid, monto: 70.01, habilitado: true })).toEqual({ ok: false, error: 'Saldo insuficiente.' });
    expect(await debitarSaldoDemoBanco({ uid, monto: 1, habilitado: false })).toEqual({
      ok: false,
      error: 'El modo demo está deshabilitado en este entorno.',
    });
    expect(await leerSaldo(uid)).toBe(70);
  });

  test('usuario sin perfil: no se acredita ni se descuenta', async () => {
    const uid = unico('demo-sinperfil');
    expect(await acreditarSaldoDemo({ uid, monto: 10, habilitado: true })).toEqual({
      ok: false,
      error: 'Tu perfil de plataforma no existe.',
    });
    expect(await debitarSaldoDemoBanco({ uid, monto: 10, habilitado: true })).toEqual({
      ok: false,
      error: 'Tu perfil de plataforma no existe.',
    });
  });
});
