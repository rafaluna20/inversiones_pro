/**
 * MOVIMIENTOS DEL SALDO INTERNO DE LA PLATAFORMA (`usuarios.saldo`) — SOLO servidor.
 *
 * Toda operación que sube o baja `usuarios.saldo` y que NO sea invertir /
 * liquidar (esas viven en app/actions/inversion.ts y distribucion.ts) pasa
 * por acá, con Admin SDK y dentro de transacciones de Firestore.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO: antes estas operaciones corrían en el
 * NAVEGADOR (Validacion/acreditarDesdeBilletera.ts, el "modo demo" de
 * recargar, la transferencia "legacy", el retiro "demo"), y para que
 * funcionaran firestore.rules permitía que cada usuario escribiera su propio
 * `saldo`. Resultado: cualquier inversionista podía fijarse el saldo que
 * quisiera desde la consola del navegador y retirarlo a su billetera. Ahora
 * `saldo` y `saldoRecaudado` son de solo-servidor (ver firestore.rules) y el
 * cliente solo pide operaciones; el servidor decide.
 *
 * Las funciones reciben `db` y (para la carga) el "debitor" de Odoo como
 * parámetros para poder probarlas contra el emulador de Firestore con un
 * Odoo falso, sin cookies ni red.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { ResultadoMovimientoOdoo } from '@/lib/odoo-wallet';

// ─── Límites ───────────────────────────────────────────────────────────────

export const CARGA_MINIMA = 10;
export const MONTO_MAXIMO_OPERACION = 1_000_000;
export const MONTO_MAXIMO_DEMO = 10_000;

/** Tiempo durante el cual una carga "en proceso" no puede ser tomada por otra solicitud. */
const LEASE_CARGA_MS = 60_000;

// ─── Utilidades ────────────────────────────────────────────────────────────

/** Redondea a 2 decimales (céntimos). */
export function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ValidacionMonto = { ok: true; monto: number } | { ok: false; error: string };

/**
 * Valida un monto que llegó del cliente: número finito, hasta 2 decimales y
 * dentro de [min, max]. Nunca confiar en la validación del formulario: un
 * cliente modificado puede mandar negativos, NaN o Infinity.
 */
export function validarMonto(
  valor: unknown,
  min: number = 0.01,
  max: number = MONTO_MAXIMO_OPERACION
): ValidacionMonto {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return { ok: false, error: 'Monto inválido.' };
  }
  const centavos = Math.round(valor * 100);
  if (Math.abs(valor * 100 - centavos) > 1e-6) {
    return { ok: false, error: 'El monto solo admite hasta 2 decimales.' };
  }
  const monto = centavos / 100;
  if (monto < min) {
    return { ok: false, error: `El monto mínimo es S/ ${min.toFixed(2)}.` };
  }
  if (monto > max) {
    return { ok: false, error: `El monto máximo por operación es S/ ${max.toLocaleString('es-PE')}.` };
  }
  return { ok: true, monto };
}

/** ¿Está habilitado el modo demo (saldo de mentira sin pasar por la billetera)? Solo por variable de entorno del servidor. */
export function modoDemoHabilitado(): boolean {
  return process.env.PLATAFORMA_MODO_DEMO === 'true';
}

const isoAhora = (ms: number = Date.now()) => new Date(ms).toISOString();

// ─── Carga a la plataforma (billetera Odoo → saldo de plataforma) ──────────

/** Función que pide a Odoo debitar la billetera del usuario, idempotente por `llave`. */
export type DebitarBilletera = (llave: string, monto: number) => Promise<ResultadoMovimientoOdoo>;

export type ResultadoCarga =
  | { ok: true; yaAplicada: boolean; nuevoSaldo: number; odooTransactionId?: string }
  | {
      ok: false;
      error: string;
      /**
       * true = no se sabe si Odoo debitó o si falta acreditar: el cliente debe
       * reintentar con la misma `llave` (completarCargaPendienteAction), NO
       * iniciar una carga nueva.
       */
      pendiente?: boolean;
      llave?: string;
    };

