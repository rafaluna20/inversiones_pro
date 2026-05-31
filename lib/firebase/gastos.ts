/**
 * Módulo de Gestión de Gastos de Proyectos
 * Maneja el CRUD de gastos y cálculo de costos totales
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import type { GastoProyecto } from '@/types';
import { registrarGastoSchema, eliminarGastoSchema } from '@/lib/security/validation';

/**
 * Agregar un nuevo gasto a un proyecto
 * @param proyectoId ID del proyecto
 * @param gasto Datos del gasto (sin id)
 * @returns ID del gasto creado
 */
export async function agregarGasto(
  proyectoId: string,
  gasto: Omit<GastoProyecto, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    // Validar datos
    const validado = registrarGastoSchema.parse({
      ...gasto,
      proyectoId
    });

    // Crear gasto en subcolección
    const gastosRef = collection(db, `productos/${proyectoId}/gastos`);
    const docRef = await addDoc(gastosRef, {
      concepto: validado.concepto,
      categoria: validado.categoria,
      monto: validado.monto,
      fecha: validado.fecha,
      ...(validado.comprobante && { comprobante: validado.comprobante }),
      ...(validado.descripcion && { descripcion: validado.descripcion }),
      ...(validado.proveedor && { proveedor: validado.proveedor }),
      registradoPor: validado.registradoPor,
      proyectoId: validado.proyectoId,
      estado: gasto.estado || 'aprobado', // Por defecto aprobado
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Recalcular totales del proyecto
    await recalcularTotalesGastos(proyectoId);

    console.log(`✅ Gasto agregado: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error al agregar gasto:', error);
    throw error;
  }
}

/**
 * Actualizar un gasto existente
 * @param proyectoId ID del proyecto
 * @param gastoId ID del gasto
 * @param datosActualizados Datos a actualizar
 */
export async function actualizarGasto(
  proyectoId: string,
  gastoId: string,
  datosActualizados: Partial<Omit<GastoProyecto, 'id' | 'proyectoId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  try {
    const gastoRef = doc(db, `productos/${proyectoId}/gastos/${gastoId}`);
    
    await updateDoc(gastoRef, {
      ...datosActualizados,
      updatedAt: serverTimestamp()
    });

    // Recalcular totales si cambió el monto
    if (datosActualizados.monto !== undefined) {
      await recalcularTotalesGastos(proyectoId);
    }

    console.log(`✅ Gasto actualizado: ${gastoId}`);
  } catch (error) {
    console.error('❌ Error al actualizar gasto:', error);
    throw error;
  }
}

/**
 * Eliminar un gasto
 * @param proyectoId ID del proyecto
 * @param gastoId ID del gasto
 * @param eliminadoPor UID del usuario que elimina
 * @param motivo Motivo de eliminación (opcional)
 */
export async function eliminarGasto(
  proyectoId: string,
  gastoId: string,
  eliminadoPor: string,
  motivo?: string
): Promise<void> {
  try {
    // Validar
    eliminarGastoSchema.parse({
      proyectoId,
      gastoId,
      eliminadoPor,
      motivo
    });

    const gastoRef = doc(db, `productos/${proyectoId}/gastos/${gastoId}`);
    
    // Obtener datos del gasto antes de eliminar (para auditoría)
    const gastoDoc = await getDoc(gastoRef);
    if (!gastoDoc.exists()) {
      throw new Error('Gasto no encontrado');
    }

    // TODO: Guardar en colección de auditoría si es necesario
    // await addDoc(collection(db, 'auditoria_gastos'), {
    //   gastoId,
    //   proyectoId,
    //   gastoData: gastoDoc.data(),
    //   eliminadoPor,
    //   motivo,
    //   fechaEliminacion: serverTimestamp()
    // });

    // Eliminar gasto
    await deleteDoc(gastoRef);

    // Recalcular totales
    await recalcularTotalesGastos(proyectoId);

    console.log(`✅ Gasto eliminado: ${gastoId}`);
  } catch (error) {
    console.error('❌ Error al eliminar gasto:', error);
    throw error;
  }
}

/**
 * Obtener todos los gastos de un proyecto
 * @param proyectoId ID del proyecto
 * @returns Array de gastos
 */
export async function obtenerGastosProyecto(
  proyectoId: string
): Promise<GastoProyecto[]> {
  try {
    const gastosRef = collection(db, `productos/${proyectoId}/gastos`);
    const q = query(gastosRef, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      proyectoId,
      ...doc.data(),
      // Convertir timestamps de Firestore a numbers
      fecha: doc.data().fecha?.toMillis?.() || doc.data().fecha,
      createdAt: doc.data().createdAt?.toMillis?.() || doc.data().createdAt || Date.now(),
      updatedAt: doc.data().updatedAt?.toMillis?.() || doc.data().updatedAt || Date.now()
    })) as GastoProyecto[];
  } catch (error) {
    console.error('❌ Error al obtener gastos:', error);
    return [];
  }
}

/**
 * Obtener gastos por categoría
 * @param proyectoId ID del proyecto
 * @param categoria Categoría a filtrar
 * @returns Array de gastos de esa categoría
 */
export async function obtenerGastosPorCategoria(
  proyectoId: string,
  categoria: string
): Promise<GastoProyecto[]> {
  try {
    const gastosRef = collection(db, `productos/${proyectoId}/gastos`);
    const q = query(
      gastosRef, 
      where('categoria', '==', categoria),
      orderBy('fecha', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      proyectoId,
      ...doc.data(),
      fecha: doc.data().fecha?.toMillis?.() || doc.data().fecha,
      createdAt: doc.data().createdAt?.toMillis?.() || doc.data().createdAt || Date.now(),
      updatedAt: doc.data().updatedAt?.toMillis?.() || doc.data().updatedAt || Date.now()
    })) as GastoProyecto[];
  } catch (error) {
    console.error('❌ Error al obtener gastos por categoría:', error);
    return [];
  }
}

/**
 * Recalcular totales de gastos y actualizar el proyecto
 * Esta función se llama automáticamente después de agregar/actualizar/eliminar gastos
 * @param proyectoId ID del proyecto
 */
export async function recalcularTotalesGastos(proyectoId: string): Promise<void> {
  try {
    // Obtener todos los gastos aprobados
    const gastos = await obtenerGastosProyecto(proyectoId);
    const gastosAprobados = gastos.filter(g => g.estado === 'aprobado' || !g.estado);
    
    // Calcular total de gastos
    const totalGastos = gastosAprobados.reduce((sum, g) => sum + g.monto, 0);

    // Obtener datos del proyecto
    const proyectoRef = doc(db, 'productos', proyectoId);
    const proyectoDoc = await getDoc(proyectoRef);
    
    if (!proyectoDoc.exists()) {
      throw new Error('Proyecto no encontrado');
    }

    const proyectoData = proyectoDoc.data();
    const precioCompra = typeof proyectoData.precio === 'string' 
      ? parseFloat(proyectoData.precio) 
      : (proyectoData.precio || 0);
    
    const precioVenta = proyectoData.precioVenta || proyectoData.monto || 0;

    // Calcular métricas
    const costoTotalProyecto = precioCompra + totalGastos;
    const gananciaBruta = precioVenta - precioCompra;
    const gananciaNeta = precioVenta - costoTotalProyecto;
    const roiReal = costoTotalProyecto > 0 
      ? (gananciaNeta / costoTotalProyecto) * 100 
      : 0;

    // Actualizar proyecto con nuevos totales
    await updateDoc(proyectoRef, {
      totalGastos,
      costoTotalProyecto,
      gananciaBruta,
      gananciaNeta,
      roiReal,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ Totales recalculados para proyecto ${proyectoId}:`, {
      precioCompra,
      totalGastos,
      costoTotalProyecto,
      precioVenta,
      gananciaBruta,
      gananciaNeta,
      roiReal: `${roiReal.toFixed(2)}%`
    });
  } catch (error) {
    console.error('❌ Error al recalcular totales:', error);
    throw error;
  }
}

/**
 * Obtener resumen de gastos por categoría
 * @param proyectoId ID del proyecto
 * @returns Objeto con el total por cada categoría
 */
export async function obtenerResumenGastosPorCategoria(
  proyectoId: string
): Promise<Record<string, number>> {
  try {
    const gastos = await obtenerGastosProyecto(proyectoId);
    const gastosAprobados = gastos.filter(g => g.estado === 'aprobado' || !g.estado);
    
    return gastosAprobados.reduce((resumen, gasto) => {
      resumen[gasto.categoria] = (resumen[gasto.categoria] || 0) + gasto.monto;
      return resumen;
    }, {} as Record<string, number>);
  } catch (error) {
    console.error('❌ Error al obtener resumen de gastos:', error);
    return {};
  }
}

/**
 * Validar que un usuario tiene permisos para gestionar gastos
 * @param proyectoId ID del proyecto
 * @param usuarioId ID del usuario
 * @returns true si tiene permisos (gestor o creador)
 */
export async function validarPermisosGastos(
  proyectoId: string,
  usuarioId: string
): Promise<boolean> {
  try {
    const proyectoRef = doc(db, 'productos', proyectoId);
    const proyectoDoc = await getDoc(proyectoRef);
    
    if (!proyectoDoc.exists()) {
      return false;
    }

    const proyectoData = proyectoDoc.data();
    
    // Verificar si es el creador o el gestor
    const esCreador = proyectoData.creador?.id === usuarioId;
    const esGestor = proyectoData.gestorId === usuarioId;
    
    return esCreador || esGestor;
  } catch (error) {
    console.error('❌ Error al validar permisos:', error);
    return false;
  }
}
