import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Fase 1 del retiro: Descuenta el saldo de Firebase antes de llamar a Odoo.
 * Guarda un registro de la transacción en `plataforma_retiros` para prevenir
 * duplicados (idempotencia) y permitir auditoría/rollbacks.
 *
 * @param firebaseUid - UID del usuario
 * @param amount - Monto a retirar
 * @param transactionId - ID único generado por Next.js para esta transacción
 */
export async function descontarParaRetiro(
    firebaseUid: string,
    amount: number,
    transactionId: string
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (!firebaseUid || !transactionId || amount <= 0) {
        return { success: false, error: 'Parámetros inválidos' };
    }

    const retiroRef = doc(db, 'plataforma_retiros', transactionId);
    const usuarioRef = doc(db, 'usuarios', firebaseUid);

    try {
        // Verificar idempotencia
        const retiroSnap = await getDoc(retiroRef);
        if (retiroSnap.exists()) {
            return { success: false, error: 'Esta transacción ya está en proceso o fue completada' };
        }

        // Leer saldo actual
        const usuarioSnap = await getDoc(usuarioRef);
        if (!usuarioSnap.exists()) {
            return { success: false, error: 'Usuario no encontrado' };
        }

        const saldoActual = parseFloat(usuarioSnap.data().saldo ?? 0);
        
        if (saldoActual < amount) {
            return { success: false, error: 'Saldo insuficiente en la plataforma' };
        }

        const nuevoSaldo = parseFloat((saldoActual - amount).toFixed(2));

        // Actualizar saldo
        await updateDoc(usuarioRef, { saldo: nuevoSaldo });

        // Registrar transacción como PENDIENTE
        await setDoc(retiroRef, {
            firebase_uid: firebaseUid,
            amount: amount,
            status: 'pending',
            saldo_anterior: saldoActual,
            saldo_resultante: nuevoSaldo,
            fecha_inicio: new Date().toISOString(),
        });

        return { success: true, newBalance: nuevoSaldo };
    } catch (error: any) {
        console.error(`[Bridge Withdraw] Error al descontar saldo: ${transactionId}`, error);
        return { success: false, error: 'Error al procesar el descuento en la plataforma' };
    }
}

/**
 * Fase 2 (Éxito): Marca la transacción como completada en Firebase 
 * después de que Odoo respondió exitosamente.
 */
export async function confirmarRetiroExitoso(
    transactionId: string,
    odooTransactionId: string
): Promise<void> {
    try {
        const retiroRef = doc(db, 'plataforma_retiros', transactionId);
        await updateDoc(retiroRef, {
            status: 'completed',
            odoo_transaction_id: odooTransactionId,
            fecha_completado: new Date().toISOString(),
        });
    } catch (error) {
        // No bloqueamos al usuario si esto falla, el dinero ya está en Odoo
        console.error(`[Bridge Withdraw] Error al marcar retiro como completado: ${transactionId}`, error);
    }
}

/**
 * Fase 2 (Fallo): Rollback. Devuelve el saldo al usuario porque Odoo falló.
 */
export async function revertirRetiro(
    firebaseUid: string,
    amount: number,
    transactionId: string,
    razonFallo: string
): Promise<{ success: boolean; error?: string }> {
    const retiroRef = doc(db, 'plataforma_retiros', transactionId);
    const usuarioRef = doc(db, 'usuarios', firebaseUid);

    try {
        // Verificar que siga en estado pendiente
        const retiroSnap = await getDoc(retiroRef);
        if (!retiroSnap.exists() || retiroSnap.data().status !== 'pending') {
            return { success: false, error: 'La transacción no es válida para rollback' };
        }

        const usuarioSnap = await getDoc(usuarioRef);
        const saldoActual = parseFloat(usuarioSnap.data()?.saldo ?? 0);
        const saldoRestaurado = parseFloat((saldoActual + amount).toFixed(2));

        // Devolver saldo
        await updateDoc(usuarioRef, { saldo: saldoRestaurado });

        // Marcar como fallida/revertida
        await updateDoc(retiroRef, {
            status: 'failed_rolled_back',
            razon_fallo: razonFallo,
            fecha_rollback: new Date().toISOString(),
        });

        console.info(`[Bridge Withdraw] Rollback exitoso para TxID: ${transactionId}`);
        return { success: true };
    } catch (error: any) {
        console.error(`[Bridge Withdraw] Error CRÍTICO en rollback para TxID: ${transactionId}`, error);
        return { success: false, error: 'Error al revertir saldo. Contacte a soporte.' };
    }
}
