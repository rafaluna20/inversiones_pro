/**
 * @jest-environment node
 */

/**
 * POST /api/inv/banco/resumen: extremo a extremo contra el emulador de Firestore + Auth. Cubre también el paso
 * previo que hace posible este endpoint: que loginAction vincule la cuenta de billetera (WAL...) al usuario de
 * Firestore que la conecta (app/actions/auth.ts).
 *
 * Requiere los emuladores: `npm run test:emulator`.
 */
import { createHash, createHmac } from 'node:crypto';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import { POST } from '@/app/api/inv/banco/resumen/route';
import { loginAction } from '@/app/actions/auth';

const SECRETO = 'secreto-de-prueba-integration';
const RUTA = '/api/inv/banco/resumen';
const CUENTA = 'WAL00000001';

jest.mock('next/headers', () => ({ cookies: () => ({ set: () => undefined, get: () => undefined, delete: () => undefined }) }));

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Este test requiere los emuladores de Firestore Y Auth. Usa `npm run test:emulator`.');
}

const fetchMock = jest.fn();

beforeAll(() => {
  process.env.NEXT_PUBLIC_WALLET_API_URL = 'http://odoo.test';
  process.env.WALLET_PLATFORM_CODE = 'inversiones_pro';
  process.env.WALLET_PLATFORM_SECRET = SECRETO;
  global.fetch = fetchMock as unknown as typeof fetch;
});
beforeEach(() => fetchMock.mockReset());
afterAll(async () => {
  await terminate(db);
});

const unico = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function crearUsuarioAuth(prefijo: string, extra: Record<string, unknown> = {}) {
  const email = `${unico(prefijo)}@test.com`;
  const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-123');
  await setDoc(doc(db, 'usuarios', cred.user.uid), { saldo: 0, email, ...extra });
  return { uid: cred.user.uid, idToken: await cred.user.getIdToken() };
}

function peticionFirmada(params: Record<string, unknown>, opciones: { codigo?: string; secreto?: string; ts?: number } = {}) {
  const cuerpo = JSON.stringify({ jsonrpc: '2.0', method: 'call', params });
  const ts = opciones.ts ?? Math.floor(Date.now() / 1000);
  const digest = createHash('sha256').update(cuerpo).digest('hex');
  const firma = createHmac('sha256', opciones.secreto ?? SECRETO).update(`${ts}\n${RUTA}\n${digest}`).digest('hex');
  return new Request('http://localhost/api/inv/banco/resumen', {
    method: 'POST', body: cuerpo,
    headers: {
      'content-type': 'application/json',
      'x-wallet-platform': opciones.codigo ?? 'inversiones_pro',
      'x-wallet-timestamp': String(ts),
      'x-wallet-signature': firma,
    },
  });
}

