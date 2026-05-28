import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Resta el monto de ganancia total del saldo del creador antes de distribuirla
 * @param usuarioId - ID del creador que distribuye la ganancia
 * @param creadorId - ID del creador del producto (generalmente el mismo)
 * @param monto - Monto total a distribuir
 */
export default async function restarSaldoGanancia(
    usuarioId: string,
    creadorId: string,
    monto: number
): Promise<string | null> {
    try {
        const usuarioDocRef = doc(db, 'usuarios', usuarioId);
        const usuarioDoc = await getDoc(usuarioDocRef);

        if (!usuarioDoc.exists()) {
            return 'Usuario no encontrado';
        }

        const saldoActual = usuarioDoc.data().saldo || 0;

        if (saldoActual < monto) {
            return 'Saldo insuficiente para distribuir ganancia';
        }

        await updateDoc(usuarioDocRef, {
            saldo: saldoActual - monto,
        });

        return null;
    } catch (error: any) {
        console.error('Error en restarSaldoGanancia:', error);
        return 'Error al procesar distribución de ganancia';
    }
}
