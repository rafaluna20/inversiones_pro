/**
 * Verificación de SOLO LECTURA contra producción real: ¿la colección
 * `inversiones` (modelo bifásico) tiene datos reales, o está vacía porque
 * nada la escribe? Y ¿los proyectos reales tienen inversores en el array
 * `producto.inversores[]` (modelo legado) que "Liquidar proyecto" no vería
 * si consulta `inversiones` en vez de eso?
 *
 * No escribe nada. Solo cuenta y compara.
 * Uso: npx tsx scripts/verificarModeloInversion.ts
 */

import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd(), true);
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no se cargó desde .env.local.');
  }

  const { getAdminDb } = await import('../lib/firebase/admin');
  const db = getAdminDb();

  console.log('\n=== 1. Colección `inversiones` (modelo bifásico) ===');
  const inversionesSnap = await db.collection('inversiones').get();
  console.log(`Total de documentos: ${inversionesSnap.size}`);
  if (inversionesSnap.size > 0) {
    const confirmadas = inversionesSnap.docs.filter((d) => d.data().confirmada === true).length;
    console.log(`  De las cuales confirmada=true: ${confirmadas}`);
    console.log('  Primeros 3 proyectoId encontrados:', inversionesSnap.docs.slice(0, 3).map((d) => d.data().proyectoId));
  }

  console.log('\n=== 2. Proyectos reales y su array `inversores[]` (modelo legado) ===');
  const productosSnap = await db.collection('productos').get();
  console.log(`Total de proyectos: ${productosSnap.size}`);

  let proyectosConInversores = 0;
  let totalInversoresLegado = 0;
  let proyectosLiquidados = 0;
  const ejemplos: string[] = [];

  for (const doc of productosSnap.docs) {
    const data = doc.data();
    const inversores = Array.isArray(data.inversores) ? data.inversores : [];
    if (inversores.length > 0) {
      proyectosConInversores++;
      totalInversoresLegado += inversores.length;
      if (ejemplos.length < 3) {
        ejemplos.push(`  proyecto ${doc.id}: ${inversores.length} inversor(es) en inversores[], distribucionEjecutada=${data.distribucionEjecutada ?? false}`);
      }
    }
    if (data.distribucionEjecutada === true) proyectosLiquidados++;
  }

  console.log(`Proyectos con al menos 1 inversor en inversores[]: ${proyectosConInversores}`);
  console.log(`Total de entradas en inversores[] sumando todos los proyectos: ${totalInversoresLegado}`);
  console.log(`Proyectos ya marcados distribucionEjecutada=true: ${proyectosLiquidados}`);
  console.log('Ejemplos:');
  ejemplos.forEach((e) => console.log(e));

  console.log('\n=== 3. Cruce: ¿algún proyecto con inversores[] reales tiene también inversiones confirmadas en la colección `inversiones`? ===');
  let cruces = 0;
  for (const doc of productosSnap.docs) {
    const data = doc.data();
    const inversores = Array.isArray(data.inversores) ? data.inversores : [];
    if (inversores.length === 0) continue;
    const inversionesDelProyecto = inversionesSnap.docs.filter(
      (d) => d.data().proyectoId === doc.id && d.data().confirmada === true
    );
    if (inversionesDelProyecto.length > 0) {
      cruces++;
      console.log(`  ✅ proyecto ${doc.id} SÍ tiene inversiones confirmadas en la colección inversiones`);
    }
  }
  if (cruces === 0 && proyectosConInversores > 0) {
    console.log('  ❌ NINGÚN proyecto con inversores reales (inversores[]) tiene una sola inversión confirmada en la colección `inversiones`.');
    console.log('     Confirmado: ejecutarDistribucionAction (Liquidar proyecto) no encontraría inversores en ningún proyecto real hoy.');
  }

  console.log('\nListo. No se modificó ningún dato.\n');
}

main().catch((err) => {
  console.error('\n❌ Error:', err);
  process.exitCode = 1;
});
