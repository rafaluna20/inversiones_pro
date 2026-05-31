/**
 * Utilidad para verificar y corregir inconsistencias en gastos de proyectos
 * Uso: Ejecutar manualmente cuando se sospeche de datos inconsistentes
 */

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { recalcularTotalesGastos } from '@/lib/firebase/gastos';

interface ResultadoVerificacion {
  proyectoId: string;
  proyectoNombre: string;
  gastosEnSubcoleccion: number;
  gastosAprobados: number;
  totalCalculado: number;
  totalGuardado: number;
  coincide: boolean;
  diferencia: number;
}

/**
 * Verificar gastos de un proyecto específico
 * @param proyectoId ID del proyecto a verificar
 * @returns Resultado de la verificación
 */
export async function verificarGastosProyecto(proyectoId: string): Promise<ResultadoVerificacion> {
  try {
    // 1. Obtener gastos de la subcolección
    const gastosRef = collection(db, `productos/${proyectoId}/gastos`);
    const gastosSnap = await getDocs(gastosRef);
    
    const gastosAprobados = gastosSnap.docs
      .map(d => d.data())
      .filter(g => g.estado === 'aprobado' || !g.estado);
    
    const totalCalculado = gastosAprobados.reduce((sum, g) => sum + (g.monto || 0), 0);
    
    // 2. Obtener totalGastos del proyecto
    const proyectoRef = doc(db, 'productos', proyectoId);
    const proyectoSnap = await getDoc(proyectoRef);
    
    if (!proyectoSnap.exists()) {
      throw new Error(`Proyecto ${proyectoId} no encontrado`);
    }
    
    const proyectoData = proyectoSnap.data();
    const totalGuardado = proyectoData.totalGastos || 0;
    const proyectoNombre = proyectoData.nombre || 'Sin nombre';
    
    // 3. Comparar
    const diferencia = Math.abs(totalCalculado - totalGuardado);
    const coincide = diferencia < 0.01; // Tolerancia de 1 centavo
    
    return {
      proyectoId,
      proyectoNombre,
      gastosEnSubcoleccion: gastosSnap.size,
      gastosAprobados: gastosAprobados.length,
      totalCalculado,
      totalGuardado,
      coincide,
      diferencia
    };
  } catch (error) {
    console.error(`Error al verificar proyecto ${proyectoId}:`, error);
    throw error;
  }
}

/**
 * Verificar todos los proyectos activos
 * @returns Array con resultados de verificación
 */
export async function verificarTodosLosProyectos(): Promise<ResultadoVerificacion[]> {
  try {
    const productosRef = collection(db, 'productos');
    const productosSnap = await getDocs(productosRef);
    
    const resultados: ResultadoVerificacion[] = [];
    
    for (const productoDoc of productosSnap.docs) {
      try {
        const resultado = await verificarGastosProyecto(productoDoc.id);
        resultados.push(resultado);
      } catch (error) {
        console.error(`Error en proyecto ${productoDoc.id}:`, error);
      }
    }
    
    return resultados;
  } catch (error) {
    console.error('Error al verificar todos los proyectos:', error);
    throw error;
  }
}

/**
 * Corregir inconsistencias detectadas
 * @param proyectoId ID del proyecto a corregir
 * @returns true si se corrigió exitosamente
 */
export async function corregirInconsistencias(proyectoId: string): Promise<boolean> {
  try {
    const verificacion = await verificarGastosProyecto(proyectoId);
    
    if (!verificacion.coincide) {
      console.log(`🔧 Corrigiendo proyecto ${verificacion.proyectoNombre}...`);
      console.log(`   Total calculado: S/ ${verificacion.totalCalculado.toFixed(2)}`);
      console.log(`   Total guardado: S/ ${verificacion.totalGuardado.toFixed(2)}`);
      console.log(`   Diferencia: S/ ${verificacion.diferencia.toFixed(2)}`);
      
      await recalcularTotalesGastos(proyectoId);
      
      console.log(`✅ Proyecto ${verificacion.proyectoNombre} corregido`);
      return true;
    } else {
      console.log(`✓ Proyecto ${verificacion.proyectoNombre} está correcto`);
      return false;
    }
  } catch (error) {
    console.error(`Error al corregir proyecto ${proyectoId}:`, error);
    return false;
  }
}

/**
 * Generar reporte de verificación en consola
 * @param resultados Array de resultados de verificación
 */
export function generarReporteVerificacion(resultados: ResultadoVerificacion[]): void {
  console.log('\n📊 REPORTE DE VERIFICACIÓN DE GASTOS\n');
  console.log('═'.repeat(80));
  
  const proyectosConProblemas = resultados.filter(r => !r.coincide);
  const proyectosCorrectos = resultados.filter(r => r.coincide);
  
  console.log(`\n✅ Proyectos correctos: ${proyectosCorrectos.length}`);
  console.log(`⚠️  Proyectos con inconsistencias: ${proyectosConProblemas.length}`);
  
  if (proyectosConProblemas.length > 0) {
    console.log('\n⚠️  PROYECTOS CON INCONSISTENCIAS:\n');
    console.log('─'.repeat(80));
    
    proyectosConProblemas.forEach(p => {
      console.log(`\nProyecto: ${p.proyectoNombre} (${p.proyectoId})`);
      console.log(`  Gastos en subcolección: ${p.gastosEnSubcoleccion}`);
      console.log(`  Gastos aprobados: ${p.gastosAprobados}`);
      console.log(`  Total calculado: S/ ${p.totalCalculado.toFixed(2)}`);
      console.log(`  Total guardado: S/ ${p.totalGuardado.toFixed(2)}`);
      console.log(`  Diferencia: S/ ${p.diferencia.toFixed(2)} ❌`);
    });
    
    console.log('\n💡 Ejecuta corregirInconsistencias(proyectoId) para cada proyecto con problemas');
  }
  
  console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Función de ayuda para ejecutar desde consola del navegador
 * Ejemplo de uso:
 * 
 * import { verificarYCorregirTodo } from '@/lib/utils/verificarGastos';
 * await verificarYCorregirTodo();
 */
export async function verificarYCorregirTodo(): Promise<void> {
  console.log('🔍 Iniciando verificación de todos los proyectos...\n');
  
  const resultados = await verificarTodosLosProyectos();
  generarReporteVerificacion(resultados);
  
  const proyectosConProblemas = resultados.filter(r => !r.coincide);
  
  if (proyectosConProblemas.length > 0) {
    console.log('🔧 Corrigiendo inconsistencias automáticamente...\n');
    
    for (const proyecto of proyectosConProblemas) {
      await corregirInconsistencias(proyecto.proyectoId);
    }
    
    console.log('\n✅ Corrección completada. Verificando nuevamente...\n');
    
    const resultadosFinales = await verificarTodosLosProyectos();
    generarReporteVerificacion(resultadosFinales);
  } else {
    console.log('✅ Todos los proyectos están correctos. No se requiere corrección.');
  }
}