interface ParamsCarga {
  db?: Firestore;
  uid: string;
  llave: string;
  /** Monto solicitado. Si la carga ya existe se usa el monto guardado en el registro, no este. */
  monto: number;
  debitar: DebitarBilletera;
  /** true = solo retomar una carga ya registrada (recuperación); nunca crear una nueva. */
  soloExistente?: boolean;
  ahoraMs?: number;
}

type Reserva =
  | { tipo: 'reservada'; monto: number }
  | { tipo: 'aplicada'; saldo: number; odooTx?: string }
  | { tipo: 'fallida'; mensaje: string }
  | { tipo: 'ocupada' }
  | { tipo: 'inexistente' }
  | { tipo: 'ajena' };

/**
 * Carga saldo a la plataforma debitando la billetera Odoo, sin perder ni
 * duplicar dinero ante caídas, reintentos o doble clic:
 *
 *  1. Reserva un registro `plataforma_cargas/{llave}` en estado 'pending'
 *     ANTES de tocar Odoo (con una "reserva" de 60 s para que dos solicitudes
 *     simultáneas con la misma llave no debiten dos veces).
 *  2. Pide el débito a Odoo con esa misma llave (Odoo la usa de idempotencia).
 *  3. Si Odoo confirma, en UNA transacción acredita `saldo` y marca el
 *     registro 'completed'. Si Odoo rechaza, lo marca 'failed'. Si no se
 *     sabe (red/timeout), lo deja 'pending' para reintentar.
 */
