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

function debitorOdoo(uid: string, tokenBilletera: string): DebitarBilletera {
  return async (llave, monto) =>
    clasificarRespuestaMovimiento(
      await llamarBilleteraOdoo(
        '/api/wallet/platform-load',
        { amount: monto, firebase_uid: uid, platform: 'inversiones_pro', idempotency_key: llave },
        tokenBilletera
      )
    );
}

/**
 * Carga saldo a la plataforma debitando la billetera Odoo del usuario.
 * Todo el puente (débito en Odoo + crédito en Firestore) ocurre acá, en el
 * servidor, con registro previo e idempotencia. Ver procesarCargaPlataforma.
 */
export async function cargarAPlataformaAction(idToken: string, monto: number): Promise<ResultadoAccionSaldo> {
  const id = await uidVerificado(idToken);
  if ('error' in id) return { ok: false, mensaje: id.error };

  const validacion = validarMonto(monto, CARGA_MINIMA);
  if (!validacion.ok) return { ok: false, mensaje: validacion.error };

  const tokenBilletera = cookies().get(COOKIE_SESION_BILLETERA)?.value;
  if (!tokenBilletera) return { ok: false, mensaje: 'No autenticado en la billetera. Conéctala primero.' };

  const llave = `PLAT-${id.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return aRespuestaCarga(
    await procesarCargaPlataforma({
      uid: id.uid,
      llave,
      monto: validacion.monto,
      debitar: debitorOdoo(id.uid, tokenBilletera),
    })
  );
}

/**
 * Retoma una carga que quedó a medias (Odoo pudo haber debitado pero falta
 * acreditar). Es seguro llamarla varias veces: usa la misma llave de
 * idempotencia y el monto GUARDADO en el registro, nunca uno enviado ahora.
 */
export async function completarCargaPendienteAction(idToken: string, llave: string): Promise<ResultadoAccionSaldo> {
  const id = await uidVerificado(idToken);
  if ('error' in id) return { ok: false, mensaje: id.error };

  if (typeof llave !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(llave)) {
    return { ok: false, mensaje: 'Código de recuperación inválido.' };
  }

  const tokenBilletera = cookies().get(COOKIE_SESION_BILLETERA)?.value;
  if (!tokenBilletera) return { ok: false, mensaje: 'No autenticado en la billetera. Conéctala primero.' };

  return aRespuestaCarga(
    await procesarCargaPlataforma({
      uid: id.uid,
      llave,
      monto: 0, // se ignora: se usa el monto guardado en el registro
      soloExistente: true,
      debitar: debitorOdoo(id.uid, tokenBilletera),
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
