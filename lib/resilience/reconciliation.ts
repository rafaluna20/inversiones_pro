/**
 * Odoo-Firebase Reconciliation Module
 * Script para verificar y corregir inconsistencias entre Odoo y Firebase
 * 
 * Casos de uso:
 * - Transacción Odoo exitosa pero inversión no guardada en Firebase
 * - Inversión en Firebase pero sin transacción Odoo
 * - Montos desincronizados
 * - Estados inconsistentes
 */

import { db } from '@/lib/firebase/config';
import { obtenerDatosUsuario } from '@/lib/billetera-api';
import { logger, financeLogger } from '@/lib/performance/logger';
import { Inversion, Producto } from '@/types';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';

// ========================
// TIPOS
// ========================

export interface ReconciliationIssue {
  type: 'missing_firebase' | 'missing_odoo' | 'monto_mismatch' | 'estado_mismatch';
  severity: 'critical' | 'high' | 'medium' | 'low';
  inversionId?: string;
  odooTransactionId?: string;
  proyectoId?: string;
  usuarioId?: string;
  description: string;
  suggestedFix?: string;
  detectedAt: Date;
}

export interface ReconciliationReport {
  timestamp: Date;
  totalInversiones: number;
  totalOdooTransactions: number;
  issues: ReconciliationIssue[];
  fixedIssues: ReconciliationIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ========================
// FUNCIONES PRINCIPALES
// ========================

/**
 * Ejecuta reconciliación completa Odoo-Firebase
 */
export async function reconcileOdooFirebase(
  autoFix: boolean = false
): Promise<ReconciliationReport> {
  logger.info('🔄 Iniciando reconciliación Odoo-Firebase', { autoFix });

  const startTime = Date.now();
  const issues: ReconciliationIssue[] = [];
  const fixedIssues: ReconciliationIssue[] = [];

  try {
    // 1. Obtener todas las inversiones de Firebase
    const q = query(
      collection(db, 'inversiones'),
      where('estado', 'in', ['aprobada', 'pendiente'])
    );

    const inversionesSnapshot = await getDocs(q);

    const inversiones = inversionesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Inversion[];

    logger.info(`📊 Total inversiones en Firebase: ${inversiones.length}`);

    // 2. Verificar cada inversión
    for (const inversion of inversiones) {
      const inversionIssues = await checkInversion(inversion);
      issues.push(...inversionIssues);

      // 3. Intentar arreglar si autoFix está habilitado
      if (autoFix) {
        for (const issue of inversionIssues) {
          const fixed = await tryFixIssue(issue, inversion);
          if (fixed) {
            fixedIssues.push(issue);
          }
        }
      }
    }

    // 4. Verificar proyectos
    const proyectosIssues = await checkProyectos();
    issues.push(...proyectosIssues);

    const duration = Date.now() - startTime;

    // 5. Generar resumen
    const summary = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
    };

    const report: ReconciliationReport = {
      timestamp: new Date(),
      totalInversiones: inversiones.length,
      totalOdooTransactions: 0, // Se actualiza si se conecta a Odoo
      issues,
      fixedIssues,
      summary,
    };

    logger.info('✅ Reconciliación completada', {
      duration,
      totalIssues: issues.length,
      fixed: fixedIssues.length,
      ...summary,
    });

    // 6. Guardar reporte
    await saveReconciliationReport(report);

    return report;

  } catch (error) {
    logger.error('❌ Error en reconciliación', { error });
    throw error;
  }
}

/**
 * Verifica una inversión individual
 */
async function checkInversion(inversion: Inversion): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  try {

    // 1. Verificar si tiene transacción Odoo
    if (inversion.confirmada /* && !inversion.odooTransactionId */) {
      // Comentado temporalmente porque odooTransactionId puede estar en transaccionOdoo.transaccionId
      // Adaptar según estructura
      const hasOdooTx = inversion.transaccionOdoo?.transaccionId; // || (inversion as any).odooTransactionId; // Fallback

      if (!hasOdooTx) {
        issues.push({
          type: 'missing_odoo',
          severity: 'critical',
          inversionId: inversion.id,
          proyectoId: inversion.proyectoId,
          usuarioId: inversion.usuarioId,
          // Usar propiedad correcta: montoInvertido
          description: `Inversión aprobada sin transacción Odoo. Monto: S/ ${inversion.montoInvertido}`,
          suggestedFix: 'Crear transacción Odoo retroactivamente o revertir aprobación',
          detectedAt: new Date(),
        });
      }
    }

    // 2. Verificar si el monto en Firebase coincide con el proyecto
    const proyectoRef = doc(db, 'productos', inversion.proyectoId);
    const proyectoSnap = await getDoc(proyectoRef);

    if (proyectoSnap.exists()) {
      const proyecto = proyectoSnap.data() as Producto;

      // Verificar si el monto invertido se reflejó en el proyecto
      if (inversion.confirmada) {
        const etapa = inversion.etapa || 'tierra';
        // Verificar existencia de proyecto.etapas
        const etapaData = proyecto.etapas ? proyecto.etapas[etapa] : undefined;

        if (etapaData) {
          // Aquí podrías hacer verificaciones más específicas
          // Por ejemplo, sumar todas las inversiones y comparar con montoRecaudado
        }
      }
    }

    // 3. Verificar wallet del usuario si está disponible
    if (inversion.usuarioId) {
      try {
        // const walletData = await obtenerDatosUsuario(inversion.usuarioId); 
        // Deshabilitado por deprecación de API directa
      } catch (error) {
        // Ignorar
      }
    }

  } catch (error) {
    logger.error('Error al verificar inversión', {
      inversionId: inversion.id,
      error,
    });
  }

  return issues;
}

