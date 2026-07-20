import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Resta saldo del usuario inversor de forma ATÓMICA.
 *
 * Usa una transacción de Firestore para que la validación de "saldo
 * suficiente" y la escritura ocurran sin condición de carrera: dos
 * operaciones concurrentes ya no pueden pasar ambas el chequeo y dejar el
 * saldo en negativo (Firestore reintenta la transacción ante contención).
 *
 * @param usuarioId - ID del usuario que invierte
 * @param creadorId - ID del creador del producto (reservado; no se usa actualmente)
 * @param monto - Monto a restar (debe ser > 0)
 * @returns Mensaje de error si hay problema, null si es exitoso
 */
export default async function restarSaldo(
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

            // Validar saldo suficiente DENTRO de la transacción (atómico)
            if (saldoActual < monto) {
                return 'Saldo insuficiente';
            }

            tx.update(usuarioDocRef, { saldo: saldoActual - monto });
            return null; // Éxito
        });

        return resultado;
    } catch (error: any) {
        console.error('Error en restarSaldo:', error);
        return 'Error al procesar la transacción';
    }
}
