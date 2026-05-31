/**
 * ⚠️ SCRIPT DE ELIMINACIÓN MASIVA DE BASE DE DATOS
 * 
 * Este script elimina TODA la base de datos de Firebase:
 * - Todas las colecciones de Firestore
 * - Todos los archivos de Storage
 * - Todos los usuarios de Authentication
 * 
 * ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE
 * Solo usar en ambiente de desarrollo con datos de prueba
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Configurar Firebase Admin
// IMPORTANTE: Necesitas el archivo serviceAccountKey.json
// Descárgalo desde: Firebase Console > Project Settings > Service Accounts
try {
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + '.appspot.com'
  });
  
  console.log('✅ Firebase Admin inicializado correctamente');
} catch (error) {
  console.error('❌ Error al inicializar Firebase Admin');
  console.error('');
  console.error('Necesitas el archivo serviceAccountKey.json');
  console.error('Descárgalo desde:');
  console.error('Firebase Console > ⚙️ Settings > Service Accounts > Generate new private key');
  console.error('');
  console.error('Guárdalo como: scripts/serviceAccountKey.json');
  process.exit(1);
}

const db = admin.firestore();
const storage = admin.storage();
const auth = admin.auth();

/**
 * Eliminar una colección completa
 */
async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  try {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
      resolve();
      return;
    }

    // Eliminar documentos en batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Continuar con el siguiente batch
    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

/**
 * Eliminar todos los archivos de Storage
 */
async function deleteAllStorage() {
  try {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles();
    
    if (files.length === 0) {
      console.log('   ℹ️  No hay archivos en Storage');
      return;
    }

    console.log(`   📁 Encontrados ${files.length} archivo(s)`);
    
    for (const file of files) {
      await file.delete();
      console.log(`   🗑️  Eliminado: ${file.name}`);
    }
  } catch (error) {
    console.error('   ❌ Error al eliminar Storage:', error.message);
  }
}

/**
 * Eliminar todos los usuarios de Authentication
 */
async function deleteAllUsers() {
  try {
    const listUsersResult = await auth.listUsers();
    const users = listUsersResult.users;
    
    if (users.length === 0) {
      console.log('   ℹ️  No hay usuarios en Authentication');
      return;
    }

    console.log(`   👥 Encontrados ${users.length} usuario(s)`);
    
    for (const user of users) {
      await auth.deleteUser(user.uid);
      console.log(`   🗑️  Eliminado: ${user.email || user.uid}`);
    }
  } catch (error) {
    console.error('   ❌ Error al eliminar usuarios:', error.message);
  }
}

/**
 * Eliminar subcolecciones de un documento
 */
async function deleteSubcollections(docRef) {
  const subcollections = await docRef.listCollections();
  
  for (const subcollection of subcollections) {
    console.log(`   📂 Eliminando subcolección: ${subcollection.id}`);
    await deleteCollection(subcollection.path);
  }
}

/**
 * Eliminar colección con subcolecciones
 */
async function deleteCollectionWithSubcollections(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  
  // Eliminar subcolecciones de cada documento
  for (const doc of snapshot.docs) {
    await deleteSubcollections(doc.ref);
  }
  
  // Eliminar la colección principal
  await deleteCollection(collectionPath);
}

/**
 * Función principal de eliminación
 */
