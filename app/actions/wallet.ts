'use server';

import { cookies } from 'next/headers';
import { TransferSchema } from '@/lib/schemas';

const API_BASE_URL = process.env.NEXT_PUBLIC_WALLET_API_URL || 'http://localhost:8069';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || 'odoo_akallpav1';
const COOKIE_NAME = 'billetera_session';

async function getOdooToken() {
    return cookies().get(COOKIE_NAME)?.value;
}

async function odooCall(endpoint: string, params: any = {}) {
    const token = await getOdooToken();

    if (!token) {
        return { error: { message: 'No autenticado' } };
    }

    // Timeout de 15 segundos para evitar que la UI quede colgada
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}?db=${ODOO_DB}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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

        clearTimeout(timeoutId);
        return await response.json();
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error(`Odoo Timeout [${endpoint}]: La solicitud tardó más de 15 segundos`);
            return { error: { message: 'El servidor tardó demasiado en responder. Intenta de nuevo.' } };
        }
        console.error(`Odoo Transaction Error [${endpoint}]:`, error);
        return { error: { message: 'Error de conexión con el servidor' } };
    }
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

/**
 * loadPlatformBalanceAction
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquesta el "Bridge Transaction": debita de la Billetera Odoo y acredita en
 * el saldo de Firebase (plataforma de inversiones) con garantía de idempotencia.
 *
 * Flujo interno:
 * 1. Llama a POST /api/wallet/platform-load en Odoo → obtiene transaction_id
 * 2. Llama a acreditarDesdeBilletera() en Firebase con ese transaction_id
 * 3. Si Firebase falla, retorna el transaction_id para reintentar más tarde
 *
 * @param amount - Monto a cargar (en soles)
 * @param firebaseUid - UID del usuario en Firebase
 */
export async function loadPlatformBalanceAction(amount: number, firebaseUid: string) {
    if (amount < 10) {
        return { success: false, message: 'El monto mínimo de carga es S/ 10.00' };
    }

    if (!firebaseUid) {
        return { success: false, message: 'No se pudo identificar tu cuenta de plataforma' };
    }

    // Generar clave de idempotencia única para este intento
    const idempotencyKey = `PLAT-${firebaseUid}-${Date.now()}`;

    // ── PASO 1: Debitar de Odoo ────────────────────────────────────────────
    const odooResponse = await odooCall('/api/wallet/platform-load', {
        amount,
        firebase_uid: firebaseUid,
        platform: 'inversiones_pro',
        idempotency_key: idempotencyKey,
    });

    // Verificar respuesta de Odoo
    if (odooResponse.error) {
        return {
            success: false,
            message: odooResponse.error?.data?.message || odooResponse.error?.message || 'Error al conectar con la billetera'
        };
    }

    const odooResult = odooResponse.result;

    if (!odooResult?.success) {
        return {
            success: false,
            message: odooResult?.error || 'Error al procesar en la billetera digital'
        };
    }

    const transactionId: string = odooResult.transaction_id;
    const amountDebited: number = odooResult.amount;

    // ── PASO 2: Acreditar en Firebase (con idempotencia) ───────────────────
    // Importación dinámica para no romper el bundle de server actions con código de cliente
    const { default: acreditarDesdeBilletera } = await import('@/Validacion/acreditarDesdeBilletera');

    const firebaseResult = await acreditarDesdeBilletera(
        firebaseUid,
        amountDebited,
        transactionId
    );

    if (!firebaseResult.success) {
        // Odoo YA debitó pero Firebase falló.
        // Retornamos el transactionId para que el usuario pueda reintentar el crédito.
        console.error(
            `[Bridge] ALERTA: Odoo debitó S/${amountDebited} (TxID: ${transactionId}) pero Firebase falló:`,
            firebaseResult.error
        );
        return {
            success: false,
            partial: true,  // Flag: Odoo OK pero Firebase falló
            transaction_id: transactionId,
            message: `El débito en la billetera fue exitoso pero hubo un error al acreditar en la plataforma. Código de recuperación: ${transactionId}`,
        };
    }

    return {
        success: true,
        already_applied: firebaseResult.already_applied,
        transaction_id: transactionId,
        amount: amountDebited,
        new_platform_balance: firebaseResult.newBalance,
        message: firebaseResult.already_applied
            ? 'Esta carga ya fue aplicada anteriormente'
            : `¡S/ ${amountDebited.toFixed(2)} cargados a tu plataforma exitosamente!`,
    };
}

