import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Resta el monto de ganancia total del saldo del creador antes de distribuirla,
 * de forma ATÓMICA (transacción de Firestore) para evitar condiciones de carrera
 * entre la validación de saldo suficiente y la escritura.
 *
 * @param usuarioId - ID del creador que distribuye la ganancia
 * @param creadorId - ID del creador del producto (reservado; no se usa actualmente)
 * @param monto - Monto total a distribuir (debe ser > 0)
 */
export default async function restarSaldoGanancia(
    usuarioId: string,
    creadorId: string,
    monto: number
): Promise<string | null> {
    if (!Number.isFinite(monto) || monto <= 0) {
        return 'Monto inválido';
    }

    try {
        const usuarioDocRef = doc(db, 'usuarios', usuarioId);

        const resultado = await runTransaction(db, async (tx) => {
            const usuarioDoc = await tx.get(usuarioDocRef);

            if (!usuarioDoc.exists()) {
                return 'Usuario no encontrado';
            }

            const saldoActual = usuarioDoc.data().saldo || 0;

            if (saldoActual < monto) {
                return 'Saldo insuficiente para distribuir ganancia';
            }

            tx.update(usuarioDocRef, { saldo: saldoActual - monto });
            return null;
        });

        return resultado;
    } catch (error: any) {
        console.error('Error en restarSaldoGanancia:', error);
        return 'Error al procesar distribución de ganancia';
    }
}
