'use server';

/**
 * SERVER ACTIONS — SALDO INTERNO DE LA PLATAFORMA
 *
 * Reemplazan todo lo que antes movía `usuarios.saldo` desde el navegador
 * (Validacion/acreditarDesdeBilletera.ts, el "modo demo" de recargar, la
 * transferencia "legacy" y el retiro "demo"). Cada acción verifica el ID
 * token del usuario con Admin SDK — la identidad NUNCA viene de un parámetro
 * que el cliente pueda falsificar — y delega en lib/plataforma-saldo.ts, que
 * hace el trabajo en transacciones de Firestore.
 *
 * Con esto `saldo` y `saldoRecaudado` pasan a ser de solo-servidor en
 * firestore.rules.
 */

import { cookies } from 'next/headers';
import { verificarIdToken, mensajeErrorVerificacion } from '@/lib/firebase/admin';
import {
  clasificarRespuestaMovimiento,
  COOKIE_SESION_BILLETERA,
  llamarBilleteraOdoo,
} from '@/lib/odoo-wallet';
import {
  acreditarSaldoDemo,
  CARGA_MINIMA,
  debitarSaldoDemoBanco,
  procesarCargaPlataforma,
  transferirSaldoEntreUsuarios,
  validarMonto,
  type DebitarBilletera,
  type ResultadoCarga,
} from '@/lib/plataforma-saldo';
import { configBanco } from '@/lib/wallet-signature';

const RE_PIN = /^\d{4,6}$/;

/** Código de plataforma tal como está registrado en el banco (wallet.platform.code). Único punto de la verdad: el
 * mismo valor lo usa el pago (payout, firmado) en app/actions/wallet.ts. */
function codigoPlataforma(): string {
  return configBanco()?.codigo || 'inversiones_pro';
}

export interface ResultadoAccionSaldo {
  ok: boolean;
  mensaje: string;
  nuevoSaldo?: number;
  yaAplicada?: boolean;
  /** Carga a medio hacer: el cliente debe reintentar con `llave` (completarCargaPendienteAction). */
  pendiente?: boolean;
  llave?: string;
}

async function uidVerificado(idToken: string): Promise<{ uid: string } | { error: string }> {
  try {
    const decoded = await verificarIdToken(idToken);
    return { uid: decoded.uid };
  } catch (error) {
    return { error: mensajeErrorVerificacion(error) };
  }
}

function aRespuestaCarga(r: ResultadoCarga): ResultadoAccionSaldo {
  if (r.ok) {
    return {
      ok: true,
      nuevoSaldo: r.nuevoSaldo,
      yaAplicada: r.yaAplicada,
      mensaje: r.yaAplicada ? 'Esta carga ya había sido aplicada.' : '¡Saldo cargado a la plataforma!',
    };
  }
  return { ok: false, mensaje: r.error, pendiente: r.pendiente, llave: r.llave };
}

/**
 * Débito en la billetera del USUARIO (no en la del banco): usa /api/wallet/platform/deposit, con el token del propio
 * usuario y su PIN. Reemplaza al endpoint retirado /api/wallet/platform-load (que debitaba sin PIN y sin que el
 * banco supiera qué plataforma lo pedía de forma verificable).
 */
function debitorOdoo(tokenBilletera: string, pin: string): DebitarBilletera {
  return async (llave, monto) =>
    clasificarRespuestaMovimiento(
      await llamarBilleteraOdoo(
        '/api/wallet/platform/deposit',
        { platform: codigoPlataforma(), amount: monto, idempotency_key: llave, pin, description: 'Carga a Inversiones Pro' },
        tokenBilletera
      )
    );
}

/**
 * Carga saldo a la plataforma debitando la billetera Odoo del usuario.
 * Todo el puente (débito en Odoo + crédito en Firestore) ocurre acá, en el
 * servidor, con registro previo e idempotencia. Ver procesarCargaPlataforma.
 */
