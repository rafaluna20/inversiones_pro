import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface MovimientoPlataforma {
  id: string;
  tipo: 'recarga' | 'retiro' | 'inversion' | 'transferencia' | 'unknown';
  monto: number;
  fecha: string; // ISOString
  fechaRaw: Date;
  detalle: string;
  estado: 'completado' | 'pendiente' | 'fallido' | string;
}

/**
 * Normaliza y convierte un campo de fecha de Firestore (puede ser Timestamp, string, number, etc.)
 * a un objeto Date de Javascript.
 */
function normalizarFecha(fechaRaw: any): Date {
  if (!fechaRaw) return new Date();
  
  // Si es un Timestamp de Firestore
  if (fechaRaw instanceof Timestamp || (typeof fechaRaw === 'object' && 'seconds' in fechaRaw)) {
    return new Timestamp(fechaRaw.seconds, fechaRaw.nanoseconds).toDate();
  }
  
  // Si es un string o número
  const parseada = new Date(fechaRaw);
  if (!isNaN(parseada.getTime())) {
    return parseada;
  }
  
  return new Date();
}

/**
 * Obtiene todos los movimientos reales de la plataforma para un usuario desde Firebase Firestore,
 * combinando las colecciones de plataforma_cargas, plataforma_retiros e inversiones.
 *
 * @param usuarioId ID único del usuario en Firebase Auth (firebase_uid / usuarioId)
 * @returns Promesa con la lista de movimientos ordenados de forma descendente por fecha
 */
export async function obtenerMovimientosPlataforma(usuarioId: string): Promise<MovimientoPlataforma[]> {
  if (!usuarioId) return [];

  try {
    const movimientos: MovimientoPlataforma[] = [];

    // 1. Consultar Cargas (recargas)
    const cargasQuery = query(
      collection(db, 'plataforma_cargas'),
      where('firebase_uid', '==', usuarioId)
    );
    
    // 2. Consultar Retiros
    const retirosQuery = query(
      collection(db, 'plataforma_retiros'),
      where('firebase_uid', '==', usuarioId)
    );

    // 3. Consultar Inversiones
    const inversionesQuery = query(
      collection(db, 'inversiones'),
      where('usuarioId', '==', usuarioId)
    );

    // Ejecutar consultas en paralelo
    const [cargasSnap, retirosSnap, inversionesSnap] = await Promise.all([
      getDocs(cargasQuery),
      getDocs(retirosQuery),
      getDocs(inversionesQuery)
    ]);

    // Procesar cargas
    cargasSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const fechaObj = normalizarFecha(data.fecha);
      movimientos.push({
        id: `carga_${docSnap.id}`,
        tipo: 'recarga',
        monto: parseFloat(data.amount_credited || 0),
        fecha: fechaObj.toISOString(),
        fechaRaw: fechaObj,
        detalle: data.odoo_transaction_id 
          ? `Carga de plataforma (${data.odoo_transaction_id})` 
          : 'Recarga de plataforma',
        estado: 'completado'
      });
    });

    // Procesar retiros
    retirosSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const fechaObj = normalizarFecha(data.fecha_completado || data.fecha_inicio);
      
      let estado = 'pendiente';
      if (data.status === 'completed') {
        estado = 'completado';
      } else if (data.status === 'failed_rolled_back') {
        estado = 'fallido';
      } else if (data.status === 'pending') {
        estado = 'pendiente';
      }

      movimientos.push({
        id: `retiro_${docSnap.id}`,
        tipo: 'retiro',
        monto: -parseFloat(data.amount || 0), // Negativo porque es egreso
        fecha: fechaObj.toISOString(),
        fechaRaw: fechaObj,
        detalle: data.odoo_transaction_id 
          ? `Retiro procesado (${data.odoo_transaction_id})` 
          : 'Solicitud de retiro',
        estado: estado
      });
    });

    // Procesar inversiones
    inversionesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const fechaObj = normalizarFecha(data.fechaInversion);
      movimientos.push({
        id: `inversion_${docSnap.id}`,
        tipo: 'inversion',
        monto: -parseFloat(data.montoInvertido || 0), // Negativo porque es egreso
        fecha: fechaObj.toISOString(),
        fechaRaw: fechaObj,
        detalle: `Inversión en ${data.proyectoNombre || 'Proyecto'}`,
        estado: data.confirmada ? 'completado' : 'pendiente'
      });
    });

    // Ordenar de forma descendente por fecha
    return movimientos.sort((a, b) => b.fechaRaw.getTime() - a.fechaRaw.getTime());

  } catch (error) {
    console.error('Error al obtener movimientos de la plataforma:', error);
    return [];
  }
}
