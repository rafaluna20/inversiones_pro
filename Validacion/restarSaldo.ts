import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Resta saldo del usuario inversor y suma al saldo acumulado del creador para un producto específico
 * @param usuarioId - ID del usuario que invierte
 * @param creadorId - ID del creador del producto
 * @param monto - Monto a restar/sumar
 * @returns Mensaje de error si hay problema, null si es exitoso
 */
export default async function restarSaldo(
    usuarioId: string,
    creadorId: string,
    monto: number
): Promise<string | null> {
    try {
        // Obtener documento del usuario
        const usuarioDocRef = doc(db, 'usuarios', usuarioId);
        const usuarioDoc = await getDoc(usuarioDocRef);

        if (!usuarioDoc.exists()) {
            return 'Usuario no encontrado';
        }

        const saldoActual = usuarioDoc.data().saldo || 0;

        // Validar que tenga saldo suficiente
        if (saldoActual < monto) {
            return 'Saldo insuficiente';
        }

        // Restar saldo del usuario
        await updateDoc(usuarioDocRef, {
            saldo: saldoActual - monto,
        });

        return null; // Éxito
    } catch (error: any) {
        console.error('Error en restarSaldo:', error);
        return 'Error al procesar la transacción';
    }
}
