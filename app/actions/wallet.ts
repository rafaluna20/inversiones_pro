'use server';

import { cookies } from 'next/headers';
import { TransferSchema } from '@/lib/schemas';
import { verificarIdToken, mensajeErrorVerificacion } from '@/lib/firebase/admin';
import {
    clasificarRespuestaMovimiento,
    COOKIE_SESION_BILLETERA,
    llamarBilleteraOdoo,
} from '@/lib/odoo-wallet';
import { validarMonto } from '@/lib/plataforma-saldo';
import { llamarBancoFirmado } from '@/lib/wallet-signature';

const COOKIE_NAME = COOKIE_SESION_BILLETERA;

async function getOdooToken() {
    return cookies().get(COOKIE_NAME)?.value;
}

async function odooCall(endpoint: string, params: any = {}) {
    const token = await getOdooToken();

    if (!token) {
        return { error: { message: 'No autenticado en la billetera' } };
    }

    return llamarBilleteraOdoo(endpoint, params, token);
}

export async function getWalletDataAction() {
    const accountRes = await odooCall('/api/wallet/account');
    if (accountRes.error) return { success: false, error: accountRes.error.message };

    const historyRes = await odooCall('/api/wallet/transactions', { limit: 20 });

    return {
        success: true,
        data: {
            cash: accountRes.result?.account?.balance || 0,
            transactions: historyRes.result?.transactions || [],
            account: accountRes.result?.account
        }
    };
}

export async function transferMoneyAction(destination: string, amount: number) {
    // 1. Server-side validation with Zod
    const validation = TransferSchema.safeParse({ destination, amount });

    if (!validation.success) {
        return {
            success: false,
            message: 'Datos de transferencia inválidos',
            errors: validation.error.flatten().fieldErrors,
        };
    }

    // Determine destination type (naive check, can be improved)
    let params: any = { amount: validation.data.amount };
    const dest = validation.data.destination;

    if (dest.includes('@')) {
        params.destination_email = dest;
    } else if (/^\d+$/.test(dest)) {
        // Assuming numeric string is account number or ID.
        params.destination_account_number = dest;
    } else {
        // Fallback or specific logic
        params.destination_email = dest;
    }

    const response = await odooCall('/api/wallet/transfer', params);

    if (response.result && response.result.success) {
        return { success: true, message: 'Transferencia exitosa' };
    }

    return {
        success: false,
        message: response.error?.data?.message || response.error?.message || response.result?.error || 'Error en la transferencia'
    };
}

export async function withdrawMoneyAction(amount: number, method: string = 'bank', details: any = {}) {
    if (amount <= 0) {
        return { success: false, message: 'El monto debe ser mayor a 0' };
    }

    const params = {
        amount,
        withdrawal_method: method,
        ...details
    };

    const response = await odooCall('/api/wallet/withdrawal', params);

    if (response.result && response.result.success) {
        return { success: true, message: 'Retiro solicitado exitosamente' };
    }

    return {
        success: false,
        message: response.error?.data?.message || response.error?.message || response.result?.error || 'Error al procesar el retiro'
    };
}

// La CARGA a la plataforma (billetera → saldo de plataforma) vive en
// app/actions/plataforma-saldo.ts (cargarAPlataformaAction): allí el débito en
// Odoo y el crédito en Firestore ocurren juntos, en el servidor. Antes este
// archivo solo hacía el débito y dejaba el crédito al navegador.

/** Resultado de un retiro de la plataforma hacia la billetera (y de su recuperación). */
export interface ResultadoRetiroPlataforma {
    success: boolean;
    message: string;
    transaction_id?: string;
    amount?: number;
    new_wallet_balance?: number;
    new_platform_balance?: number;
    /** Odoo no confirmó ni rechazó: el saldo quedó retenido; se resuelve con completarRetiroPendienteAction. */
    pending?: boolean;
    critical_error?: boolean;
}

