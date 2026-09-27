/**
 * POST /api/inv/banco/resumen
 *
 * Resumen de inversiones de UNA cuenta de billetera, para que la billetera digital (wallet_digital) lo muestre en su
 * pestaña "Inversiones". Lo pide el BANCO firmando con el secreto compartido de esta plataforma (nunca un navegador
 * ni un inversionista): ver lib/wallet-signature.ts (`verificarFirma`, misma firma que usa todo el ecosistema) y
 * PLATFORM_API.md §4 en wallet_digital.
 *
 * Es de solo lectura y entrega solo cifras: nunca nombres, correos ni datos de otros inversionistas. Una firma
 * inválida responde igual que una plataforma desconocida (no distingue el motivo).
 */
import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase/admin';
import { calcularResumenPatrimonio, type ProductoParaResumen } from '@/lib/patrimonio';
import { checkRateLimit, obtenerIp } from '@/lib/security/edge-rate-limit';
import { configBanco, verificarFirma } from '@/lib/wallet-signature';

const RUTA = '/api/inv/banco/resumen';

function respuestaJsonRpc(result: Record<string, unknown>) {
  return NextResponse.json({ jsonrpc: '2.0', id: null, result }, { headers: { 'cache-control': 'no-store' } });
}
const NO_AUTORIZADO = () => respuestaJsonRpc({ success: false, error: 'No autorizado.', code: 'no_autorizado' });

/** Cuenta de billetera (WAL...) → uid de Firestore. Requiere coincidencia EXACTA y única: ver app/actions/auth.ts. */
async function buscarUidPorCuenta(cuenta: string): Promise<string | null> {
  const snap = await getAdminDb().collection('usuarios').where('walletAccount', '==', cuenta).limit(2).get();
  return snap.size === 1 ? snap.docs[0].id : null;
}

export async function POST(request: Request) {
  const config = configBanco();
  const ip = obtenerIp(request.headers);

  // El límite se aplica ANTES de leer el cuerpo (defensa contra ráfagas), y también antes de saber si la firma es
  // válida: un atacante sin el secreto no debe poder usar este endpoint como oráculo de fuerza bruta sin freno.
  const limite = checkRateLimit(`${ip}:${RUTA}`, { limit: 30, windowMs: 60_000 });
  if (!limite.allowed) {
    return respuestaJsonRpc({ success: false, error: 'Demasiadas solicitudes. Espera un momento.', code: 'limite' });
  }

  const cuerpo = await request.text();
  // El código de plataforma en la cabecera debe ser el nuestro: el secreto que verifica la firma es EL NUESTRO, así
  // que en la práctica solo el banco puede producir una firma válida para nuestro código — esta comparación es una
  // segunda capa, por si algún día se guardara más de un secreto en el mismo proceso.
  const mismaPlataforma = config && (request.headers.get('x-wallet-platform') || '') === config.codigo;
  if (
    !config || !mismaPlataforma ||
    !verificarFirma(
      config.secreto,
      request.headers.get('x-wallet-timestamp'),
      RUTA,
      cuerpo,
      request.headers.get('x-wallet-signature'),
      Math.floor(Date.now() / 1000)
    )
  ) {
    return NO_AUTORIZADO();
  }

  let cuenta = '';
  try {
    const datos = JSON.parse(cuerpo);
    cuenta = typeof datos?.params?.account_number === 'string' ? datos.params.account_number.trim() : '';
  } catch {
    return respuestaJsonRpc({ success: false, error: 'Cuerpo inválido.', code: 'cuerpo_invalido' });
  }
  if (!cuenta) return respuestaJsonRpc({ success: true, vinculado: false });

  try {
    const uid = await buscarUidPorCuenta(cuenta);
    if (!uid) return respuestaJsonRpc({ success: true, vinculado: false });

    const db = getAdminDb();
    const [usuarioSnap, productosSnap] = await Promise.all([
      db.collection('usuarios').doc(uid).get(),
      // Sin un índice por inversor dentro del array (sería un objeto completo, no un valor simple), se recorren los
      // proyectos y se filtra en memoria — igual que ya hace app/mis-inversiones/page.tsx en el cliente. La
      // cantidad de proyectos de esta plataforma es acotada (crowdfunding inmobiliario curado, no miles de filas).
      db.collection('productos').get(),
    ]);
    if (!usuarioSnap.exists) return respuestaJsonRpc({ success: true, vinculado: false });

    const saldoLibre = Number(usuarioSnap.data()?.saldo || 0);
    const productos = productosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProductoParaResumen);
    const resumen = calcularResumenPatrimonio(saldoLibre, productos, uid);
    return respuestaJsonRpc({ success: true, vinculado: true, resumen });
  } catch (error) {
    console.error('[api/inv/banco/resumen] Error:', error);
    return respuestaJsonRpc({ success: false, error: 'Error interno.', code: 'interno' });
  }
}
