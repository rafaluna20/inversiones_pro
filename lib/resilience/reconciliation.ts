/**
 * Odoo-Firebase Reconciliation Module
 *
 * Job de servidor de confianza que compara el estado de Firestore contra sí
 * mismo (inversiones vs proyectos) y detecta señales de que el puente con
 * Odoo (Validacion/acreditarDesdeBilletera.ts, retirarHaciaBilletera.ts) se
 * quedó a medio camino.
 *
 * Casos que detecta:
 * - Inversión confirmada sin transacción Odoo asociada.
 * - Monto invertido (Firestore) desincronizado del monto recaudado del proyecto.
 * - Retiro descontado de la plataforma que lleva demasiado tiempo sin
 *   confirmarse ni revertirse en `plataforma_retiros` (dinero en limbo).
 *
 * IMPORTANTE: usa Firebase Admin SDK (lib/firebase/admin.ts), NO el SDK de
 * cliente — necesita leer colecciones completas sin pasar por
 * firestore.rules. Por diseño, esto no debe ejecutarse desde el navegador ni
 * exponerse como Server Action pública; está pensado para correr como script
 * (ver scripts/ejecutarReconciliacion.ts) o, más adelante, como Cloud
 * Function programada.
 */

import { getAdminDb } from '@/lib/firebase/admin';
import { logger, financeLogger } from '@/lib/performance/logger';
import {
  detectarInversionesSinTransaccionOdoo,
  detectarDesincronizacionDeMontos,
  detectarRetirosAtascados,
  type ReconciliationIssue,
  type InversionResumen,
  type ProyectoResumen,
  type RetiroPendienteResumen,
} from './reconciliation-logic';

export type { ReconciliationIssue } from './reconciliation-logic';

export interface ReconciliationReport {
  timestamp: Date;
  totalInversiones: number;
  totalRetirosPendientesRevisados: number;
  issues: ReconciliationIssue[];
  fixedIssues: ReconciliationIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Ejecuta reconciliación completa Odoo-Firebase.
 *
 * @param autoFix - si es true, corrige automáticamente SOLO los problemas
 *   seguros de auto-corregir (ver `tryFixIssue`). Nunca toca saldo ni
 *   journals de idempotencia sin intervención humana.
 */
export async function reconcileOdooFirebase(autoFix: boolean = false): Promise<ReconciliationReport> {
  logger.info('🔄 Iniciando reconciliación Odoo-Firebase', { autoFix });

  const startTime = Date.now();
  const issues: ReconciliationIssue[] = [];
  const fixedIssues: ReconciliationIssue[] = [];
  const db = getAdminDb();

  try {
    // 1. Inversiones confirmadas sin transacción Odoo
    const inversionesSnap = await db.collection('inversiones').where('confirmada', '==', true).get();
    const inversiones: InversionResumen[] = inversionesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        proyectoId: data.proyectoId,
        usuarioId: data.usuarioId,
        confirmada: data.confirmada,
        montoInvertido: data.montoInvertido || 0,
        etapa: data.etapa,
        transaccionOdooId: data.transaccionOdoo?.transaccionId,
      };
    });

    logger.info(`📊 Inversiones confirmadas en Firebase: ${inversiones.length}`);
    issues.push(...detectarInversionesSinTransaccionOdoo(inversiones));

    // 2. Montos por proyecto vs. suma de inversiones confirmadas
    const proyectosSnap = await db.collection('productos').where('modeloBifasico', '==', true).get();

    for (const proyectoDoc of proyectosSnap.docs) {
      const proyectoData = proyectoDoc.data();
      if (!proyectoData.etapas) continue;

      const proyectoResumen: ProyectoResumen = {
        id: proyectoDoc.id,
        montoRecaudadoTierra: proyectoData.etapas.tierra?.montoRecaudado || 0,
        montoRecaudadoConstruccion: proyectoData.etapas.construccion?.montoRecaudado || 0,
      };

      const inversionesDelProyecto = inversiones.filter((inv) => inv.proyectoId === proyectoDoc.id);
      const proyectoIssues = detectarDesincronizacionDeMontos(proyectoDoc.id, inversionesDelProyecto, proyectoResumen);
      issues.push(...proyectoIssues);

      if (autoFix) {
        for (const issue of proyectoIssues) {
          const fixed = await tryFixIssue(issue);
          if (fixed) fixedIssues.push(issue);
        }
      }
    }

    // 3. Retiros descontados de la plataforma que llevan demasiado tiempo
    //    en 'pending' sin confirmarse ni revertirse.
    const retirosSnap = await db.collection('plataforma_retiros').where('status', '==', 'pending').get();
    const retiros: RetiroPendienteResumen[] = retirosSnap.docs.map((d) => {
      const data = d.data();
      const fecha = data.fecha_inicio ? new Date(data.fecha_inicio).getTime() : 0;
      return {
        transactionId: d.id,
        firebaseUid: data.firebase_uid,
        amount: data.amount || 0,
        fechaInicioMs: fecha,
      };
    });
    issues.push(...detectarRetirosAtascados(retiros));

    const duration = Date.now() - startTime;
    const summary = {
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
    };

    const report: ReconciliationReport = {
      timestamp: new Date(),
      totalInversiones: inversiones.length,
      totalRetirosPendientesRevisados: retiros.length,
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

    await saveReconciliationReport(report);

    if (summary.critical > 0) {
      await enviarAlertaCritica(report);
    }

    return report;
  } catch (error) {
    logger.error('❌ Error en reconciliación', { error });
    throw error;
  }
}

