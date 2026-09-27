/**
 * Firma de servidor con el banco (wallet_digital) — SOLO código de servidor.
 *
 * Para /api/wallet/platform/payout y /api/wallet/platform/statement, el banco no acepta el token de un usuario: exige
 * que la PLATAFORMA (esta app) firme la petición con un secreto compartido, para que solo Inversiones Pro pueda mover
 * dinero de SU cuenta hacia un usuario (nunca al revés: eso lo hace /platform/deposit, con el token del usuario).
 *
 * Misma firma que usan todas las plataformas del banco: HMAC-SHA256 hex de "<timestamp>\n<ruta>\n<sha256(cuerpo)>".
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface ConfigBanco {
  url: string;
  db?: string;
  codigo: string;
  secreto: string;
}

export function configBanco(env: Record<string, string | undefined> = process.env): ConfigBanco | null {
  const url = env.NEXT_PUBLIC_WALLET_API_URL?.trim().replace(/\/+$/, '');
  const codigo = env.WALLET_PLATFORM_CODE?.trim();
  const secreto = env.WALLET_PLATFORM_SECRET?.trim();
  if (!url || !codigo || !secreto) return null;
  return { url, codigo, secreto, db: env.NEXT_PUBLIC_ODOO_DB?.trim() || undefined };
}

export function firmar(secreto: string, timestamp: number, ruta: string, cuerpo: string | Buffer): string {
  const digest = createHash('sha256').update(cuerpo).digest('hex');
  return createHmac('sha256', secreto).update(`${timestamp}\n${ruta}\n${digest}`).digest('hex');
}

const VENTANA_FIRMA_SEG = 300;

/**
 * Contraparte de `firmar` para las peticiones que el BANCO le hace a ESTA plataforma (p. ej. /api/inv/banco/resumen):
 * cierto solo si `firma` es la que produce `firmar` con `secreto` y la hora está dentro de la ventana (±5 min).
 * Compara en tiempo constante para no filtrar el secreto por temporización.
 */
export function verificarFirma(
  secreto: string, timestamp: string | number | null | undefined, ruta: string, cuerpo: string | Buffer,
  firma: string | null | undefined, ahora: number, ventana: number = VENTANA_FIRMA_SEG
): boolean {
  const ts = Number(timestamp);
  if (!secreto || !Number.isFinite(ts) || typeof firma !== 'string' || !firma || Math.abs(ahora - ts) > ventana) {
    return false;
  }
  const esperada = Buffer.from(firmar(secreto, ts, ruta, cuerpo));
  const recibida = Buffer.from(firma.toLowerCase());
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

export interface RespuestaBanco {
  result?: any;
  error?: { message: string; data?: { message: string } };
}

/**
 * Llama a un endpoint de servidor del banco (payout, statement), firmado con el secreto de ESTA plataforma.
 * Nunca se invoca desde el navegador: el secreto no debe salir de este proceso.
 */
export async function llamarBancoFirmado(
  ruta: string,
  params: Record<string, unknown>,
  config: ConfigBanco | null = configBanco(),
  fetchFn: typeof fetch = fetch,
  ahora: () => number = Date.now
): Promise<RespuestaBanco> {
  if (typeof window !== 'undefined') {
    throw new Error('lib/wallet-signature.ts no debe importarse en código de cliente.');
  }
  if (!config) {
    return { error: { message: 'Conexión con el banco no configurada (WALLET_PLATFORM_CODE / WALLET_PLATFORM_SECRET).' } };
  }
  const cuerpo = JSON.stringify({ jsonrpc: '2.0', method: 'call', params, id: Math.floor(Math.random() * 1000) });
  const ts = Math.floor(ahora() / 1000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const url = `${config.url}${ruta}${config.db ? `?db=${encodeURIComponent(config.db)}` : ''}`;
    const respuesta = await fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-platform': config.codigo,
        'x-wallet-timestamp': String(ts),
        'x-wallet-signature': firmar(config.secreto, ts, ruta, cuerpo),
      },
      body: cuerpo,
      cache: 'no-store',
      signal: controller.signal,
    });
    return (await respuesta.json()) as RespuestaBanco;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { error: { message: 'El banco tardó demasiado en responder. Intenta de nuevo.' } };
    }
    console.error(`Banco (firmado) Error [${ruta}]:`, error);
    return { error: { message: 'Error de conexión con el banco' } };
  } finally {
    clearTimeout(timeoutId);
  }
}
