/**
 * Ejecuta la reconciliación Odoo-Firebase manualmente (ver
 * lib/resilience/reconciliation.ts).
 *
 * Requiere la variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY con el JSON
 * completo de la service account, como string. NO usa ningún archivo de
 * credenciales del repositorio (ver lib/firebase/admin.ts).
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT_KEY="$(cat /ruta/a/tu-credencial.json)" \
 *     npx tsx scripts/ejecutarReconciliacion.ts
 *
 *   # Con auto-fix de los problemas seguros de corregir (solo monto_mismatch):
 *   FIREBASE_SERVICE_ACCOUNT_KEY="..." npx tsx scripts/ejecutarReconciliacion.ts --fix
 *
 * Código de salida: 1 si se encontró al menos un problema crítico (útil para
 * engancharlo a un cron/CI que alerte en base al exit code), 0 en caso
 * contrario.
 */

import { reconcileOdooFirebase } from '../lib/resilience/reconciliation';

async function main() {
  const autoFix = process.argv.includes('--fix');
  const reporte = await reconcileOdooFirebase(autoFix);

  console.log('\n═══════════════════════════════════════════');
  console.log('  REPORTE DE RECONCILIACIÓN ODOO ↔ FIREBASE');
  console.log('═══════════════════════════════════════════');
  console.log(`Inversiones confirmadas revisadas: ${reporte.totalInversiones}`);
  console.log(`Retiros 'pending' revisados:        ${reporte.totalRetirosPendientesRevisados}`);
  console.log(`Problemas encontrados:              ${reporte.issues.length}`);
  console.log(
    `  Críticos: ${reporte.summary.critical}  Altos: ${reporte.summary.high}  Medios: ${reporte.summary.medium}  Bajos: ${reporte.summary.low}`
  );
  if (autoFix) {
    console.log(`Corregidos automáticamente:         ${reporte.fixedIssues.length}`);
  }
  console.log('');

  for (const issue of reporte.issues) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.type} — ${issue.description}`);
  }

  if (reporte.issues.length === 0) {
    console.log('Sin problemas detectados.');
  }

  process.exitCode = reporte.summary.critical > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('Error ejecutando la reconciliación:', err);
  process.exitCode = 1;
});
