import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Suma monto al saldo acumulado de un producto específico para el creador
 * @param creadorId - ID del creador del producto
 * @param productoId - ID del producto
 * @param monto - Monto a acumular
 */
export default async function sumarSaldoAcumulado(
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

        // Buscar si ya existe un registro para este producto
        const index = saldoRecaudado.findIndex(
            (item: any) => item.idProducto === productoId
        );

        if (index !== -1) {
            // Actualizar monto existente
            saldoRecaudado[index].monto += monto;
        } else {
            // Crear nuevo registro
            saldoRecaudado.push({
                idProducto: productoId,
                monto: monto,
            });
        }

        await updateDoc(usuarioDocRef, {
            saldoRecaudado: saldoRecaudado,
        });
    } catch (error: any) {
        console.error('Error en sumarSaldoAcumulado:', error);
        throw error;
    }
}