/**
 * retryFirebaseCreditAction
 * ─────────────────────────────────────────────────────────────────────────────
 * Reintenta acreditar en Firebase si el paso anterior falló pero Odoo ya debitó.
 * El usuario debe proporcionar el transaction_id recibido en el error anterior.
 */
export async function retryFirebaseCreditAction(
    transactionId: string,
    firebaseUid: string,
    amount: number
) {
    if (!transactionId || !firebaseUid || amount <= 0) {
        return { success: false, message: 'Datos de recuperación inválidos' };
    }

    const { default: acreditarDesdeBilletera } = await import('@/Validacion/acreditarDesdeBilletera');

    const result = await acreditarDesdeBilletera(firebaseUid, amount, transactionId);

    if (!result.success) {
        return { success: false, message: result.error || 'Error al recuperar el crédito' };
    }

    return {
        success: true,
        already_applied: result.already_applied,
        new_platform_balance: result.newBalance,
        message: result.already_applied
            ? 'Esta transacción ya estaba aplicada'
            : `¡Crédito recuperado! S/ ${amount.toFixed(2)} añadidos a tu saldo de plataforma`,
    };
}

/**
 * withdrawFromPlatformAction
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquesta el puente inverso: Retira saldo de la Plataforma (Firebase)
 * y lo deposita en la Billetera (Odoo).
 * 
 * Flujo interno:
 * 1. Llama a descontarParaRetiro() en Firebase (asegura fondos).
 * 2. Llama a POST /api/wallet/platform-withdraw en Odoo.
 * 3. Si Odoo responde OK -> confirma en Firebase.
 * 4. Si Odoo falla -> hace rollback en Firebase devolviendo los fondos.
 */
export async function withdrawFromPlatformAction(amount: number, firebaseUid: string) {
    if (amount <= 0) {
        return { success: false, message: 'El monto debe ser mayor a 0' };
    }

    if (!firebaseUid) {
        return { success: false, message: 'No se pudo identificar tu cuenta de plataforma' };
    }

    // Generar ID único de transacción en Firebase
    const transactionId = `WTH-${firebaseUid}-${Date.now()}`;

    // ── PASO 1: Descontar de Firebase ───────────────────────────────────────
    const { descontarParaRetiro, revertirRetiro, confirmarRetiroExitoso } = await import('@/Validacion/retirarHaciaBilletera');
    
    const fbResult = await descontarParaRetiro(firebaseUid, amount, transactionId);
    
    if (!fbResult.success) {
        return { success: false, message: fbResult.error || 'Error al descontar saldo de la plataforma' };
    }

    // ── PASO 2: Depositar en Odoo ───────────────────────────────────────────
    const odooResponse = await odooCall('/api/wallet/platform-withdraw', {
        amount,
        firebase_uid: firebaseUid,
        idempotency_key: transactionId,
    });

    const odooResult = odooResponse.result;

    if (odooResponse.error || !odooResult?.success) {
        const errorMsg = odooResponse.error?.data?.message || odooResponse.error?.message || odooResult?.error || 'Error en la billetera Odoo';
        
        // ── PASO 3 (Fallo): Hacer Rollback en Firebase ──────────────────────
        console.warn(`[Bridge Withdraw] Odoo falló. Iniciando rollback para TxID: ${transactionId}. Motivo: ${errorMsg}`);
        
        const rollbackResult = await revertirRetiro(firebaseUid, amount, transactionId, errorMsg);
        
        if (!rollbackResult.success) {
            console.error(`[Bridge Withdraw] CRÍTICO: Rollback falló. El usuario perdió S/${amount}. Contactar a soporte. TxID: ${transactionId}`);
            return {
                success: false,
                critical_error: true,
                transaction_id: transactionId,
                message: `Hubo un error de conexión grave. Tu dinero está seguro pero requiere revisión manual. Código: ${transactionId}`,
            };
        }

        return {
            success: false,
            message: `El retiro falló y el dinero fue devuelto a tu plataforma. Motivo: ${errorMsg}`,
        };
    }

    // ── PASO 3 (Éxito): Marcar como completado ──────────────────────────────
    await confirmarRetiroExitoso(transactionId, odooResult.transaction_id);

    return {
        success: true,
        transaction_id: transactionId,
        amount: amount,
        new_wallet_balance: odooResult.new_balance,
        new_platform_balance: fbResult.newBalance,
        message: `¡Retiro exitoso! S/ ${amount.toFixed(2)} fueron transferidos a tu Billetera.`,
    };
}