export async function procesarCargaPlataforma(p: ParamsCarga): Promise<ResultadoCarga> {
  const db = p.db ?? getAdminDb();
  const cargaRef = db.collection('plataforma_cargas').doc(p.llave);
  const usuarioRef = db.collection('usuarios').doc(p.uid);
  const ahora = p.ahoraMs ?? Date.now();

  // ── 1. Reservar ──────────────────────────────────────────────────────────
  const reserva = await db.runTransaction<Reserva>(async (tx) => {
    const snap = await tx.get(cargaRef);

    if (!snap.exists) {
      if (p.soloExistente) return { tipo: 'inexistente' };
      tx.set(cargaRef, {
        firebase_uid: p.uid,
        amount: p.monto,
        status: 'pending',
        plataforma: 'inversiones_pro',
        fecha_inicio: isoAhora(ahora),
        en_proceso_hasta: ahora + LEASE_CARGA_MS,
      });
      return { tipo: 'reservada', monto: p.monto };
    }

    const d = snap.data()!;
    if (d.firebase_uid !== p.uid) return { tipo: 'ajena' };

    // Sin `status` = registro anterior a este flujo (el cliente lo escribía
    // ya acreditado): se considera aplicado.
    if (d.status === undefined || d.status === 'completed') {
      return { tipo: 'aplicada', saldo: d.saldo_resultante, odooTx: d.odoo_transaction_id };
    }
    if (d.status === 'failed') {
      return { tipo: 'fallida', mensaje: d.razon_fallo || 'La carga fue rechazada.' };
    }

    // status === 'pending'
    if (typeof d.en_proceso_hasta === 'number' && d.en_proceso_hasta > ahora) {
      return { tipo: 'ocupada' };
    }
    tx.update(cargaRef, { en_proceso_hasta: ahora + LEASE_CARGA_MS });
    return { tipo: 'reservada', monto: Number(d.amount) };
  });

  if (reserva.tipo === 'inexistente') {
    return { ok: false, error: 'No se encontró esa carga.' };
  }
  if (reserva.tipo === 'ajena') {
    return { ok: false, error: 'No autorizado para esta carga.' };
  }
  if (reserva.tipo === 'aplicada') {
    return { ok: true, yaAplicada: true, nuevoSaldo: reserva.saldo, odooTransactionId: reserva.odooTx };
  }
  if (reserva.tipo === 'fallida') {
    return { ok: false, error: reserva.mensaje };
  }
  if (reserva.tipo === 'ocupada') {
    return {
      ok: false,
      error: 'Esta carga ya se está procesando. Espera unos segundos y verifica tu saldo.',
      pendiente: true,
      llave: p.llave,
    };
  }

  const montoReservado = reserva.monto;

  // ── 2. Débito en Odoo ────────────────────────────────────────────────────
  let movimiento: ResultadoMovimientoOdoo;
  try {
    movimiento = await p.debitar(p.llave, montoReservado);
  } catch (error: any) {
    movimiento = { estado: 'indeterminado', mensaje: error?.message || 'Error al contactar la billetera' };
  }

  // ── 3a. Odoo rechazó: la operación NO se aplicó ─────────────────────────
  if (movimiento.estado === 'rechazada') {
    const razon = movimiento.mensaje;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(cargaRef);
      if (snap.exists && snap.data()!.status === 'pending') {
        tx.update(cargaRef, {
          status: 'failed',
          razon_fallo: razon,
          fecha_fallo: isoAhora(),
          en_proceso_hasta: 0,
        });
      }
    });
    return { ok: false, error: razon };
  }

  // ── 3b. No se sabe si Odoo debitó: dejar 'pending' y liberar la reserva ──
  if (movimiento.estado === 'indeterminado') {
    const detalle = movimiento.mensaje;
    await db
      .runTransaction(async (tx) => {
        const snap = await tx.get(cargaRef);
        if (snap.exists && snap.data()!.status === 'pending') {
          tx.update(cargaRef, { en_proceso_hasta: 0, ultimo_error: detalle });
        }
      })
      .catch(() => undefined);
    return {
      ok: false,
      error: 'No pudimos confirmar la carga con tu billetera. No se perdió dinero: vuelve a intentar.',
      pendiente: true,
      llave: p.llave,
    };
  }

  // ── 3c. Odoo debitó: acreditar saldo + cerrar el registro, atómico ───────
  const debitado = movimiento; // ya estrechado a estado 'ok'
  try {
    return await db.runTransaction<ResultadoCarga>(async (tx) => {
      const [cargaSnap, usuarioSnap] = await Promise.all([tx.get(cargaRef), tx.get(usuarioRef)]);

      const carga = cargaSnap.data();
      if (carga && carga.status === 'completed') {
        return { ok: true, yaAplicada: true, nuevoSaldo: carga.saldo_resultante, odooTransactionId: carga.odoo_transaction_id };
      }

      if (!usuarioSnap.exists) {
        // El dinero ya salió de la billetera pero no hay perfil donde acreditarlo:
        // se deja 'pending' con el dato de Odoo para resolverlo a mano.
        tx.update(cargaRef, {
          en_proceso_hasta: 0,
          odoo_transaction_id: debitado.transactionId,
          ultimo_error: 'usuario_sin_perfil',
        });
        return {
          ok: false,
          error: 'Tu perfil de plataforma no existe; contacta al administrador con el código de tu carga.',
          pendiente: true,
          llave: p.llave,
        };
      }

      const saldoAnterior = Number(usuarioSnap.data()!.saldo || 0);
      const nuevoSaldo = redondear2(saldoAnterior + debitado.monto);

      tx.update(usuarioRef, { saldo: nuevoSaldo });
      tx.update(cargaRef, {
        status: 'completed',
        amount_credited: debitado.monto,
        odoo_transaction_id: debitado.transactionId,
        saldo_anterior: saldoAnterior,
        saldo_resultante: nuevoSaldo,
        fecha: isoAhora(),
        fecha_completado: isoAhora(),
        en_proceso_hasta: 0,
      });

      return { ok: true, yaAplicada: false, nuevoSaldo, odooTransactionId: debitado.transactionId };
    });
  } catch (error) {
    // Odoo ya debitó pero Firestore falló: queda 'pending' (la reserva vence
    // sola en 60 s) y el cliente puede reintentar con la misma llave.
    console.error(`[Carga] Odoo debitó pero no se pudo acreditar. Llave=${p.llave}`, error);
    return {
      ok: false,
      error: 'Tu billetera fue debitada pero no pudimos acreditar la plataforma todavía. Reintenta con tu código de recuperación.',
      pendiente: true,
      llave: p.llave,
    };
  }
}

