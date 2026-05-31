/**
 * Script de Recuperación Manual de Saldo
 * ─────────────────────────────────────────────────────────────────────────────
 * Este script recupera manualmente una transacción pendiente de Odoo → Firebase
 * cuando el sistema de recuperación automática falla.
 * 
 * USO:
 * node scripts/recuperarSaldo.js <FIREBASE_UID> <TRANSACTION_ID> <AMOUNT>
 * 
 * EJEMPLO:
 * node scripts/recuperarSaldo.js "abc123xyz" "TRN-2026+00000065" 10000
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require('./app-invesiones-firebase-adminsdk-fbsvc-8f1623f8dd.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://app-invesiones.firebaseio.com'
});

const db = admin.firestore();

/**
 * Función principal de recuperación
 */
async function recuperarSaldo(firebaseUid, transactionId, amount) {
  console.log('\n🔧 Iniciando recuperación de saldo...\n');
  console.log(`📋 Parámetros:`);
  console.log(`   - Firebase UID: ${firebaseUid}`);
  console.log(`   - Transaction ID: ${transactionId}`);
  console.log(`   - Monto: S/ ${amount.toFixed(2)}\n`);

  try {
    // ─── PASO 1: Verificar si ya fue aplicada ───────────────────────────────
    console.log('🔍 Verificando si la transacción ya fue aplicada...');
    const cargaRef = db.collection('plataforma_cargas').doc(transactionId);
    const cargaSnap = await cargaRef.get();

    if (cargaSnap.exists()) {
      const data = cargaSnap.data();
      console.log('✅ La transacción YA fue aplicada anteriormente.');
      console.log(`   - Saldo anterior: S/ ${data.saldo_anterior?.toFixed(2) || '?'}`);
      console.log(`   - Saldo resultante: S/ ${data.saldo_resultante?.toFixed(2) || '?'}`);
      console.log(`   - Fecha: ${data.fecha || '?'}\n`);
      return {
        success: true,
        already_applied: true,
        newBalance: data.saldo_resultante
      };
    }

    console.log('⚠️  La transacción NO ha sido aplicada. Procediendo a acreditar...\n');

    // ─── PASO 2: Verificar que el usuario existe ────────────────────────────
    console.log('🔍 Verificando usuario en Firebase...');
    const usuarioRef = db.collection('usuarios').doc(firebaseUid);
    const usuarioSnap = await usuarioRef.get();

    if (!usuarioSnap.exists()) {
      console.error('❌ ERROR: Usuario no encontrado en Firebase.');
      console.error(`   UID: ${firebaseUid}\n`);
      return {
        success: false,
        error: 'Usuario no encontrado'
      };
    }

    const userData = usuarioSnap.data();
    const saldoActual = parseFloat(userData.saldo || 0);
    console.log(`✅ Usuario encontrado.`);
    console.log(`   - Nombre: ${userData.nombre || '?'}`);
    console.log(`   - Email: ${userData.email || '?'}`);
    console.log(`   - Saldo actual: S/ ${saldoActual.toFixed(2)}\n`);

    // ─── PASO 3: Calcular nuevo saldo ───────────────────────────────────────
    const nuevoSaldo = parseFloat((saldoActual + amount).toFixed(2));
    console.log('💰 Calculando nuevo saldo...');
    console.log(`   - Saldo actual: S/ ${saldoActual.toFixed(2)}`);
    console.log(`   - Monto a acreditar: S/ ${amount.toFixed(2)}`);
    console.log(`   - Nuevo saldo: S/ ${nuevoSaldo.toFixed(2)}\n`);

    // ─── PASO 4: Acreditar saldo ────────────────────────────────────────────
    console.log('💳 Acreditando saldo en Firebase...');
    await usuarioRef.update({
      saldo: nuevoSaldo
    });
    console.log('✅ Saldo actualizado correctamente.\n');

    // ─── PASO 5: Registrar en journal de idempotencia ──────────────────────
    console.log('📝 Registrando transacción en journal de idempotencia...');
    await cargaRef.set({
      firebase_uid: firebaseUid,
      odoo_transaction_id: transactionId,
      amount_credited: amount,
      saldo_anterior: saldoActual,
      saldo_resultante: nuevoSaldo,
      fecha: new Date().toISOString(),
      plataforma: 'inversiones_pro',
      recuperacion_manual: true,
      recuperado_por: 'script_manual',
      recuperado_en: new Date().toISOString()
    });
    console.log('✅ Transacción registrada en journal.\n');

    // ─── RESULTADO FINAL ────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ RECUPERACIÓN EXITOSA');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Transaction ID: ${transactionId}`);
    console.log(`   Monto acreditado: S/ ${amount.toFixed(2)}`);
    console.log(`   Saldo anterior: S/ ${saldoActual.toFixed(2)}`);
    console.log(`   Saldo nuevo: S/ ${nuevoSaldo.toFixed(2)}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    return {
      success: true,
      already_applied: false,
      newBalance: nuevoSaldo,
      previousBalance: saldoActual,
      amountCredited: amount
    };

  } catch (error) {
    console.error('\n❌ ERROR durante la recuperación:');
    console.error(error);
    console.error('');
    return {
      success: false,
      error: error.message
    };
  }
}

// ─── EJECUCIÓN DEL SCRIPT ───────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('\n❌ ERROR: Faltan parámetros\n');
  console.log('USO:');
  console.log('  node scripts/recuperarSaldo.js <FIREBASE_UID> <TRANSACTION_ID> <AMOUNT>\n');
  console.log('EJEMPLO:');
  console.log('  node scripts/recuperarSaldo.js "abc123xyz" "TRN-2026+00000065" 10000\n');
  process.exit(1);
}

const [firebaseUid, transactionId, amountStr] = args;
const amount = parseFloat(amountStr);

if (isNaN(amount) || amount <= 0) {
  console.error('\n❌ ERROR: El monto debe ser un número mayor a 0\n');
  process.exit(1);
}

// Ejecutar recuperación
recuperarSaldo(firebaseUid, transactionId, amount)
  .then((result) => {
    if (result.success) {
      process.exit(0);
    } else {
      console.error('\n❌ La recuperación falló.\n');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