describe('POST /api/inv/banco/resumen', () => {
  test('firma inválida, plataforma equivocada o sin firmar: siempre "no_autorizado", sin distinguir el motivo', async () => {
    for (const opciones of [{ secreto: 'otro-secreto' }, { codigo: 'otra-plataforma' }, { ts: Math.floor(Date.now() / 1000) - 400 }]) {
      const r = await (await POST(peticionFirmada({ account_number: CUENTA }, opciones))).json();
      expect(r.result).toEqual({ success: false, error: 'No autorizado.', code: 'no_autorizado' });
    }
    const sinFirma = new Request('http://localhost/api/inv/banco/resumen', { method: 'POST', body: '{}' });
    expect((await (await POST(sinFirma)).json()).result.code).toBe('no_autorizado');
  });

  test('cuenta que no está vinculada a nadie: "no vinculado", sin filtrar si existe o no', async () => {
    const r = await (await POST(peticionFirmada({ account_number: 'WAL00099999' }))).json();
    expect(r.result).toEqual({ success: true, vinculado: false });
  });

  test('cuenta vinculada: entrega el resumen (saldo + proyectos) de ESE usuario, nunca de otro', async () => {
    const ana = await crearUsuarioAuth('resumen-ana', { saldo: 1500, walletAccount: CUENTA });
    const beto = await crearUsuarioAuth('resumen-beto', { saldo: 999999 }); // sin vincular: no debe aparecer
    await setDoc(doc(db, 'productos', unico('proyecto')), {
      nombre: 'Edificio Prueba', precio: 10000, estado: true,
      inversores: [{ usuarioId: ana.uid, cubos: 30 }, { usuarioId: beto.uid, cubos: 20 }],
    });

    const r = await (await POST(peticionFirmada({ account_number: CUENTA }))).json();

    expect(r.result.success).toBe(true);
    expect(r.result.vinculado).toBe(true);
    expect(r.result.resumen).toMatchObject({ saldo_libre: 1500, capital_en_curso: 3000, patrimonio: 4500 });
    expect(r.result.resumen.contratos).toHaveLength(1);
    const texto = JSON.stringify(r);
    expect(texto).not.toContain(beto.uid);
    expect(texto).not.toContain('999999'); // el saldo de Beto no se filtra
  });

  test('dos cuentas de billetera vinculadas por error a la misma cuenta WAL: ambigüedad -> "no vinculado" (nunca se adivina)', async () => {
    const cuentaAmbigua = 'WAL00088888';
    await crearUsuarioAuth('ambiguo-1', { walletAccount: cuentaAmbigua });
    await crearUsuarioAuth('ambiguo-2', { walletAccount: cuentaAmbigua });
    const r = await (await POST(peticionFirmada({ account_number: cuentaAmbigua }))).json();
    expect(r.result).toEqual({ success: true, vinculado: false });
  });

  test('cuerpo sin account_number, o con un tipo raro: "no vinculado" (no revienta)', async () => {
    for (const params of [{}, { account_number: 123 }, { account_number: null }]) {
      const r = await (await POST(peticionFirmada(params as Record<string, unknown>))).json();
      expect(r.result).toEqual({ success: true, vinculado: false });
    }
  });

  test('la respuesta nunca se guarda en caché (cambia el saldo entre una consulta y otra)', async () => {
    const r = await POST(peticionFirmada({ account_number: CUENTA }));
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
});

describe('loginAction vincula la cuenta de billetera al conectar (base del endpoint de arriba)', () => {
  const odooLoginOk = (numero: string) =>
    fetchMock.mockResolvedValue({ json: async () => ({ result: { success: true, token: 'tok-odoo-x', wallet: { number: numero, balance: 0, state: 'active', has_pin: true } } }) });

  test('con el idToken de Firebase, queda vinculada la cuenta que devolvió el banco', async () => {
    const u = await crearUsuarioAuth('login-vincula');
    odooLoginOk('WAL00000042');

    const formData = new FormData();
    formData.set('email', 'ana@example.com');
    formData.set('password', 'Clave-Segura-12345');
    formData.set('firebaseIdToken', u.idToken);
    const r = await loginAction(formData);

    expect(r.success).toBe(true);
    expect((await getDoc(doc(db, 'usuarios', u.uid))).data()?.walletAccount).toBe('WAL00000042');
  });

  test('sin idToken (no se pudo determinar quién eres en Firestore): el login sigue funcionando, simplemente no vincula nada', async () => {
    odooLoginOk('WAL00000099');
    const formData = new FormData();
    formData.set('email', 'ana@example.com');
    formData.set('password', 'Clave-Segura-12345');
    const r = await loginAction(formData);
    expect(r.success).toBe(true); // no lanza ni falla el login por esto
  });

  test('un idToken de otra persona nunca vincula la cuenta al UID equivocado', async () => {
    const legitimo = await crearUsuarioAuth('login-legit');
    odooLoginOk('WAL00000077');
    const formData = new FormData();
    formData.set('email', 'x@example.com');
    formData.set('password', 'Clave-Segura-12345');
    formData.set('firebaseIdToken', 'token-falso-o-vencido');
    const r = await loginAction(formData);
    expect(r.success).toBe(true); // el login en sí no depende de este token
    expect((await getDoc(doc(db, 'usuarios', legitimo.uid))).data()?.walletAccount).toBeUndefined();
  });
});
