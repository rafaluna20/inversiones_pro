/**
 * Cliente HTTP de la billetera Odoo (wallet_digital) — SOLO código de servidor.
 *
 * Vive fuera de app/actions/wallet.ts porque los archivos 'use server' solo
 * pueden exportar Server Actions (funciones async invocables desde el
 * navegador); este helper no debe ser invocable desde el cliente.
 *
 * Clasifica el resultado de una llamada de MOVIMIENTO DE DINERO en tres casos,
 * porque quien la usa necesita distinguirlos para no perder ni duplicar saldo:
 *
 *  - 'ok'            → Odoo confirmó la operación (`result.success === true`).
 *  - 'rechazada'     → Odoo respondió `success: false`: la operación NO se
 *                      aplicó (saldo insuficiente, límite diario, etc.). Es
 *                      seguro dar la operación por fallida.
 *  - 'indeterminado' → error de red, timeout, respuesta rara o error JSON-RPC.
 *                      No se sabe si Odoo la aplicó o no: NUNCA darla por
 *                      fallida; hay que reintentar con la MISMA clave de
 *                      idempotencia para que Odoo resuelva el duplicado.
 */

export const COOKIE_SESION_BILLETERA = 'billetera_session';

const TIMEOUT_MS = 15_000;

export interface RespuestaOdoo {
  result?: any;
  error?: {
    message: string;
    data?: { message: string };
  };
}

/** JSON-RPC crudo contra un endpoint de wallet_digital, con el token Bearer del usuario. */
export async function llamarBilleteraOdoo(
  endpoint: string,
  params: Record<string, unknown>,
  token: string
): Promise<RespuestaOdoo> {
  if (typeof window !== 'undefined') {
    throw new Error('lib/odoo-wallet.ts no debe importarse en código de cliente.');
  }

  const baseUrl = process.env.NEXT_PUBLIC_WALLET_API_URL || '';
  const db = process.env.NEXT_PUBLIC_ODOO_DB || 'odoo_akallpav1';

  if (!baseUrl) {
    console.error('[Odoo] NEXT_PUBLIC_WALLET_API_URL no está configurada en las variables de entorno.');
    return { error: { message: 'Servicio de billetera no configurado. Contacta al administrador.' } };
  }

  // Timeout para que la UI no quede colgada esperando a Odoo.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${endpoint}?db=${db}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params,
        id: Math.floor(Math.random() * 1000),
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    return (await response.json()) as RespuestaOdoo;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error(`Odoo Timeout [${endpoint}]: la solicitud tardó más de ${TIMEOUT_MS / 1000} segundos`);
      return { error: { message: 'El servidor tardó demasiado en responder. Intenta de nuevo.' } };
    }
    console.error(`Odoo Transaction Error [${endpoint}]:`, error);
    return { error: { message: 'Error de conexión con el servidor' } };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type ResultadoMovimientoOdoo =
  | { estado: 'ok'; transactionId: string; monto: number; nuevoSaldo?: number }
  | { estado: 'rechazada'; mensaje: string }
  | { estado: 'indeterminado'; mensaje: string };

/** Interpreta la respuesta de un endpoint de movimiento (platform-load / platform-withdraw). */
export function clasificarRespuestaMovimiento(respuesta: RespuestaOdoo): ResultadoMovimientoOdoo {
  // Error de red / timeout / JSON-RPC: no sabemos si Odoo llegó a aplicarlo.
  if (respuesta.error || !respuesta.result || typeof respuesta.result !== 'object') {
    return {
      estado: 'indeterminado',
      mensaje: respuesta.error?.data?.message || respuesta.error?.message || 'Respuesta inesperada de la billetera',
    };
  }

  const r = respuesta.result;

  if (r.success === true) {
    const transactionId = r.transaction_id;
    const monto = Number(r.amount);
    if (typeof transactionId !== 'string' || !transactionId || !Number.isFinite(monto)) {
      // Odoo dijo "ok" pero sin los datos para rastrearlo: tratarlo como
      // indeterminado, jamás como éxito ni como fallo.
      return { estado: 'indeterminado', mensaje: 'La billetera confirmó sin datos de la transacción' };
    }
    return { estado: 'ok', transactionId, monto, nuevoSaldo: typeof r.new_balance === 'number' ? r.new_balance : undefined };
  }

  if (r.success === false) {
    return { estado: 'rechazada', mensaje: typeof r.error === 'string' && r.error ? r.error : 'La billetera rechazó la operación' };
  }

  return { estado: 'indeterminado', mensaje: 'Respuesta inesperada de la billetera' };
}
