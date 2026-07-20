/**
 * Verificación manual, única, de app/actions/inversion.ts contra Firebase
 * de PRODUCCIÓN real (no el emulador).
 *
 * Crea un usuario y un proyecto de prueba claramente marcados como TEST,
 * invierte con el server action real, verifica el resultado, y borra TODO
 * al final (usuario de Auth, documentos de Firestore) — incluso si algo
 * falla a mitad de camino (try/finally).
 *
 * Requiere FIREBASE_SERVICE_ACCOUNT_KEY y las NEXT_PUBLIC_FIREBASE_* en
 * .env.local. Uso: npx tsx scripts/verificarInversionProduccion.ts
 *
 * IMPORTANTE: `loadEnvConfig` se llama y se espera ANTES de importar
 * cualquier módulo que lea `process.env` al cargarse (lib/firebase/config.ts,
 * lib/firebase/admin.ts). Con imports estáticos normales, TypeScript/Node
 * resuelve todos los `import` del archivo antes de ejecutar el cuerpo, así
 * que un `import` de esos módulos escrito "después" del loadEnvConfig en el
 * código igual corría antes en la práctica — por eso todo lo que depende de
 * variables de entorno se importa acá con `await import(...)` dentro de
 * main(), que si se difiere de verdad hasta que loadEnvConfig ya terminó.
 */

import { loadEnvConfig } from '@next/env';

const MARCA = `TEST-ADMIN-SDK-VERIFICACION-${Date.now()}`;

async function main() {
  const { loadedEnvFiles } = loadEnvConfig(process.cwd(), true);
  console.log('Archivos .env cargados:', loadedEnvFiles.map((f) => f.path));

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY no se cargó desde .env.local. Revisa que el archivo esté en la raíz del proyecto y tenga esa variable.'
    );
  }

  // Imports diferidos a propósito: recién ahora, con las env vars ya
  // cargadas, es seguro importar módulos que las leen al inicializarse.
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const { auth } = await import('../lib/firebase/config');
  const { getAdminDb, getAdminAuth } = await import('../lib/firebase/admin');
  const { invertirEnProyectoAction } = await import('../app/actions/inversion');

  console.log(`\n=== Verificación real (marca: ${MARCA}) ===\n`);

  const db = getAdminDb();
  const adminAuth = getAdminAuth();

  const uidsCreados: string[] = [];
  let proyectoId: string | undefined;
  let proyectoRef: FirebaseFirestore.DocumentReference | undefined;

  try {
    // 1. Crear usuario de prueba real en Firebase Auth + Firestore
    console.log('1. Creando usuario de Auth de prueba...');
    const email = `${MARCA.toLowerCase()}@example-test.invalid`;
    const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-verificacion-123');
    const uid = cred.user.uid;
    uidsCreados.push(uid);
    console.log(`   Usuario creado: ${uid} (${email})`);

    await db.collection('usuarios').doc(uid).set({
      saldo: 1000,
      _marca: MARCA,
      _nota: 'Usuario de prueba desechable — creado por verificarInversionProduccion.ts',
    });
    console.log('   Perfil Firestore creado con saldo de prueba: S/ 1000');

    // 2. Crear proyecto de prueba real
    console.log('2. Creando producto/proyecto de prueba...');
    proyectoRef = db.collection('productos').doc();
    proyectoId = proyectoRef.id;
    await proyectoRef.set({
      nombre: `[${MARCA}] Proyecto desechable — no invertir`,
      precio: 10000,
      creador: { id: uid },
      inversores: [],
      _marca: MARCA,
    });
    console.log(`   Proyecto creado: ${proyectoId}`);

    // 3. Obtener ID token REAL del usuario recién creado
    const idToken = await cred.user.getIdToken();

    // 4. Ejecutar el server action real contra producción
    console.log('3. Ejecutando invertirEnProyectoAction() contra producción real...');
    const resultado = await invertirEnProyectoAction(
      idToken,
      proyectoId,
      { descripcion: 'Verificación automática', cubos: 1, categoria: 'Inversor' },
      false
    );
    console.log('   Resultado:', resultado);

    if (!resultado.ok) {
      throw new Error(`El server action falló: ${resultado.mensaje}`);
    }

    // 5. Verificar el estado resultante
    console.log('4. Verificando estado en Firestore...');
    const usuarioSnap = await db.collection('usuarios').doc(uid).get();
    const saldoFinal = usuarioSnap.data()?.saldo;
    const proyectoSnap = await proyectoRef.get();
    const inversores = proyectoSnap.data()?.inversores ?? [];

    console.log(`   Saldo final del usuario: S/ ${saldoFinal} (esperado: 900)`);
    console.log(`   Inversores registrados: ${inversores.length} (esperado: 1)`);

    const saldoOk = saldoFinal === 900;
    const inversoresOk = inversores.length === 1 && inversores[0]?.usuarioId === uid;

    if (saldoOk && inversoresOk) {
      console.log('\n✅ VERIFICACIÓN EXITOSA: el server action funciona contra producción real.\n');
    } else {
      console.log('\n❌ VERIFICACIÓN FALLÓ: los datos resultantes no son los esperados.\n');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error);
    process.exitCode = 1;
  } finally {
    // 6. LIMPIEZA — pase lo que pase arriba, no debe quedar nada de prueba.
    console.log('5. Limpiando datos de prueba...');

    if (proyectoId) {
      await db.collection('productos').doc(proyectoId).delete();
      console.log(`   Proyecto ${proyectoId} eliminado.`);
    }

    for (const uid of uidsCreados) {
      await db.collection('usuarios').doc(uid).delete();
      await adminAuth.deleteUser(uid).catch(() => {});
      console.log(`   Usuario ${uid} eliminado (Firestore + Auth).`);
    }

    console.log('\nLimpieza completa.\n');
  }
}

main();
