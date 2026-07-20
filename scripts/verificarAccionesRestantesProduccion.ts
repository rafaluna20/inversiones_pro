/**
 * Verificación manual, única, de eliminarInversionAction,
 * distribuirGananciaLegacyAction y depositarRecaudadoAction contra Firebase
 * de PRODUCCIÓN real (no el emulador) — complementa
 * verificarInversionProduccion.ts, que ya probó invertirEnProyectoAction.
 *
 * Mismo criterio: usuarios y proyectos de prueba claramente marcados como
 * TEST, se limpia TODO al final (incluso si algo falla a mitad de camino),
 * y cada acción se prueba en su propio try/catch para que un fallo no
 * bloquee la verificación de las demás.
 *
 * Uso: npx tsx scripts/verificarAccionesRestantesProduccion.ts
 */

import { loadEnvConfig } from '@next/env';

const MARCA = `TEST-ACCIONES-${Date.now()}`;

interface ResultadoTest {
  nombre: string;
  ok: boolean;
  detalle: string;
}

async function main() {
  const { loadedEnvFiles } = loadEnvConfig(process.cwd(), true);
  console.log('Archivos .env cargados:', loadedEnvFiles.map((f) => f.path));

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no se cargó desde .env.local.');
  }

  // Imports diferidos a propósito (ver verificarInversionProduccion.ts):
  // deben resolverse DESPUÉS de que loadEnvConfig ya corrió.
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const { auth } = await import('../lib/firebase/config');
  const { getAdminDb, getAdminAuth } = await import('../lib/firebase/admin');
  const {
    invertirEnProyectoAction,
    eliminarInversionAction,
    distribuirGananciaLegacyAction,
    depositarRecaudadoAction,
  } = await import('../app/actions/inversion');

  console.log(`\n=== Verificación real (marca: ${MARCA}) ===\n`);

  const db = getAdminDb();
  const adminAuth = getAdminAuth();

  const uidsCreados: string[] = [];
  const proyectosCreados: string[] = [];
  const resultados: ResultadoTest[] = [];

  async function crearUsuario(prefijo: string, saldo: number) {
    const email = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example-test.invalid`;
    const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-verificacion-123');
    uidsCreados.push(cred.user.uid);
    await db.collection('usuarios').doc(cred.user.uid).set({ saldo, _marca: MARCA });
    const idToken = await cred.user.getIdToken();
    return { uid: cred.user.uid, idToken };
  }

  async function crearProyecto(precio: number, creadorId: string) {
    const ref = db.collection('productos').doc();
    proyectosCreados.push(ref.id);
    await ref.set({
      nombre: `[${MARCA}] Proyecto desechable — no invertir`,
      precio,
      creador: { id: creadorId },
      inversores: [],
      _marca: MARCA,
    });
    return ref;
  }

  async function leerSaldo(uid: string): Promise<number | undefined> {
    const snap = await db.collection('usuarios').doc(uid).get();
    return snap.data()?.saldo;
  }

  async function leerUsuario(uid: string) {
    const snap = await db.collection('usuarios').doc(uid).get();
    return snap.data();
  }

  async function leerProducto(ref: FirebaseFirestore.DocumentReference) {
    const snap = await ref.get();
    return snap.data();
  }

  // ── TEST 1: eliminarInversionAction ─────────────────────────────────────
  try {
    console.log('▶ eliminarInversionAction...');
    const creador = await crearUsuario('creador-elim', 0);
    const inversor = await crearUsuario('inversor-elim', 5000);
    const proyectoRef = await crearProyecto(10000, creador.uid);

    await invertirEnProyectoAction(inversor.idToken, proyectoRef.id, { descripcion: 't', cubos: 10, categoria: 'Inversor' }, false);
    const saldoAntes = await leerSaldo(inversor.uid); // 4000 esperado

    // Negativo: un tercero no puede eliminar la inversión ajena.
    const otro = await crearUsuario('otro-elim', 0);
    const intentoAjeno = await eliminarInversionAction(otro.idToken, proyectoRef.id);
    const bloqueoOk = intentoAjeno.ok === false;

    const r = await eliminarInversionAction(inversor.idToken, proyectoRef.id);
    const saldoDespues = await leerSaldo(inversor.uid);
    const producto = await leerProducto(proyectoRef);
    const inversoresVacio = (producto?.inversores || []).length === 0;

    const ok = r.ok && saldoAntes === 4000 && saldoDespues === 5000 && inversoresVacio && bloqueoOk;
    resultados.push({
      nombre: 'eliminarInversionAction',
      ok,
      detalle: `saldoAntes=${saldoAntes} saldoDespues=${saldoDespues} inversores=${producto?.inversores?.length} bloqueoTercero=${bloqueoOk}`,
    });
  } catch (error) {
    resultados.push({ nombre: 'eliminarInversionAction', ok: false, detalle: String(error) });
  }

  // ── TEST 2: distribuirGananciaLegacyAction ──────────────────────────────
  try {
    console.log('▶ distribuirGananciaLegacyAction...');
    const creador = await crearUsuario('creador-dist', 2000);
    const inversor = await crearUsuario('inversor-dist', 5000);
    const proyectoRef = await crearProyecto(1000, creador.uid);

    await invertirEnProyectoAction(inversor.idToken, proyectoRef.id, { descripcion: 't', cubos: 100, categoria: 'Inversor' }, false);
    // costoTotal = 100 * (1000/100) = 1000 -> saldo inversor: 5000 -> 4000

    // Negativo: alguien que no es el creador no puede distribuir.
    const intentoAjeno = await distribuirGananciaLegacyAction(inversor.idToken, proyectoRef.id, 1500, false);
    const bloqueoOk = intentoAjeno.ok === false;

    const gananciaTotal = 1500; // >= precio (1000)
    const r = await distribuirGananciaLegacyAction(creador.idToken, proyectoRef.id, gananciaTotal, false);

    const saldoCreador = await leerSaldo(creador.uid); // 2000 - 1500 = 500
    const saldoInversor = await leerSaldo(inversor.uid); // 4000 + 1500 (100% de los cubos) = 5500
    const producto = await leerProducto(proyectoRef);

    const ok =
      r.ok &&
      bloqueoOk &&
      saldoCreador === 500 &&
      saldoInversor === 5500 &&
      producto?.estado === false;

    resultados.push({
      nombre: 'distribuirGananciaLegacyAction',
      ok,
      detalle: `saldoCreador=${saldoCreador} saldoInversor=${saldoInversor} estado=${producto?.estado} bloqueoNoCreador=${bloqueoOk}`,
    });
  } catch (error) {
    resultados.push({ nombre: 'distribuirGananciaLegacyAction', ok: false, detalle: String(error) });
  }

  // ── TEST 3: depositarRecaudadoAction ────────────────────────────────────
  try {
    console.log('▶ depositarRecaudadoAction...');
    const creador = await crearUsuario('creador-dep', 0);
    const inversor = await crearUsuario('inversor-dep', 5000);
    const proyectoRef = await crearProyecto(1000, creador.uid);

    await invertirEnProyectoAction(inversor.idToken, proyectoRef.id, { descripcion: 't', cubos: 50, categoria: 'Inversor' }, false);
    // costoTotal = 50 * (1000/100) = 500 -> se acumula en creador.saldoRecaudado

    // Negativo: alguien que no es el creador no puede depositar.
    const intentoAjeno = await depositarRecaudadoAction(inversor.idToken, proyectoRef.id);
    const bloqueoOk = intentoAjeno.ok === false;

    const r = await depositarRecaudadoAction(creador.idToken, proyectoRef.id);

    const creadorData = await leerUsuario(creador.uid);
    const producto = await leerProducto(proyectoRef);
    const saldoRecaudadoLimpio = !(creadorData?.saldoRecaudado || []).some((i: any) => i.idProducto === proyectoRef.id);

    const ok =
      r.ok &&
      bloqueoOk &&
      creadorData?.saldo === 500 &&
      producto?.depositoRecaudado === true &&
      saldoRecaudadoLimpio;

    resultados.push({
      nombre: 'depositarRecaudadoAction',
      ok,
      detalle: `saldoCreador=${creadorData?.saldo} depositoRecaudado=${producto?.depositoRecaudado} saldoRecaudadoLimpio=${saldoRecaudadoLimpio} bloqueoNoCreador=${bloqueoOk}`,
    });

    // Segundo intento debe fallar (ya depositado) — prueba la idempotencia.
    const segundoIntento = await depositarRecaudadoAction(creador.idToken, proyectoRef.id);
    resultados.push({
      nombre: 'depositarRecaudadoAction (doble depósito bloqueado)',
      ok: segundoIntento.ok === false,
      detalle: `resultado=${JSON.stringify(segundoIntento)}`,
    });
  } catch (error) {
    resultados.push({ nombre: 'depositarRecaudadoAction', ok: false, detalle: String(error) });
  } finally {
    // ── LIMPIEZA — pase lo que pase arriba, no debe quedar nada de prueba.
    console.log('\nLimpiando datos de prueba...');
    for (const id of proyectosCreados) {
      await db.collection('productos').doc(id).delete();
    }
    console.log(`   ${proyectosCreados.length} proyecto(s) eliminado(s).`);

    for (const uid of uidsCreados) {
      await db.collection('usuarios').doc(uid).delete();
      await adminAuth.deleteUser(uid).catch(() => {});
    }
    console.log(`   ${uidsCreados.length} usuario(s) eliminado(s) (Firestore + Auth).`);
  }

  // ── RESUMEN ────────────────────────────────────────────────────────────
  console.log('\n=== RESUMEN ===');
  let todoOk = true;
  for (const r of resultados) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.nombre} — ${r.detalle}`);
    if (!r.ok) todoOk = false;
  }

  if (todoOk) {
    console.log('\n✅ TODAS LAS VERIFICACIONES PASARON contra producción real.\n');
  } else {
    console.log('\n❌ Al menos una verificación falló — revisar detalle arriba.\n');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('\n❌ Error no controlado durante la verificación:', error);
  process.exitCode = 1;
});