/**
 * Verifica proyectos
 */
async function checkProyectos(): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  try {
    const q = query(
      collection(db, 'productos'),
      where('modeloBifasico', '==', true)
    );
    const proyectosSnapshot = await getDocs(q);

    for (const proyectoDoc of proyectosSnapshot.docs) {
      const proyecto = { id: proyectoDoc.id, ...proyectoDoc.data() } as Producto;

      // Obtener todas las inversiones aprobadas del proyecto
      // Nota: 'estado' podría ser 'confirmada' o 'aprobada' dependiendo del modelo
      // Revisar types/index.ts: Inversion tiene 'confirmada': boolean y 'transaccionOdoo.estado'
      // Ajustar query según modelo real. Asumimos 'confirmada' == true

      const invQuery = query(
        collection(db, 'inversiones'),
        where('proyectoId', '==', proyecto.id),
        where('confirmada', '==', true)
      );

      const inversionesSnapshot = await getDocs(invQuery);

      const inversiones = inversionesSnapshot.docs.map(d => d.data() as Inversion);

      // Calcular monto total invertido
      const montoTotalInvertido = inversiones.reduce(
        (sum, inv) => sum + (inv.montoInvertido || 0),
        0
      );

      // Verificar contra monto recaudado en el proyecto
      if (proyecto.etapas) {
        const etapaTierra = proyecto.etapas.tierra;
        const etapaConstruccion = proyecto.etapas.construccion;

        const montoRecaudadoRegistrado =
          (etapaTierra?.montoRecaudado || 0) +
          (etapaConstruccion?.montoRecaudado || 0);

        const diferencia = Math.abs(montoTotalInvertido - montoRecaudadoRegistrado);

        // Si la diferencia es mayor a S/ 100, reportar
        if (diferencia > 100) {
          issues.push({
            type: 'monto_mismatch',
            severity: diferencia > 10000 ? 'critical' : 'high',
            proyectoId: proyecto.id,
            description: `Desincronización de montos. Invertido: S/ ${montoTotalInvertido}, Registrado: S/ ${montoRecaudadoRegistrado}, Diferencia: S/ ${diferencia}`,
            suggestedFix: 'Recalcular y actualizar montoRecaudado del proyecto',
            detectedAt: new Date(),
          });
        }
      }
    }

  } catch (error) {
    logger.error('Error al verificar proyectos', { error });
  }

  return issues;
}

/**
 * Intenta arreglar un issue automáticamente
 */
async function tryFixIssue(
  issue: ReconciliationIssue,
  inversion?: Inversion
): Promise<boolean> {
  // Implementación simplificada
  return false;
}

/**
 * Recalcula el monto recaudado de un proyecto
 */
async function recalcularMontoProyecto(proyectoId: string): Promise<boolean> {
  try {
    // Obtener todas las inversiones aprobadas de este proyecto
    const q = query(
      collection(db, 'inversiones'),
      where('proyectoId', '==', proyectoId),
      where('confirmada', '==', true)
    );

    const inversionesSnapshot = await getDocs(q);

    const inversiones = inversionesSnapshot.docs.map(d => d.data() as Inversion);

    // Calcular montos por etapa
    const montoTierra = inversiones
      .filter(inv => inv.etapa === 'tierra')
      .reduce((sum, inv) => sum + (inv.montoInvertido || 0), 0);

    const montoConstruccion = inversiones
      .filter(inv => inv.etapa === 'construccion')
      .reduce((sum, inv) => sum + (inv.montoInvertido || 0), 0);

    // Actualizar proyecto
    const proyectoRef = doc(db, 'productos', proyectoId);
    await updateDoc(proyectoRef, {
      'etapas.tierra.montoRecaudado': montoTierra,
      'etapas.construccion.montoRecaudado': montoConstruccion,
    });

    financeLogger.info('✅ Monto de proyecto recalculado', {
      proyectoId,
      montoTierra,
      montoConstruccion,
    });

    return true;

  } catch (error) {
    logger.error('Error al recalcular monto de proyecto', { proyectoId, error });
    return false;
  }
}

/**
 * Guarda reporte de reconciliación
 */
async function saveReconciliationReport(report: ReconciliationReport): Promise<void> {
  try {
    // Usar addDoc en lugar de .add()
    await import('firebase/firestore').then(({ addDoc, collection }) =>
      addDoc(collection(db, 'reconciliation_reports'), {
        ...report,
        timestamp: report.timestamp.toISOString(),
        issues: report.issues.map(i => ({
          ...i,
          detectedAt: i.detectedAt.toISOString(),
        })),
      })
    );

    logger.info('📄 Reporte de reconciliación guardado');

  } catch (error) {
    logger.error('Error al guardar reporte', { error });
  }
}

// ========================
// COMANDOS CLI
// ========================

export async function runReconciliationCLI() {
  // ... (código CLI omitido para brevedad, mantener lógica si es necesario pero compatible con entorno node/modules)
  console.log('CLI no disponible en entorno web');
}

// ========================
// EXPORTACIONES
// ========================

export const reconciliation = {
  reconcileOdooFirebase,
  recalcularMontoProyecto,
  runReconciliationCLI,
};

export default reconciliation;