// ─── Transferencia entre usuarios de la plataforma ─────────────────────────

export type ResultadoTransferencia =
  | { ok: true; yaAplicada: boolean; nuevoSaldoOrigen: number }
  | { ok: false; error: string };

interface ParamsTransferencia {
  db?: Firestore;
  origenUid: string;
  destinatarioEmail: string;
  monto: number;
  /** Identificador único del intento (UUID del formulario): evita duplicar por doble clic o reintento. */
  llave?: string;
}

export async function transferirSaldoEntreUsuarios(p: ParamsTransferencia): Promise<ResultadoTransferencia> {
  const validacion = validarMonto(p.monto);
  if (!validacion.ok) return { ok: false, error: validacion.error };
  const monto = validacion.monto;

  const email = typeof p.destinatarioEmail === 'string' ? p.destinatarioEmail.trim() : '';
  if (!email.includes('@')) return { ok: false, error: 'Ingresa un email válido del destinatario.' };

  if (p.llave !== undefined && !/^[A-Za-z0-9_-]{8,64}$/.test(p.llave)) {
    return { ok: false, error: 'Identificador de operación inválido.' };
  }

  const db = p.db ?? getAdminDb();
  const usuarios = db.collection('usuarios');

  // Buscar al destinatario (el email se guarda tal cual lo escribió el usuario).
  const candidatos = new Set<string>([email.toLowerCase(), email]);
  let destinoUid: string | null = null;
  for (const candidato of candidatos) {
    const snap = await usuarios.where('email', '==', candidato).limit(2).get();
    if (snap.size > 1) return { ok: false, error: 'El correo del destinatario es ambiguo. Contacta al administrador.' };
    if (snap.size === 1) {
      destinoUid = snap.docs[0].id;
      break;
    }
  }
  if (!destinoUid) return { ok: false, error: 'Usuario destinatario no encontrado.' };
  if (destinoUid === p.origenUid) return { ok: false, error: 'No puedes transferir a ti mismo.' };

  const origenRef = usuarios.doc(p.origenUid);
  const destinoRef = usuarios.doc(destinoUid);
  const transferenciaRef = p.llave
    ? db.collection('plataforma_transferencias').doc(`TRF-${p.origenUid}-${p.llave}`)
    : db.collection('plataforma_transferencias').doc();

  return db.runTransaction<ResultadoTransferencia>(async (tx) => {
    const [transferSnap, origenSnap, destinoSnap] = await Promise.all([
      tx.get(transferenciaRef),
      tx.get(origenRef),
      tx.get(destinoRef),
    ]);

    if (transferSnap.exists) {
      return { ok: true, yaAplicada: true, nuevoSaldoOrigen: Number(transferSnap.data()!.saldo_origen_resultante) };
    }
    if (!origenSnap.exists) return { ok: false, error: 'Tu perfil de plataforma no existe.' };
    if (!destinoSnap.exists) return { ok: false, error: 'Usuario destinatario no encontrado.' };

    const saldoOrigen = Number(origenSnap.data()!.saldo || 0);
    const saldoDestino = Number(destinoSnap.data()!.saldo || 0);

    if (saldoOrigen < monto) return { ok: false, error: 'Saldo insuficiente.' };

    const nuevoOrigen = redondear2(saldoOrigen - monto);
    const nuevoDestino = redondear2(saldoDestino + monto);

    tx.update(origenRef, { saldo: nuevoOrigen });
    tx.update(destinoRef, { saldo: nuevoDestino });
    tx.set(transferenciaRef, {
      origen_uid: p.origenUid,
      destino_uid: destinoUid,
      monto,
      saldo_origen_resultante: nuevoOrigen,
      saldo_destino_resultante: nuevoDestino,
      fecha: isoAhora(),
    });

    return { ok: true, yaAplicada: false, nuevoSaldoOrigen: nuevoOrigen };
  });
}

