/**
 * Exporta las reglas de Firestore REALMENTE desplegadas en producción,
 * usando la Firebase Rules API (firebaserules.googleapis.com) autenticada
 * con la credencial de Admin SDK.
 *
 * SOLO LECTURA — no modifica nada en producción. No despliega el borrador
 * (firestore.rules) ni toca la configuración real; solo la lee y la guarda
 * localmente para poder compararla a mano contra el borrador.
 *
 * Uso: npx tsx scripts/exportarReglasProduccion.ts
 * Salida: firestore.rules.PRODUCCION-REAL.txt (gitignorado — ver abajo)
 */

import { loadEnvConfig } from '@next/env';
import { writeFileSync } from 'fs';

async function main() {
  loadEnvConfig(process.cwd(), true);

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no se cargó desde .env.local.');
  }

  const { getAdminAccessToken, getAdminProjectId } = await import('../lib/firebase/admin');

  const projectId = getAdminProjectId();
  const token = await getAdminAccessToken();

  console.log(`Consultando reglas de Firestore para el proyecto: ${projectId}\n`);

  // 1. Averiguar cuál es el "release" activo de Firestore (qué ruleset está
  //    realmente sirviendo tráfico ahora mismo).
  const releaseRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (releaseRes.status === 404) {
    console.log(
      '❌ No hay ningún release de reglas de Firestore para este proyecto — probablemente nunca se desplegaron reglas explícitas (rige el default de Firestore, que deniega todo, o el proyecto está en "modo de prueba" con reglas abiertas temporales).'
    );
    return;
  }

  if (!releaseRes.ok) {
    throw new Error(`Error consultando el release (${releaseRes.status}): ${await releaseRes.text()}`);
  }

  const release = await releaseRes.json();
  console.log('Release activo:', {
    rulesetName: release.rulesetName,
    updateTime: release.updateTime,
  });

  // 2. Traer el contenido real del ruleset referenciado por ese release.
  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!rulesetRes.ok) {
    throw new Error(`Error consultando el ruleset (${rulesetRes.status}): ${await rulesetRes.text()}`);
  }

  const ruleset = await rulesetRes.json();
  const archivo = ruleset.source?.files?.[0];

  if (!archivo?.content) {
    throw new Error('El ruleset no tiene contenido de reglas (respuesta inesperada de la API).');
  }

  console.log(`\nReglas reales obtenidas (${archivo.content.split('\n').length} líneas, creadas: ${ruleset.createTime}).\n`);

  const salida = 'firestore.rules.PRODUCCION-REAL.txt';
  writeFileSync(
    salida,
    `// Exportado de producción (${projectId}) el ${new Date().toISOString()}\n` +
      `// Ruleset: ${release.rulesetName}\n` +
      `// Creado: ${ruleset.createTime}\n` +
      `// ESTO ES SOLO PARA COMPARAR — no es el archivo que se despliega.\n\n` +
      archivo.content
  );

  console.log(`✅ Guardado en ${salida} — compará ese archivo contra firestore.rules a mano o con tu editor.`);
}

main().catch((error) => {
  console.error('\n❌ Error exportando las reglas:', error);
  process.exitCode = 1;
});
