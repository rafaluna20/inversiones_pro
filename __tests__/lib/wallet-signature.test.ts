/**
 * @jest-environment node
 */

/**
 * Firma de servidor con el banco: mismo HMAC que usan todas las plataformas del ecosistema (control-app, wallet_digital,
 * utility_payment). El vector de prueba es compartido con ellas: si aquí da el mismo hash, la firma es interoperable.
 */
import { configBanco, firmar, llamarBancoFirmado } from '@/lib/wallet-signature';

describe('firmar (vector compartido con el resto del ecosistema)', () => {
  test('HMAC-SHA256 de "<timestamp>\\n<ruta>\\n<sha256(cuerpo)>"', () => {
    const cuerpo = '{"jsonrpc":"2.0","method":"call","params":{"account_number":"WAL00000001"}}';
    expect(firmar('secreto-de-prueba-compartido', 1790000000, '/api/inv/banco/resumen', cuerpo)).toBe(
      'f3ded845a6ea19e6794b8e1a9514c1d3b39e7ecdededec9038ed2a805bd7dbd9'
    );
  });

  test('cambia con el secreto, la ruta o el cuerpo', () => {
    const base = firmar('secreto', 1000, '/a', 'x');
    expect(firmar('otro-secreto', 1000, '/a', 'x')).not.toBe(base);
    expect(firmar('secreto', 1000, '/b', 'x')).not.toBe(base);
    expect(firmar('secreto', 1000, '/a', 'y')).not.toBe(base);
  });
});

describe('configBanco', () => {
  test('exige URL, código y secreto de la plataforma', () => {
    expect(configBanco({
      NEXT_PUBLIC_WALLET_API_URL: 'https://banco.example.com/',
      WALLET_PLATFORM_CODE: 'inversiones_pro',
      WALLET_PLATFORM_SECRET: 's',
    })).toEqual({ url: 'https://banco.example.com', codigo: 'inversiones_pro', secreto: 's', db: undefined });
    expect(configBanco({ NEXT_PUBLIC_WALLET_API_URL: 'https://banco.example.com' })).toBeNull();
    expect(configBanco({})).toBeNull();
  });
});

describe('llamarBancoFirmado', () => {
  const config = { url: 'https://banco.example.com', codigo: 'inversiones_pro', secreto: 'secreto-de-prueba-compartido' };
  const respuesta = (cuerpo: unknown, ok = true) => ({ ok, json: async () => cuerpo }) as Response;

  test('firma con la ruta exacta y el cuerpo exacto que se envía', async () => {
    const fetchFalso = jest.fn().mockResolvedValue(respuesta({ result: { success: true } }));
    await llamarBancoFirmado('/api/wallet/platform/payout', { account_number: 'WAL00000001' }, config, fetchFalso, () => 1790000000_000);
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://banco.example.com/api/wallet/platform/payout');
    expect(JSON.parse(opciones.body).params).toEqual({ account_number: 'WAL00000001' });
    expect(opciones.headers['x-wallet-platform']).toBe('inversiones_pro');
    expect(opciones.headers['x-wallet-timestamp']).toBe('1790000000');
    expect(opciones.headers['x-wallet-signature']).toBe(
      firmar('secreto-de-prueba-compartido', 1790000000, '/api/wallet/platform/payout', opciones.body)
    );
  });

  test('agrega la base de datos cuando se configura', async () => {
    const fetchFalso = jest.fn().mockResolvedValue(respuesta({ result: { success: true } }));
    await llamarBancoFirmado('/api/wallet/platform/payout', {}, { ...config, db: 'mi base' }, fetchFalso);
    expect(fetchFalso.mock.calls[0][0]).toBe('https://banco.example.com/api/wallet/platform/payout?db=mi%20base');
  });

  test('sin configuración no llama al banco', async () => {
    const fetchFalso = jest.fn();
    const r = await llamarBancoFirmado('/api/wallet/platform/payout', {}, null, fetchFalso);
    expect(r).toEqual({ error: { message: expect.stringContaining('no configurada') } });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  test('falla de red o timeout no lanza: se reporta como error', async () => {
    const fetchFalso = jest.fn().mockRejectedValue(new Error('caída'));
    const r = await llamarBancoFirmado('/api/wallet/platform/payout', {}, config, fetchFalso);
    expect(r.error?.message).toBeTruthy();
  });
});