/**
 * withdrawFromPlatformAction
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquesta el puente inverso: Retira saldo de la Plataforma (Firebase)
 * y lo deposita en la Billetera (Odoo).
 *
 * `idToken` se verifica con Firebase Admin SDK antes de tocar cualquier
 * saldo — antes esta función confiaba en un `firebaseUid` que el cliente
 * enviaba sin ninguna verificación (cualquiera podía llamarla desde la
 * consola del navegador pasando el uid de otra persona).
 *
 * Flujo interno:
 * 1. Llama a descontarParaRetiro() en Firebase (asegura fondos).
 * 2. Llama a POST /api/wallet/platform-withdraw en Odoo.
 * 3. Según la respuesta de Odoo (ver clasificarRespuestaMovimiento):
 *    - confirmó        → marca el retiro como completado.
 *    - rechazó         → devuelve los fondos en Firebase (rollback).
 *    - NO SE SABE (timeout / error de red): deja el retiro 'pending' con los
 *      fondos retenidos. Antes esto también hacía rollback, lo que CREABA
 *      dinero cuando Odoo sí había aplicado el retiro pero la respuesta se
 *      perdió (el usuario recuperaba el saldo en Firebase Y lo tenía en Odoo).
 *      Se resuelve con completarRetiroPendienteAction (idempotente) o la
 *      reconciliación.
 */
export async function withdrawFromPlatformAction(amountSolicitado: number, idToken: string): Promise<ResultadoRetiroPlataforma> {
    // Nunca confiar en la validación del formulario: NaN, negativos o más de 2 decimales.
    const validacion = validarMonto(amountSolicitado);
    if (!validacion.ok) {
        return { success: false, message: validacion.error };
    }
    const amount = validacion.monto;

    let firebaseUid: string;
    try {
        const decoded = await verificarIdToken(idToken);
        firebaseUid = decoded.uid;
    } catch (error) {
        return { success: false, message: mensajeErrorVerificacion(error) };
    }

    // Generar ID único de transacción en Firebase
    const transactionId = `WTH-${firebaseUid}-${Date.now()}`;

    // ── PASO 1: Descontar de Firebase ───────────────────────────────────────
    const { descontarParaRetiro } = await import('@/Validacion/retirarHaciaBilletera');

    const fbResult = await descontarParaRetiro(firebaseUid, amount, transactionId);

    if (!fbResult.success) {
        return { success: false, message: fbResult.error || 'Error al descontar saldo de la plataforma' };
    }

    // ── PASO 2 y 3: Depositar en Odoo y resolver según su respuesta ─────────
    return resolverRetiro({
        firebaseUid,
        amount,
        transactionId,
        nuevoSaldoPlataforma: fbResult.newBalance,
    });
}

/**
 * Cuenta de billetera (WAL...) del usuario de ESTA sesión (la que abrió con su token en `billetera_session`).
 * El pago a Odoo (`/platform/payout`) lo firma la plataforma, no el usuario — pero el DESTINO tiene que ser SU
 * cuenta, nunca una que el cliente pueda declarar: por eso se obtiene aquí, del banco, con su propio token.
 */
async function cuentaDelUsuario(): Promise<{ ok: true; numero: string } | { ok: false; mensaje: string }> {
    const respuesta = await odooCall('/api/wallet/account');
    const numero = respuesta.result?.success ? respuesta.result?.account?.number : undefined;
    if (typeof numero !== 'string' || !numero) {
        return { ok: false, mensaje: 'No autenticado en la billetera. Conéctala primero.' };
    }
    return { ok: true, numero };
}

/**
 * Llama al banco con la clave de idempotencia del retiro y cierra el registro según la respuesta. Compartido por
 * el retiro nuevo y por la recuperación.
 *
 * El pago (`/platform/payout`) lo firma esta plataforma con su secreto — el banco NUNCA acepta que el destino de un
 * pago lo declare quien llama sin firma (por eso se retiró /platform-withdraw, que acreditaba a cualquiera con el
 * monto que él mismo mandaba).
 */
