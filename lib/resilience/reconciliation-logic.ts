/**
 * Lógica PURA de reconciliación Odoo-Firebase.
 *
 * Sin I/O, sin Firestore: recibe datos ya leídos y devuelve una lista de
 * problemas. Esto es lo que hace testeable de verdad la reconciliación —
 * lib/resilience/reconciliation.ts se encarga de leer con el Admin SDK y le
 * pasa los datos a estas funciones.
 */

export interface ReconciliationIssue {
  type: 'missing_firebase' | 'missing_odoo' | 'monto_mismatch' | 'estado_mismatch' | 'retiro_atascado';
  severity: 'critical' | 'high' | 'medium' | 'low';
  inversionId?: string;
  odooTransactionId?: string;
  proyectoId?: string;
  usuarioId?: string;
  transactionId?: string;
  description: string;
  suggestedFix?: string;
  detectedAt: Date;
}

export interface InversionResumen {
  id: string;
  proyectoId: string;
  usuarioId: string;
  confirmada: boolean;
  montoInvertido: number;
  etapa?: 'tierra' | 'construccion';
  transaccionOdooId?: string;
}

export interface ProyectoResumen {
  id: string;
  montoRecaudadoTierra: number;
  montoRecaudadoConstruccion: number;
}

export interface RetiroPendienteResumen {
  transactionId: string;
  firebaseUid: string;
  amount: number;
  /** epoch ms de `fecha_inicio` (ver Validacion/retirarHaciaBilletera.ts) */
  fechaInicioMs: number;
}

/**
 * Un retiro 'pending' de más de 15 min es sospechoso: el flujo normal
 * (descontar en Firebase -> llamar a Odoo -> confirmar o revertir) tarda
 * segundos, no minutos. Ver Validacion/retirarHaciaBilletera.ts.
 */
export const UMBRAL_RETIRO_ATASCADO_MS = 15 * 60 * 1000;

/** Tolerancia de descuadre de montos antes de reportar (ver monto_mismatch). */
export const TOLERANCIA_MONTO_SOLES = 100;

/** Umbral de monto para escalar un mismatch de 'high' a 'critical'. */
export const UMBRAL_CRITICO_MONTO_SOLES = 10000;

export function detectarInversionesSinTransaccionOdoo(
  inversiones: InversionResumen[]
): ReconciliationIssue[] {
  return inversiones
    .filter((inv) => inv.confirmada && !inv.transaccionOdooId)
    .map((inv) => ({
      type: 'missing_odoo',
      severity: 'critical',
      inversionId: inv.id,
      proyectoId: inv.proyectoId,
      usuarioId: inv.usuarioId,
      description: `Inversión confirmada sin transacción Odoo asociada. Monto: S/ ${inv.montoInvertido.toFixed(2)}`,
      suggestedFix: 'Crear la transacción Odoo retroactivamente o revertir la confirmación.',
      detectedAt: new Date(),
    }));
}

export function detectarDesincronizacionDeMontos(
  proyectoId: string,
  inversionesDelProyecto: InversionResumen[],
  proyecto: ProyectoResumen,
  toleranciaSoles: number = TOLERANCIA_MONTO_SOLES
): ReconciliationIssue[] {
  const montoTotalInvertido = inversionesDelProyecto
    .filter((inv) => inv.confirmada)
    .reduce((sum, inv) => sum + (inv.montoInvertido || 0), 0);

  const montoRegistrado = proyecto.montoRecaudadoTierra + proyecto.montoRecaudadoConstruccion;
  const diferencia = Math.abs(montoTotalInvertido - montoRegistrado);

  if (diferencia <= toleranciaSoles) return [];

  return [
    {
      type: 'monto_mismatch',
      severity: diferencia > UMBRAL_CRITICO_MONTO_SOLES ? 'critical' : 'high',
      proyectoId,
      description: `Desincronización de montos en el proyecto. Invertido (suma de inversiones confirmadas): S/ ${montoTotalInvertido.toFixed(2)}, registrado en el proyecto: S/ ${montoRegistrado.toFixed(2)}, diferencia: S/ ${diferencia.toFixed(2)}.`,
      suggestedFix: 'Recalcular y actualizar montoRecaudado del proyecto a partir de las inversiones confirmadas.',
      detectedAt: new Date(),
    },
  ];
}

export function detectarRetirosAtascados(
  retiros: RetiroPendienteResumen[],
  ahoraMs: number = Date.now(),
  umbralMs: number = UMBRAL_RETIRO_ATASCADO_MS
): ReconciliationIssue[] {
  return retiros
    .filter((r) => ahoraMs - r.fechaInicioMs > umbralMs)
    .map((r) => {
      const minutos = Math.round((ahoraMs - r.fechaInicioMs) / 60000);
      return {
        type: 'retiro_atascado',
        severity: 'critical',
        usuarioId: r.firebaseUid,
        transactionId: r.transactionId,
        description: `Retiro TxID=${r.transactionId} (S/ ${r.amount.toFixed(2)}) lleva ${minutos} min en estado 'pending'. El saldo ya se descontó de la plataforma pero no hay confirmación de que Odoo lo recibió (ni de que se revirtió).`,
        suggestedFix: 'Revisar manualmente en Odoo si la transacción llegó. Si no llegó, ejecutar revertirRetiro() para devolver el saldo al usuario.',
        detectedAt: new Date(),
      };
    });
}
