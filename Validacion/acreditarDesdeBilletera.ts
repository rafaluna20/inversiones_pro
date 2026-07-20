import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Acredita saldo en Firebase usando la clave de idempotencia de Odoo.
 *
 * GARANTÍA CRÍTICA: El campo `plataforma_cargas/{transactionId}` en Firestore
 * actúa como "journal de transacciones". Si ya existe, la función retorna
 * `already_applied: true` sin volver a sumar el saldo. Esto previene el
 * double-credit incluso si la función se llama varias veces por reintentos.
 *
 * Toda la operación (chequeo de idempotencia + lectura de saldo + escritura
 * de saldo + registro en el journal) corre dentro de una única `runTransaction`
 * de Firestore: si dos llamadas concurrentes (doble reintento de red, dos
 * pestañas) intentan acreditar la misma `transactionId` o tocar el mismo
 * usuario al mismo tiempo, Firestore serializa/reintenta la transacción en
 * vez de permitir que ambas lean el mismo saldo y una sobreescriba a la otra.
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
        const resultado = await runTransaction(db, async (tx) => {
            // ─── VERIFICAR IDEMPOTENCIA ───────────────────────────────────
            const cargaSnap = await tx.get(cargaRef);

            if (cargaSnap.exists()) {
                // Esta transacción ya fue aplicada anteriormente. Retorno seguro.
                console.warn(`[Bridge] Transacción ${transactionId} ya fue aplicada. Ignorando duplicado.`);
                return {
                    success: true,
                    already_applied: true,
                    newBalance: cargaSnap.data().saldo_resultante ?? undefined,
                };
            }

            // ─── LEER SALDO ACTUAL ──────────────────────────────────────────
            const usuarioSnap = await tx.get(usuarioRef);

            if (!usuarioSnap.exists()) {
                return { success: false, error: 'Usuario no encontrado en la plataforma' };
            }

            const saldoActual = parseFloat(usuarioSnap.data().saldo ?? 0);
            const nuevoSaldo = parseFloat((saldoActual + amount).toFixed(2));

            // ─── ACREDITAR SALDO Y REGISTRAR EN JOURNAL (ATÓMICO) ───────────
            // Ambas escrituras se confirman juntas o ninguna se confirma: no
            // puede quedar el saldo actualizado sin el registro de idempotencia,
            // ni viceversa.
            tx.update(usuarioRef, { saldo: nuevoSaldo });
            tx.set(cargaRef, {
                firebase_uid: firebaseUid,
                odoo_transaction_id: transactionId,
                amount_credited: amount,
                saldo_anterior: saldoActual,
                saldo_resultante: nuevoSaldo,
                fecha: new Date().toISOString(),
                plataforma: 'inversiones_pro',
            });

            return {
                success: true,
                already_applied: false,
                newBalance: nuevoSaldo,
            };
        });

        if (resultado.success && !resultado.error) {
            console.info(
                `[Bridge] ✅ Crédito aplicado: Firebase=${firebaseUid} | TxID=${transactionId} | Monto=S/${amount} | NuevoSaldo=S/${resultado.newBalance}`
            );
        }

        return resultado;

    } catch (error: any) {
        console.error(`[Bridge] Error al acreditar: TxID=${transactionId}`, error);
        return {
            success: false,
            error: `Error al acreditar saldo: ${error.message || 'Error desconocido'}`,
        };
    }
}
