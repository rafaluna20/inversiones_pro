/**
 * @jest-environment node
 */

/**
 * Server actions del saldo de la plataforma (app/actions/plataforma-saldo.ts y
 * los retiros de app/actions/wallet.ts), extremo a extremo contra los
 * emuladores de Firestore + Auth, con la billetera Odoo simulada a nivel HTTP
 * (`fetch`) y la cookie de sesión de la billetera simulada (`next/headers`).
 *
 * Requiere los emuladores: `npm run test:emulator`.
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import {
  cargarAPlataformaAction,
  completarCargaPendienteAction,
  recargaDemoAction,
  retiroDemoBancoAction,
  transferirEntreUsuariosAction,
} from '@/app/actions/plataforma-saldo';
import { completarRetiroPendienteAction, withdrawFromPlatformAction } from '@/app/actions/wallet';

let mockCookieBilletera: string | undefined = 'tok-odoo';
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: (nombre: string) => (nombre === 'billetera_session' && mockCookieBilletera ? { value: mockCookieBilletera } : undefined),
  }),
}));

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Este test requiere los emuladores de Firestore Y Auth. Usa `npm run test:emulator`.');
}

const fetchMock = jest.fn();

beforeAll(() => {
  process.env.NEXT_PUBLIC_WALLET_API_URL = 'http://odoo.test';
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  mockCookieBilletera = 'tok-odoo';
  delete process.env.PLATAFORMA_MODO_DEMO;
});

afterAll(async () => {
  await terminate(db);
});

const unico = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function crearUsuarioAuth(prefijo: string, saldo: number) {
  const email = `${unico(prefijo)}@test.com`;
  const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-123');
  const idToken = await cred.user.getIdToken();
  await setDoc(doc(db, 'usuarios', cred.user.uid), { saldo, email });
  return { uid: cred.user.uid, idToken, email };
}
async function leerSaldo(uid: string): Promise<number> {
  return (await getDoc(doc(db, 'usuarios', uid))).data()?.saldo;
}
async function leerDoc(coleccion: string, id: string) {
  const snap = await getDoc(doc(db, coleccion, id));
  return snap.exists() ? snap.data()! : undefined;
}

// ── Odoo simulado ────────────────────────────────────────────────────────────
const odooResponde = (cuerpo: object) => fetchMock.mockResolvedValueOnce({ json: async () => cuerpo });
const odooCae = () => fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
const odooOk = (transactionId: string, amount: number) =>
  odooResponde({ result: { success: true, transaction_id: transactionId, amount, new_balance: 1234 } });
const cuerpoDeLlamada = (n: number) => JSON.parse(fetchMock.mock.calls[n][1].body).params;

describe('withdrawFromPlatformAction (plataforma → billetera Odoo)', () => {
  test('Odoo confirma: el saldo queda descontado y el retiro completado', async () => {
    const u = await crearUsuarioAuth('wd-ok', 100);
    odooOk('TRN-W1', 30);

    const r = await withdrawFromPlatformAction(30, u.idToken);

    expect(r.success).toBe(true);
    expect(await leerSaldo(u.uid)).toBe(70);
    expect((await leerDoc('plataforma_retiros', r.transaction_id!))?.status).toBe('completed');
  });

  test('Odoo RECHAZA: se devuelve el saldo (rollback) y se informa el motivo', async () => {
    const u = await crearUsuarioAuth('wd-rechaza', 100);
    odooResponde({ result: { success: false, error: 'Cuenta suspendida' } });

    const r = await withdrawFromPlatformAction(30, u.idToken);

    expect(r.success).toBe(false);
    expect(r.message).toContain('Cuenta suspendida');
    expect(await leerSaldo(u.uid)).toBe(100);
  });

  test('SIN RESPUESTA de Odoo (red caída): NO se devuelve el saldo — queda retenido y pendiente (antes se devolvía y se creaba dinero)', async () => {
    const u = await crearUsuarioAuth('wd-red', 100);
    odooCae();

    const r = await withdrawFromPlatformAction(30, u.idToken);

    expect(r.success).toBe(false);
    expect(r.pending).toBe(true);
    expect(r.transaction_id).toMatch(/^WTH-/);
    expect(await leerSaldo(u.uid)).toBe(70); // retenido, NO devuelto
    expect((await leerDoc('plataforma_retiros', r.transaction_id!))?.status).toBe('pending');
  });

  test('error JSON-RPC de Odoo también se trata como "no se sabe" (retiro pendiente, sin rollback)', async () => {
    const u = await crearUsuarioAuth('wd-rpc', 100);
    odooResponde({ error: { message: 'Odoo Server Error' } });

    const r = await withdrawFromPlatformAction(40, u.idToken);

    expect(r.pending).toBe(true);
    expect(await leerSaldo(u.uid)).toBe(60);
  });

  test('un retiro pendiente se completa con completarRetiroPendienteAction usando la MISMA clave de idempotencia y el monto guardado', async () => {
    const u = await crearUsuarioAuth('wd-recupera', 100);
    odooCae();
    const inicial = await withdrawFromPlatformAction(30, u.idToken);
    const txId = inicial.transaction_id!;

    odooOk('TRN-W2', 30);
    const r = await completarRetiroPendienteAction(u.idToken, txId);

    expect(r.success).toBe(true);
    expect(cuerpoDeLlamada(1)).toMatchObject({ amount: 30, idempotency_key: txId, firebase_uid: u.uid });
    expect(await leerSaldo(u.uid)).toBe(70); // sin doble descuento
    expect((await leerDoc('plataforma_retiros', txId))?.status).toBe('completed');

    // Ya completado: no se vuelve a llamar a Odoo.
    const otra = await completarRetiroPendienteAction(u.idToken, txId);
    expect(otra.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('si al recuperar Odoo confirma que NO lo aplicó, se devuelve el saldo', async () => {
    const u = await crearUsuarioAuth('wd-recupera-rech', 100);
    odooCae();
    const inicial = await withdrawFromPlatformAction(30, u.idToken);

    odooResponde({ result: { success: false, error: 'Límite diario excedido' } });
    const r = await completarRetiroPendienteAction(u.idToken, inicial.transaction_id!);

    expect(r.success).toBe(false);
    expect(await leerSaldo(u.uid)).toBe(100);
  });

  test('otro usuario NO puede recuperar el retiro de alguien más', async () => {
    const dueno = await crearUsuarioAuth('wd-dueno', 100);
    const intruso = await crearUsuarioAuth('wd-intruso', 0);
    odooCae();
    const inicial = await withdrawFromPlatformAction(30, dueno.idToken);
    fetchMock.mockClear();

    const r = await completarRetiroPendienteAction(intruso.idToken, inicial.transaction_id!);

    expect(r).toMatchObject({ success: false, message: 'No se encontró ese retiro.' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await leerSaldo(intruso.uid)).toBe(0);
  });

  test.each([
    ['NaN', NaN],
    ['negativo', -5],
    ['cero', 0],
    ['más de 2 decimales', 0.001],
    ['Infinity', Infinity],
  ])('monto inválido (%s): se rechaza sin llamar a Odoo ni tocar el saldo', async (_n, monto) => {
    const u = await crearUsuarioAuth('wd-inv', 100);

    const r = await withdrawFromPlatformAction(monto as number, u.idToken);

    expect(r.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await leerSaldo(u.uid)).toBe(100);
  });

  test('un ID token falso se rechaza sin tocar nada', async () => {
    const r = await withdrawFromPlatformAction(10, 'token-falso');
    expect(r.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cargarAPlataformaAction (billetera Odoo → plataforma)', () => {
  test('carga exitosa: acredita el saldo desde el SERVIDOR y usa la llave del registro como idempotencia en Odoo', async () => {
    const u = await crearUsuarioAuth('cg-ok', 20);
    odooOk('TRN-C1', 50);

    const r = await cargarAPlataformaAction(u.idToken, 50);

    expect(r).toMatchObject({ ok: true, nuevoSaldo: 70 });
    expect(await leerSaldo(u.uid)).toBe(70);

    const cuerpo = cuerpoDeLlamada(0);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/wallet/platform-load');
    expect(cuerpo).toMatchObject({ amount: 50, firebase_uid: u.uid, platform: 'inversiones_pro' });
    expect((await leerDoc('plataforma_cargas', cuerpo.idempotency_key))).toMatchObject({
      status: 'completed',
      firebase_uid: u.uid,
      amount_credited: 50,
    });
  });

  test('Odoo inalcanzable: la carga queda pendiente (con código) y se completa después sin duplicar', async () => {
    const u = await crearUsuarioAuth('cg-red', 0);
    odooCae();

    const primera = await cargarAPlataformaAction(u.idToken, 80);
    expect(primera).toMatchObject({ ok: false, pendiente: true });
    expect(primera.llave).toBeTruthy();
    expect(await leerSaldo(u.uid)).toBe(0);

    odooOk('TRN-C2', 80);
    const segunda = await completarCargaPendienteAction(u.idToken, primera.llave!);
    expect(segunda).toMatchObject({ ok: true, nuevoSaldo: 80 });
    expect(cuerpoDeLlamada(1).idempotency_key).toBe(cuerpoDeLlamada(0).idempotency_key); // misma clave

    // Repetir la recuperación no acredita de nuevo.
    const tercera = await completarCargaPendienteAction(u.idToken, primera.llave!);
    expect(tercera).toMatchObject({ ok: true, yaAplicada: true });
    expect(await leerSaldo(u.uid)).toBe(80);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('Odoo rechaza (saldo insuficiente en la billetera): no se acredita nada', async () => {
    const u = await crearUsuarioAuth('cg-rechaza', 10);
    odooResponde({ result: { success: false, error: 'Saldo insuficiente. Disponible: S/ 5.00' } });

    const r = await cargarAPlataformaAction(u.idToken, 100);

    expect(r.ok).toBe(false);
    expect(r.pendiente).toBeUndefined();
    expect(r.mensaje).toContain('Saldo insuficiente');
    expect(await leerSaldo(u.uid)).toBe(10);
  });

  test('otro usuario no puede completar la carga pendiente de alguien más', async () => {
    const dueno = await crearUsuarioAuth('cg-dueno', 0);
    const intruso = await crearUsuarioAuth('cg-intruso', 0);
    odooCae();
    const inicial = await cargarAPlataformaAction(dueno.idToken, 30);
    fetchMock.mockClear();

    const r = await completarCargaPendienteAction(intruso.idToken, inicial.llave!);

    expect(r).toMatchObject({ ok: false, mensaje: 'No autorizado para esta carga.' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await leerSaldo(intruso.uid)).toBe(0);
  });

  test('validaciones: monto bajo el mínimo, sin sesión de billetera o con token falso — sin llamar a Odoo', async () => {
    const u = await crearUsuarioAuth('cg-val', 0);

    expect((await cargarAPlataformaAction(u.idToken, 5)).ok).toBe(false);
    expect((await cargarAPlataformaAction(u.idToken, NaN)).ok).toBe(false);
    expect((await cargarAPlataformaAction('token-falso', 50)).ok).toBe(false);

    mockCookieBilletera = undefined;
    const sinSesion = await cargarAPlataformaAction(u.idToken, 50);
    expect(sinSesion).toMatchObject({ ok: false, mensaje: 'No autenticado en la billetera. Conéctala primero.' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await leerSaldo(u.uid)).toBe(0);
  });

  test('un código de recuperación con formato inválido se rechaza', async () => {
    const u = await crearUsuarioAuth('cg-codigo', 0);
    expect((await completarCargaPendienteAction(u.idToken, '../../usuarios/otro')).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('transferirEntreUsuariosAction y modo demo (server actions)', () => {
  test('la identidad de origen sale del ID token: transfiere de quien firma, no de quien diga el cliente', async () => {
    const origen = await crearUsuarioAuth('tr-origen', 100);
    const destino = await crearUsuarioAuth('tr-destino', 0);

    const r = await transferirEntreUsuariosAction(origen.idToken, destino.email, 25, unico('intento'));

    expect(r).toMatchObject({ ok: true, nuevoSaldo: 75 });
    expect(await leerSaldo(origen.uid)).toBe(75);
    expect(await leerSaldo(destino.uid)).toBe(25);
  });

  test('un token falso no mueve nada', async () => {
    const destino = await crearUsuarioAuth('tr-destino2', 0);
    const r = await transferirEntreUsuariosAction('token-falso', destino.email, 25);
    expect(r.ok).toBe(false);
    expect(await leerSaldo(destino.uid)).toBe(0);
  });

  test('recargaDemoAction y retiroDemoBancoAction: deshabilitados por defecto, funcionan con PLATAFORMA_MODO_DEMO=true', async () => {
    const u = await crearUsuarioAuth('demo-act', 10);

    expect((await recargaDemoAction(u.idToken, 100)).ok).toBe(false);
    expect((await retiroDemoBancoAction(u.idToken, 5)).ok).toBe(false);
    expect(await leerSaldo(u.uid)).toBe(10);

    process.env.PLATAFORMA_MODO_DEMO = 'true';
    expect(await recargaDemoAction(u.idToken, 100)).toMatchObject({ ok: true, nuevoSaldo: 110 });
    expect(await retiroDemoBancoAction(u.idToken, 5)).toMatchObject({ ok: true, nuevoSaldo: 105 });
    expect(await leerSaldo(u.uid)).toBe(105);
  });
});