// ─── Modo demo (solo entornos de prueba) ───────────────────────────────────

export type ResultadoDemo = { ok: true; nuevoSaldo: number } | { ok: false; error: string };

const DEMO_DESHABILITADO = 'El modo demo está deshabilitado en este entorno.';

/** Acredita saldo de mentira (sin billetera). Requiere PLATAFORMA_MODO_DEMO=true en el servidor. */
export async function acreditarSaldoDemo(p: {
  db?: Firestore;
  uid: string;
  monto: number;
  habilitado?: boolean;
}): Promise<ResultadoDemo> {
  if (!(p.habilitado ?? modoDemoHabilitado())) return { ok: false, error: DEMO_DESHABILITADO };

  const validacion = validarMonto(p.monto, 1, MONTO_MAXIMO_DEMO);
  if (!validacion.ok) return { ok: false, error: validacion.error };

  const db = p.db ?? getAdminDb();
  const usuarioRef = db.collection('usuarios').doc(p.uid);
  const cargaRef = db.collection('plataforma_cargas').doc(`DEMO-${p.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  return db.runTransaction<ResultadoDemo>(async (tx) => {
    const snap = await tx.get(usuarioRef);
    if (!snap.exists) return { ok: false, error: 'Tu perfil de plataforma no existe.' };

    const anterior = Number(snap.data()!.saldo || 0);
    const nuevo = redondear2(anterior + validacion.monto);

    tx.update(usuarioRef, { saldo: nuevo });
    tx.set(cargaRef, {
      firebase_uid: p.uid,
      amount_credited: validacion.monto,
      status: 'completed',
      tipo: 'demo',
      plataforma: 'inversiones_pro',
      saldo_anterior: anterior,
      saldo_resultante: nuevo,
      fecha: isoAhora(),
    });
    return { ok: true, nuevoSaldo: nuevo };
  });
}

/** Descuenta saldo "a banco" de mentira (sin billetera). Requiere PLATAFORMA_MODO_DEMO=true en el servidor. */
export async function debitarSaldoDemoBanco(p: {
  db?: Firestore;
  uid: string;
  monto: number;
  habilitado?: boolean;
}): Promise<ResultadoDemo> {
  if (!(p.habilitado ?? modoDemoHabilitado())) return { ok: false, error: DEMO_DESHABILITADO };

  const validacion = validarMonto(p.monto, 0.01, MONTO_MAXIMO_DEMO);
  if (!validacion.ok) return { ok: false, error: validacion.error };

  const db = p.db ?? getAdminDb();
  const usuarioRef = db.collection('usuarios').doc(p.uid);
  const retiroRef = db.collection('plataforma_retiros').doc(`DEMO-${p.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  return db.runTransaction<ResultadoDemo>(async (tx) => {
    const snap = await tx.get(usuarioRef);
    if (!snap.exists) return { ok: false, error: 'Tu perfil de plataforma no existe.' };

    const anterior = Number(snap.data()!.saldo || 0);
    if (anterior < validacion.monto) return { ok: false, error: 'Saldo insuficiente.' };
    const nuevo = redondear2(anterior - validacion.monto);

    tx.update(usuarioRef, { saldo: nuevo });
    tx.set(retiroRef, {
      firebase_uid: p.uid,
      amount: validacion.monto,
      status: 'completed',
      destination: 'banco_demo',
      saldo_anterior: anterior,
      saldo_resultante: nuevo,
      fecha_inicio: isoAhora(),
      fecha_completado: isoAhora(),
    });
    return { ok: true, nuevoSaldo: nuevo };
  });
}
