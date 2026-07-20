import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Suma saldo a un usuario (para devoluciones o ganancias) de forma ATÓMICA.
 *
 * Usa una transacción de Firestore para evitar que actualizaciones
 * concurrentes se pisen entre sí (lost update) al leer y reescribir el saldo.
 *
 * @param usuarioId - ID del usuario
 * @param monto - Monto a sumar (debe ser > 0)
 * @returns Mensaje de error si hay problema, null si es exitoso
 */
export default async function sumarSaldo(
    usuarioId: string,
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

            tx.update(usuarioDocRef, { saldo: saldoActual + monto });
            return null;
        });

        return resultado;
    } catch (error: any) {
        console.error('Error en sumarSaldo:', error);
        return 'Error al procesar la transacción';
    }
}