/**
 * Intenta arreglar un issue automáticamente.
 *
 * Deliberadamente solo `monto_mismatch` es auto-corregible: es un campo
 * derivado (suma de inversiones confirmadas), recalcularlo no mueve dinero
 * ni toca ningún journal de idempotencia. `missing_odoo` y `retiro_atascado`
 * involucran dinero real y SIEMPRE requieren revisión humana — nunca deben
 * auto-corregirse en silencio.
 */
async function tryFixIssue(issue: ReconciliationIssue): Promise<boolean> {
  if (issue.type === 'monto_mismatch' && issue.proyectoId) {
    return recalcularMontoProyecto(issue.proyectoId);
  }
  return false;
}

/**
 * Recalcula el monto recaudado de un proyecto a partir de sus inversiones
 * confirmadas. Único "auto-fix" permitido: no mueve saldo de nadie.
 */
export async function recalcularMontoProyecto(proyectoId: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const snap = await db
      .collection('inversiones')
      .where('proyectoId', '==', proyectoId)
      .where('confirmada', '==', true)
      .get();

    const inversiones = snap.docs.map((d) => d.data());

    const montoTierra = inversiones
      .filter((inv) => inv.etapa === 'tierra')
      .reduce((sum, inv) => sum + (inv.montoInvertido || 0), 0);

    const montoConstruccion = inversiones
      .filter((inv) => inv.etapa === 'construccion')
      .reduce((sum, inv) => sum + (inv.montoInvertido || 0), 0);

    await db.collection('productos').doc(proyectoId).update({
      'etapas.tierra.montoRecaudado': montoTierra,
      'etapas.construccion.montoRecaudado': montoConstruccion,
    });

    financeLogger.info('✅ Monto de proyecto recalculado', { proyectoId, montoTierra, montoConstruccion });
    return true;
  } catch (error) {
    logger.error('Error al recalcular monto de proyecto', { proyectoId, error });
    return false;
  }
}

async function saveReconciliationReport(report: ReconciliationReport): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection('reconciliation_reports').add({
      ...report,
      timestamp: report.timestamp.toISOString(),
      issues: report.issues.map((i) => ({ ...i, detectedAt: i.detectedAt.toISOString() })),
    });
    logger.info('📄 Reporte de reconciliación guardado');
  } catch (error) {
    logger.error('Error al guardar reporte', { error });
  }
}

/**
 * Alerta por webhook cuando hay problemas críticos. No-op si no hay ninguno
 * de los webhooks configurado (ver WEBHOOK_SLACK / WEBHOOK_DISCORD en
 * .env.example) — no falla la reconciliación por esto.
 */
async function enviarAlertaCritica(report: ReconciliationReport): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_SLACK || process.env.WEBHOOK_DISCORD;
  if (!webhookUrl) return;

  const criticos = report.issues.filter((i) => i.severity === 'critical');
  const texto = [
    `🚨 Reconciliación Odoo-Firebase: ${criticos.length} problema(s) crítico(s) detectado(s)`,
    ...criticos.slice(0, 10).map((i) => `• ${i.description}`),
  ].join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texto, content: texto }),
    });
  } catch (error) {
    logger.error('Error al enviar alerta de reconciliación', { error });
  }
}

export const reconciliation = {
  reconcileOdooFirebase,
  recalcularMontoProyecto,
};

export default reconciliation;
