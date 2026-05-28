import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Resta monto del saldo acumulado de un producto específico
 * @param creadorId - ID del creador del producto
 * @param productoId - ID del producto
 * @param monto - Monto a restar
 */
export default async function restarSaldoAcumulado(
    creadorId: string,
    productoId: string,
    monto: number
): Promise<void> {
    try {
        const usuarioDocRef = doc(db, 'usuarios', creadorId);
        const usuarioDoc = await getDoc(usuarioDocRef);

        if (!usuarioDoc.exists()) {
            throw new Error('Usuario no encontrado');
        }

        const saldoRecaudado = usuarioDoc.data().saldoRecaudado || [];

        // Buscar el registro del producto
        const index = saldoRecaudado.findIndex(
            (item: any) => item.idProducto === productoId
        );

        if (index !== -1) {
            saldoRecaudado[index].monto -= monto;

            // Si llega a 0 o menos, remover el registro
            if (saldoRecaudado[index].monto <= 0) {
                saldoRecaudado.splice(index, 1);
            }

            await updateDoc(usuarioDocRef, {
                saldoRecaudado: saldoRecaudado,
            });
        }
    } catch (error: any) {
        console.error('Error en restarSaldoAcumulado:', error);
        throw error;
    }
}