async function resolverRetiro(p: {
    firebaseUid: string;
    amount: number;
    transactionId: string;
    nuevoSaldoPlataforma?: number;
}): Promise<ResultadoRetiroPlataforma> {
    const { revertirRetiro, confirmarRetiroExitoso } = await import('@/Validacion/retirarHaciaBilletera');

    const cuenta = await cuentaDelUsuario();
    if (!cuenta.ok) {
        // Nunca se llegó a llamar al banco (no sabemos a qué cuenta pagar): es seguro devolver el dinero YA, en vez
        // de dejarlo 'pending' esperando una reconexión que puede no llegar pronto.
        const rollbackResult = await revertirRetiro(p.firebaseUid, p.amount, p.transactionId, cuenta.mensaje);
        if (!rollbackResult.success) {
            console.error(`[Bridge Withdraw] CRÍTICO: Rollback falló (sin cuenta de banco). TxID: ${p.transactionId}`);
            return {
                success: false, critical_error: true, transaction_id: p.transactionId,
                message: `Hubo un error grave. Tu dinero está seguro pero requiere revisión manual. Código: ${p.transactionId}`,
            };
        }
        return { success: false, message: cuenta.mensaje };
    }

    const movimiento = clasificarRespuestaMovimiento(
        await llamarBancoFirmado('/api/wallet/platform/payout', {
            account_number: cuenta.numero,
            amount: p.amount,
            idempotency_key: p.transactionId,
            description: 'Retiro desde Inversiones Pro',
        })
    );

    if (movimiento.estado === 'ok') {
        await confirmarRetiroExitoso(p.transactionId, movimiento.transactionId);
        return {
            success: true,
            transaction_id: p.transactionId,
            amount: p.amount,
            new_wallet_balance: movimiento.nuevoSaldo,
            new_platform_balance: p.nuevoSaldoPlataforma,
            message: `¡Retiro exitoso! S/ ${p.amount.toFixed(2)} fueron transferidos a tu Billetera.`,
        };
    }

    if (movimiento.estado === 'rechazada') {
        // Odoo confirmó que NO aplicó el retiro: es seguro devolver los fondos.
        console.warn(`[Bridge Withdraw] Odoo rechazó. Iniciando rollback para TxID: ${p.transactionId}. Motivo: ${movimiento.mensaje}`);

        const rollbackResult = await revertirRetiro(p.firebaseUid, p.amount, p.transactionId, movimiento.mensaje);

        if (!rollbackResult.success) {
            console.error(`[Bridge Withdraw] CRÍTICO: Rollback falló. El usuario perdió S/${p.amount}. Contactar a soporte. TxID: ${p.transactionId}`);
            return {
                success: false,
                critical_error: true,
                transaction_id: p.transactionId,
                message: `Hubo un error de conexión grave. Tu dinero está seguro pero requiere revisión manual. Código: ${p.transactionId}`,
            };
        }

        return {
            success: false,
            message: `El retiro falló y el dinero fue devuelto a tu plataforma. Motivo: ${movimiento.mensaje}`,
        };
    }

    // Indeterminado: NO se revierte. Los fondos quedan retenidos ('pending').
    console.warn(`[Bridge Withdraw] Sin confirmación de Odoo (${movimiento.mensaje}). Retiro queda 'pending' TxID: ${p.transactionId}`);
    return {
        success: false,
        pending: true,
        transaction_id: p.transactionId,
        message: `No pudimos confirmar tu retiro con la billetera. Tu saldo quedó retenido mientras lo verificamos. No repitas el retiro. Código: ${p.transactionId}`,
    };
}

/**
 * Retoma un retiro que quedó 'pending' (sin confirmación de Odoo). Es seguro
 * llamarla varias veces: reutiliza la MISMA clave de idempotencia y el monto
 * GUARDADO en el registro del retiro, nunca uno enviado ahora.
 */
export async function completarRetiroPendienteAction(idToken: string, transactionId: string): Promise<ResultadoRetiroPlataforma> {
    let firebaseUid: string;
    try {
        const decoded = await verificarIdToken(idToken);
        firebaseUid = decoded.uid;
    } catch (error) {
        return { success: false, message: mensajeErrorVerificacion(error) };
    }

    if (typeof transactionId !== 'string' || !/^WTH-[A-Za-z0-9_-]{4,200}$/.test(transactionId)) {
        return { success: false, message: 'Código de retiro inválido.' };
    }

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const snap = await getAdminDb().collection('plataforma_retiros').doc(transactionId).get();
    const data = snap.data();

    if (!snap.exists || !data || data.firebase_uid !== firebaseUid) {
        return { success: false, message: 'No se encontró ese retiro.' };
    }
    if (data.status !== 'pending') {
        return { success: false, message: `Este retiro ya está en estado "${data.status}".` };
    }

    return resolverRetiro({ firebaseUid, amount: Number(data.amount), transactionId });
}