async function deleteAllData() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('⚠️  ELIMINACIÓN MASIVA DE BASE DE DATOS FIREBASE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  try {
    // 1. Eliminar colección de productos (con subcolecciones de gastos)
    console.log('🗑️  [1/6] Eliminando productos y gastos...');
    const productosSnapshot = await db.collection('productos').get();
    console.log(`   📦 Encontrados ${productosSnapshot.size} producto(s)`);
    
    for (const doc of productosSnapshot.docs) {
      // Eliminar subcolección de gastos
      const gastosSnapshot = await doc.ref.collection('gastos').get();
      if (gastosSnapshot.size > 0) {
        console.log(`   💰 Eliminando ${gastosSnapshot.size} gasto(s) del proyecto ${doc.id}`);
        await deleteCollection(`productos/${doc.id}/gastos`);
      }
    }
    await deleteCollection('productos');
    console.log('   ✅ Productos eliminados');
    console.log('');

    // 2. Eliminar usuarios
    console.log('🗑️  [2/6] Eliminando usuarios...');
    const usuariosSnapshot = await db.collection('usuarios').get();
    console.log(`   👤 Encontrados ${usuariosSnapshot.size} usuario(s)`);
    await deleteCollection('usuarios');
    console.log('   ✅ Usuarios eliminados');
    console.log('');

    // 3. Eliminar billeteras
    console.log('🗑️  [3/6] Eliminando billeteras...');
    const billeterasSnapshot = await db.collection('billeteras').get();
    console.log(`   💳 Encontrados ${billeterasSnapshot.size} billetera(s)`);
    await deleteCollection('billeteras');
    console.log('   ✅ Billeteras eliminadas');
    console.log('');

    // 4. Eliminar movimientos
    console.log('🗑️  [4/6] Eliminando movimientos...');
    const movimientosSnapshot = await db.collection('movimientos').get();
    console.log(`   📊 Encontrados ${movimientosSnapshot.size} movimiento(s)`);
    await deleteCollection('movimientos');
    console.log('   ✅ Movimientos eliminados');
    console.log('');

    // 5. Eliminar Storage
    console.log('🗑️  [5/6] Eliminando archivos de Storage...');
    await deleteAllStorage();
    console.log('   ✅ Storage limpiado');
    console.log('');

    // 6. Eliminar usuarios de Authentication
    console.log('🗑️  [6/6] Eliminando usuarios de Authentication...');
    await deleteAllUsers();
    console.log('   ✅ Authentication limpiado');
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ TODA LA BASE DE DATOS HA SIDO ELIMINADA EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Resumen:');
    console.log(`   • Productos: ${productosSnapshot.size} eliminados`);
    console.log(`   • Usuarios: ${usuariosSnapshot.size} eliminados`);
    console.log(`   • Billeteras: ${billeterasSnapshot.size} eliminadas`);
    console.log(`   • Movimientos: ${movimientosSnapshot.size} eliminados`);
    console.log('   • Storage: Limpiado');
    console.log('   • Authentication: Limpiado');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ ERROR DURANTE LA ELIMINACIÓN:');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

/**
 * Confirmación interactiva
 */
function confirmarEliminacion() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('');
  console.log('⚠️⚠️⚠️  ADVERTENCIA FINAL  ⚠️⚠️⚠️');
  console.log('');
  console.log('Estás a punto de ELIMINAR TODA LA BASE DE DATOS');
  console.log('Esta acción es IRREVERSIBLE y eliminará:');
  console.log('');
  console.log('  ❌ Todos los proyectos');
  console.log('  ❌ Todos los usuarios');
  console.log('  ❌ Todas las inversiones');
  console.log('  ❌ Todos los gastos');
  console.log('  ❌ Todas las imágenes');
  console.log('  ❌ Todos los documentos');
  console.log('');

  rl.question('¿Estás ABSOLUTAMENTE SEGURO? Escribe "ELIMINAR TODO" para continuar: ', (answer) => {
    rl.close();
    
    if (answer === 'ELIMINAR TODO') {
      console.log('');
      console.log('✅ Confirmación recibida. Iniciando eliminación...');
      deleteAllData();
    } else {
      console.log('');
      console.log('❌ Eliminación cancelada (respuesta incorrecta)');
      console.log('   Debes escribir exactamente: ELIMINAR TODO');
      console.log('');
      process.exit(0);
    }
  });
}

// Ejecutar
if (process.argv.includes('--force')) {
  // Modo forzado (sin confirmación)
  console.log('⚠️  Modo --force activado, eliminando sin confirmación...');
  deleteAllData();
} else {
  // Modo normal (con confirmación)
  confirmarEliminacion();
}
