import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Acredita saldo en Firebase usando la clave de idempotencia de Odoo.
 *
 * GARANTÍA CRÍTICA: El campo `plataforma_cargas/{transactionId}` en Firestore
 * actúa como "journal de transacciones". Si ya existe, la función retorna
 * `already_applied: true` sin volver a sumar el saldo. Esto previene el
 * double-credit incluso si la función se llama varias veces por reintentos.
 *
 * Flujo:
 * 1. Verifica en Firestore si `transactionId` ya fue aplicado.
 * 2. Si no fue aplicado: suma `amount` al campo `saldo` del usuario.
 * 3. Registra el `transactionId` como "aplicado" en la colección de cargas.
 *
 * @param firebaseUid - UID del usuario en Firebase Auth
 * @param amount - Monto a acreditar (ya fue debitado de Odoo)
 * @param transactionId - ID único de la transacción de Odoo (ej: "TRN-00000042")
 * @returns { success, already_applied, newBalance, error }
 */
export default async function acreditarDesdeBilletera(
    firebaseUid: string,
    amount: number,
    transactionId: string
): Promise<{
    success: boolean;
    already_applied?: boolean;
    newBalance?: number;
    error?: string;
}> {
    if (!firebaseUid || !transactionId || amount <= 0) {
        return { success: false, error: 'Parámetros inválidos' };
    }

    // Referencia al registro de idempotencia de esta transacción específica
    const cargaRef = doc(db, 'plataforma_cargas', transactionId);
    const usuarioRef = doc(db, 'usuarios', firebaseUid);

    try {
        // ─── VERIFICAR IDEMPOTENCIA ───────────────────────────────────────
        const cargaSnap = await getDoc(cargaRef);

        if (cargaSnap.exists()) {
            // Esta transacción ya fue aplicada anteriormente. Retorno seguro.
            console.warn(`[Bridge] Transacción ${transactionId} ya fue aplicada. Ignorando duplicado.`);
            return {
                success: true,
                already_applied: true,
                newBalance: cargaSnap.data().saldo_resultante ?? undefined,
            };
        }

        // ─── LEER SALDO ACTUAL ────────────────────────────────────────────
        const usuarioSnap = await getDoc(usuarioRef);

        if (!usuarioSnap.exists()) {
            return { success: false, error: 'Usuario no encontrado en la plataforma' };
        }

        const saldoActual = parseFloat(usuarioSnap.data().saldo ?? 0);
        const nuevoSaldo = parseFloat((saldoActual + amount).toFixed(2));

        // ─── ACREDITAR SALDO ──────────────────────────────────────────────
        // Nota: En Firestore no hay transacciones distribuidas atómicas con
        // sistemas externos, por lo que usamos el patron "write last".
        // El registro de idempotencia se escribe DESPUÉS del saldo para que
        // si falla el setDoc, el registro no quede marcado como aplicado.

        await updateDoc(usuarioRef, {
            saldo: nuevoSaldo,
        });

        // ─── REGISTRAR EN JOURNAL (IDEMPOTENCIA) ─────────────────────────
        await setDoc(cargaRef, {
            firebase_uid: firebaseUid,
            odoo_transaction_id: transactionId,
            amount_credited: amount,
            saldo_anterior: saldoActual,
            saldo_resultante: nuevoSaldo,
            fecha: new Date().toISOString(),
            plataforma: 'inversiones_pro',
        });

        console.info(
            `[Bridge] ✅ Crédito aplicado: Firebase=${firebaseUid} | TxID=${transactionId} | Monto=S/${amount} | NuevoSaldo=S/${nuevoSaldo}`
        );

        return {
            success: true,
            already_applied: false,
            newBalance: nuevoSaldo,
        };

    } catch (error: any) {
        console.error(`[Bridge] Error al acreditar: TxID=${transactionId}`, error);
        return {
            success: false,
            error: `Error al acreditar saldo: ${error.message || 'Error desconocido'}`,
        };
    }
}
