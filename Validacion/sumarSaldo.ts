import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Suma saldo a un usuario (para devoluciones o ganancias)
 * @param usuarioId - ID del usuario
 * @param monto - Monto a sumar
 * @returns Mensaje de error si hay problema, null si es exitoso
 */
export default async function sumarSaldo(
    usuarioId: string,
    monto: number
): Promise<string | null> {
    try {
        const usuarioDocRef = doc(db, 'usuarios', usuarioId);
        const usuarioDoc = await getDoc(usuarioDocRef);

        if (!usuarioDoc.exists()) {
            return 'Usuario no encontrado';
        }

        const saldoActual = usuarioDoc.data().saldo || 0;

        await updateDoc(usuarioDocRef, {
            saldo: saldoActual + monto,
        });

        return null;
    } catch (error: any) {
        console.error('Error en sumarSaldo:', error);
        return 'Error al procesar la transacción';
    }
}
