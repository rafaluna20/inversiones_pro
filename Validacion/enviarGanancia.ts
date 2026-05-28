import sumarSaldo from './sumarSaldo';

interface Inversor {
    usuarioId: string;
    usuarioNombre: string;
    cubos: number;
    descripcion: string;
    categoria: string;
    fecha: number;
    icono?: string;
}

/**
 * Distribuye ganancias entre todos los inversores proporcionalmente a sus cubos
 * @param inversores - Array de inversores
 * @param gananciaTotal - Monto total de ganancia a distribuir
 * @param precioProyecto - Precio total del proyecto (para cálculos)
 */
export default async function enviarGanancia(
    inversores: Inversor[],
    gananciaTotal: number,
    precioProyecto: number
): Promise<void> {
    try {
        // Calcular total de cubos vendidos
        const totalCubos = inversores.reduce((sum, inv) => sum + inv.cubos, 0);

        // Distribuir ganancia proporcionalmente
        for (const inversor of inversores) {
            const porcentaje = inversor.cubos / totalCubos;
            const gananciaInversor = gananciaTotal * porcentaje;

            // Sumar ganancia al saldo del inversor
            await sumarSaldo(inversor.usuarioId, gananciaInversor);
        }

        console.log(`Ganancias distribuidas exitosamente a ${inversores.length} inversores`);
    } catch (error: any) {
        console.error('Error en enviarGanancia:', error);
        throw error;
    }
}