export async function cargarAPlataformaAction(idToken: string, monto: number, pin: string): Promise<ResultadoAccionSaldo> {
  const id = await uidVerificado(idToken);
  if ('error' in id) return { ok: false, mensaje: id.error };

  const validacion = validarMonto(monto, CARGA_MINIMA);
  if (!validacion.ok) return { ok: false, mensaje: validacion.error };

  if (typeof pin !== 'string' || !RE_PIN.test(pin)) {
    return { ok: false, mensaje: 'Ingresa tu clave de la billetera (4 a 6 dígitos).' };
  }

  const tokenBilletera = cookies().get(COOKIE_SESION_BILLETERA)?.value;
  if (!tokenBilletera) return { ok: false, mensaje: 'No autenticado en la billetera. Conéctala primero.' };

  const llave = `PLAT-${id.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return aRespuestaCarga(
    await procesarCargaPlataforma({
      uid: id.uid,
      llave,
      monto: validacion.monto,
      debitar: debitorOdoo(tokenBilletera, pin),
    })
  );
}

/**
 * Retoma una carga que quedó a medias (Odoo pudo haber debitado pero falta
 * acreditar). Es seguro llamarla varias veces: usa la misma llave de
 * idempotencia y el monto GUARDADO en el registro, nunca uno enviado ahora.
 * El banco valida el PIN en cada llamada (incluso en un reintento idempotente), así que hay que volver a pedirlo.
 */
export async function completarCargaPendienteAction(idToken: string, llave: string, pin: string): Promise<ResultadoAccionSaldo> {
  const id = await uidVerificado(idToken);
  if ('error' in id) return { ok: false, mensaje: id.error };

  if (typeof llave !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(llave)) {
    return { ok: false, mensaje: 'Código de recuperación inválido.' };
  }
  if (typeof pin !== 'string' || !RE_PIN.test(pin)) {
    return { ok: false, mensaje: 'Ingresa tu clave de la billetera (4 a 6 dígitos).' };
  }

  const tokenBilletera = cookies().get(COOKIE_SESION_BILLETERA)?.value;
  if (!tokenBilletera) return { ok: false, mensaje: 'No autenticado en la billetera. Conéctala primero.' };

  return aRespuestaCarga(
    await procesarCargaPlataforma({
      uid: id.uid,
      llave,
      monto: 0, // se ignora: se usa el monto guardado en el registro
      soloExistente: true,
      debitar: debitorOdoo(tokenBilletera, pin),
    })
  );
}

/** Transferencia de saldo de plataforma entre dos usuarios. `llave` = UUID del intento (anti doble envío). */
export async function transferirEntreUsuariosAction(
  idToken: string,
  destinatarioEmail: string,
  monto: number,
  llave?: string
): Promise<ResultadoAccionSaldo> {
  const id = await uidVerificado(idToken);
  if ('error' in id) return { ok: false, mensaje: id.error };

  const r = await transferirSaldoEntreUsuarios({ origenUid: id.uid, destinatarioEmail, monto, llave });
  if (!r.ok) return { ok: false, mensaje: r.error };
  return {
    ok: true,
    nuevoSaldo: r.nuevoSaldoOrigen,
    yaAplicada: r.yaAplicada,
    mensaje: r.yaAplicada ? 'Esta transferencia ya había sido aplicada.' : 'Transferencia exitosa',
  };
}

/** Saldo demo (sin billetera). Solo funciona si el servidor tiene PLATAFORMA_MODO_DEMO=true. */
export async function recargaDemoAction(idToken: string, monto: number): Promise<ResultadoAccionSaldo> {
  const id = await uidVerificado(idToken);
  if ('error' in id) return { ok: false, mensaje: id.error };

  const r = await acreditarSaldoDemo({ uid: id.uid, monto });
  return r.ok ? { ok: true, nuevoSaldo: r.nuevoSaldo, mensaje: 'Saldo demo añadido' } : { ok: false, mensaje: r.error };
}

/** Retiro "a banco" demo (sin billetera). Solo funciona si el servidor tiene PLATAFORMA_MODO_DEMO=true. */
export async function retiroDemoBancoAction(idToken: string, monto: number): Promise<ResultadoAccionSaldo> {
  const id = await uidVerificado(idToken);
  if ('error' in id) return { ok: false, mensaje: id.error };

  const r = await debitarSaldoDemoBanco({ uid: id.uid, monto });
  return r.ok ? { ok: true, nuevoSaldo: r.nuevoSaldo, mensaje: 'Retiro exitoso' } : { ok: false, mensaje: r.error };
}
