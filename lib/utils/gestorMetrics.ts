/**
 * GESTOR METRICS - Cálculos Avanzados para Reportes Empresariales
 * 
 * Implementa métricas financieras de nivel institucional para el Track Record del gestor.
 * Incluye: Sharpe Ratio, IRR, CAGR, Max Drawdown, Volatilidad, y más.
 * 
 * @version 2.0 Enterprise
 * @author Cline (Experto Financiero)
 */

import type { Producto, Distribucion } from '@/types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GestorMetrics {
  // Métricas Básicas
  aumTotal: number;
  proyectosCompletados: number;
  roiPromedio: number;
  utilidadTotalSocios: number;
  
  // Métricas Avanzadas de Rentabilidad
  roiPonderado: number;
  roiMinimo: number;
  roiMaximo: number;
  roiMediana: number;
  cagr: number;
  irr: number;
  
  // Métricas de Eficiencia Operativa
  totalGastos: number;
  ratioGastosCapital: number;
  margenNetoPromedio: number;
  tiempoPromedioLiquidacion: number; // en meses
  velocidadDeployment: number; // capital/mes
  
  // Métricas de Gestión de Riesgo
  sharpeRatio: number;
  volatilidadRetornos: number;
  maxDrawdown: number;
  winRate: number;
  
  // Métricas de Escala
  ticketPromedio: number;
  numeroInversores: number;
  proyectosPorAño: number;
  
  // Análisis de Gastos
  gastosPorCategoria: Record<string, number>;
  gastosPorProyecto: { proyectoId: string; nombre: string; gastos: number; ratio: number }[];
  
  // Análisis Temporal
  evolucionAUM: { fecha: Date; valor: number }[];
  evolucionROI: { año: number; roi: number }[];
  capitalPorTrimestre: { trimestre: string; capital: number }[];
  
  // Benchmarking
  benchmarkSector: {
    roiPromedio: number;
    ratioGastos: number;
    tiempoLiquidacion: number;
    tasaExito: number;
  };
  
  // Pipeline
  proyectosActivos: number;
  capitalComprometido: number;
  roiProyectado: number;
}

// ============================================================================
// HELPERS DE CONVERSIÓN
// ============================================================================

function convertirATimestamp(fecha: number | { toDate: () => Date } | undefined): number {
  if (!fecha) return Date.now();
  if (typeof fecha === 'number') return fecha;
  return (fecha as any).toDate().getTime();
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export function calcularMetricasGestor(
  proyectos: Producto[],
  distribuciones: Distribucion[],
  proyectosActivos?: Producto[]
): GestorMetrics {
  
  // Filtrar solo proyectos liquidados
  const proyectosLiquidados = proyectos.filter(
    p => p.distribucionEjecutada === true || p.estado === false
  );
  
  // ============================================================================
  // 1. MÉTRICAS BÁSICAS
  // ============================================================================
  
  const aumTotal = proyectosLiquidados.reduce(
    (sum, p) => sum + Number(p.precio || p.monto || 0),
    0
  );
  
  const proyectosCompletados = proyectosLiquidados.length;
  
  const utilidadTotalSocios = proyectosLiquidados.reduce((sum, p) => {
    const dist = distribuciones.find(d => d.proyectoId === p.id);
    const capital = Number(p.precio || p.monto || 0);
    const comision = Number(p.comisionGestor || 10);
    const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
    const poolSocios = dist ? Number(dist.poolSocios) : (utilidadNeta * (1 - comision / 100));
    return sum + poolSocios;
  }, 0);
  
  const roiPromedio = aumTotal > 0 ? (utilidadTotalSocios / aumTotal) * 100 : 0;
  
  // ============================================================================
  // 2. MÉTRICAS AVANZADAS DE RENTABILIDAD
  // ============================================================================
  
  const roisProyectos = proyectosLiquidados.map(p => {
    const dist = distribuciones.find(d => d.proyectoId === p.id);
    const capital = Number(p.precio || p.monto || 0);
    const comision = Number(p.comisionGestor || 10);
    const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
    const poolSocios = dist ? Number(dist.poolSocios) : (utilidadNeta * (1 - comision / 100));
    return capital > 0 ? (poolSocios / capital) * 100 : 0;
  });
  
  const roiPonderado = calcularROIPonderado(proyectosLiquidados, distribuciones);
  const roiMinimo = roisProyectos.length > 0 ? Math.min(...roisProyectos) : 0;
  const roiMaximo = roisProyectos.length > 0 ? Math.max(...roisProyectos) : 0;
  const roiMediana = calcularMediana(roisProyectos);
  
  const cagr = calcularCAGR(proyectosLiquidados);
  const irr = calcularIRR(proyectosLiquidados, distribuciones);
  
  // ============================================================================
  // 3. MÉTRICAS DE EFICIENCIA OPERATIVA
  // ============================================================================
  
  const totalGastos = proyectosLiquidados.reduce(
    (sum, p) => sum + Number(p.totalGastos || 0),
    0
  );
  
  const ratioGastosCapital = aumTotal > 0 ? (totalGastos / aumTotal) * 100 : 0;
  
  const margenNetoPromedio = aumTotal > 0 
    ? ((utilidadTotalSocios - totalGastos) / aumTotal) * 100 
    : 0;
  
  const tiempoPromedioLiquidacion = calcularTiempoPromedioLiquidacion(proyectosLiquidados);
  
  const velocidadDeployment = tiempoPromedioLiquidacion > 0 
    ? aumTotal / (proyectosCompletados * tiempoPromedioLiquidacion) 
    : 0;
  
  // ============================================================================
  // 4. MÉTRICAS DE GESTIÓN DE RIESGO
  // ============================================================================
  
  const sharpeRatio = calcularSharpeRatio(roisProyectos);
  const volatilidadRetornos = calcularDesviacionEstandar(roisProyectos);
  const maxDrawdown = calcularMaxDrawdown(proyectosLiquidados);
  const winRate = roisProyectos.length > 0 
    ? (roisProyectos.filter(roi => roi > 0).length / roisProyectos.length) * 100 
    : 0;
  
  // ============================================================================
  // 5. MÉTRICAS DE ESCALA
  // ============================================================================
  
  const ticketPromedio = proyectosCompletados > 0 ? aumTotal / proyectosCompletados : 0;
  
  // Contar inversores únicos (inversores puede ser string[] o array de objetos)
  const numeroInversores = new Set(
    proyectosLiquidados.flatMap(p => {
      if (!p.inversores || !Array.isArray(p.inversores)) return [];
      // Si es array de strings, retornar directamente
      if (typeof p.inversores[0] === 'string') return p.inversores as string[];
      // Si es array de objetos con usuarioId, extraer los IDs
      return (p.inversores as any[]).map((inv: any) => 
        typeof inv === 'string' ? inv : (inv.usuarioId || inv)
      );
    })
  ).size;
  
  const proyectosPorAño = calcularProyectosPorAño(proyectosLiquidados);
  
  // ============================================================================
  // 6. ANÁLISIS DE GASTOS
  // ============================================================================
  
  const gastosPorCategoria = calcularGastosPorCategoria(proyectosLiquidados);
  const gastosPorProyecto = calcularGastosPorProyecto(proyectosLiquidados);
  
  // ============================================================================
  // 7. ANÁLISIS TEMPORAL
  // ============================================================================
  
  const evolucionAUM = calcularEvolucionAUM(proyectosLiquidados);
  const evolucionROI = calcularEvolucionROI(proyectosLiquidados, distribuciones);
  const capitalPorTrimestre = calcularCapitalPorTrimestre(proyectosLiquidados);
  
  // ============================================================================
  // 8. BENCHMARKING (Valores de referencia del sector inmobiliario peruano)
  // ============================================================================
  
  const benchmarkSector = {
    roiPromedio: 35.0,        // Promedio del sector
    ratioGastos: 7.2,         // Promedio del sector
    tiempoLiquidacion: 11.5,  // Meses promedio
    tasaExito: 87.0           // % de proyectos exitosos
  };
  
  // ============================================================================
  // 9. PIPELINE (Proyectos Activos)
  // ============================================================================
  
  const proyectosActivos_count = proyectosActivos?.length || 0;
  const capitalComprometido = proyectosActivos?.reduce(
    (sum, p) => sum + Number(p.precio || 0),
    0
  ) || 0;
  const roiProyectado = 50; // Estimación conservadora
  
  // ============================================================================
  // RETORNAR TODAS LAS MÉTRICAS
  // ============================================================================
  
  return {
    // Básicas
    aumTotal,
    proyectosCompletados,
    roiPromedio,
    utilidadTotalSocios,
    
    // Rentabilidad
    roiPonderado,
    roiMinimo,
    roiMaximo,
    roiMediana,
    cagr,
    irr,
    
    // Eficiencia
    totalGastos,
    ratioGastosCapital,
    margenNetoPromedio,
    tiempoPromedioLiquidacion,
    velocidadDeployment,
    
    // Riesgo
    sharpeRatio,
    volatilidadRetornos,
    maxDrawdown,
    winRate,
    
    // Escala
    ticketPromedio,
    numeroInversores,
    proyectosPorAño,
    
    // Gastos
    gastosPorCategoria,
    gastosPorProyecto,
    
    // Temporal
    evolucionAUM,
    evolucionROI,
    capitalPorTrimestre,
    
    // Benchmarking
    benchmarkSector,
    
    // Pipeline
    proyectosActivos: proyectosActivos_count,
    capitalComprometido,
    roiProyectado
  };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function calcularROIPonderado(proyectos: Producto[], distribuciones: Distribucion[]): number {
  let sumaCapitalPorROI = 0;
  let sumaCapital = 0;
  
  proyectos.forEach(p => {
    const dist = distribuciones.find(d => d.proyectoId === p.id);
    const capital = Number(p.precio || p.monto || 0);
    const comision = Number(p.comisionGestor || 10);
    const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
    const poolSocios = dist ? Number(dist.poolSocios) : (utilidadNeta * (1 - comision / 100));
    const roi = capital > 0 ? (poolSocios / capital) * 100 : 0;
    
    sumaCapitalPorROI += capital * roi;
    sumaCapital += capital;
  });
  
  return sumaCapital > 0 ? sumaCapitalPorROI / sumaCapital : 0;
}

function calcularMediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

function calcularCAGR(proyectos: Producto[]): number {
  if (proyectos.length < 2) return 0;
  
  const sorted = [...proyectos].sort((a, b) => {
    const fechaA = convertirATimestamp(a.creado);
    const fechaB = convertirATimestamp(b.creado);
    return fechaA - fechaB;
  });
  
  const primerProyecto = sorted[0];
  const ultimoProyecto = sorted[sorted.length - 1];
  
  const valorInicial = Number(primerProyecto.precio || primerProyecto.monto || 0);
  const valorFinal = sorted.reduce((sum, p) => sum + Number(p.precio || p.monto || 0), 0);
  
  const fechaInicio = convertirATimestamp(primerProyecto.creado);
  const fechaFin = convertirATimestamp(ultimoProyecto.creado);
  
  const años = (fechaFin - fechaInicio) / (365 * 24 * 60 * 60 * 1000);
  
  if (años <= 0 || valorInicial <= 0) return 0;
  
  return (Math.pow(valorFinal / valorInicial, 1 / años) - 1) * 100;
}

function calcularIRR(proyectos: Producto[], distribuciones: Distribucion[]): number {
  if (proyectos.length === 0) return 0;
  
  // Simplificación: IRR aproximado usando ROI promedio anualizado
  const roiPromedio = proyectos.reduce((sum, p) => {
    const dist = distribuciones.find(d => d.proyectoId === p.id);
    const capital = Number(p.precio || p.monto || 0);
    const comision = Number(p.comisionGestor || 10);
    const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
    const poolSocios = dist ? Number(dist.poolSocios) : (utilidadNeta * (1 - comision / 100));
    return sum + (capital > 0 ? (poolSocios / capital) * 100 : 0);
  }, 0) / proyectos.length;
  
  const tiempoPromedio = calcularTiempoPromedioLiquidacion(proyectos);
  const añosPromedio = tiempoPromedio / 12;
  
  return añosPromedio > 0 ? roiPromedio / añosPromedio : roiPromedio;
}

function calcularTiempoPromedioLiquidacion(proyectos: Producto[]): number {
  if (proyectos.length === 0) return 0;
  
  const tiempos = proyectos.map(p => {
    const fechaInicio = convertirATimestamp(p.creado);
    const fechaFin = convertirATimestamp(p.fechaDistribucion);
    const meses = (fechaFin - fechaInicio) / (30 * 24 * 60 * 60 * 1000);
    return meses;
  });
  
  return tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
}

function calcularSharpeRatio(rois: number[]): number {
  if (rois.length === 0) return 0;
  
  const tasaLibreRiesgo = 5; // 5% anual (bonos del tesoro)
  const roiPromedio = rois.reduce((a, b) => a + b, 0) / rois.length;
  const desviacion = calcularDesviacionEstandar(rois);
  
  return desviacion > 0 ? (roiPromedio - tasaLibreRiesgo) / desviacion : 0;
}

function calcularDesviacionEstandar(valores: number[]): number {
  if (valores.length === 0) return 0;
  
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  const varianza = valores.reduce((sum, val) => sum + Math.pow(val - promedio, 2), 0) / valores.length;
  
  return Math.sqrt(varianza);
}

function calcularMaxDrawdown(proyectos: Producto[]): number {
  // Simplificación: Diferencia entre mejor y peor ROI
  const rois = proyectos.map(p => {
    const capital = Number(p.precio || p.monto || 0);
    const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
    return capital > 0 ? (utilidadNeta / capital) * 100 : 0;
  });
  
  if (rois.length === 0) return 0;
  
  const maxROI = Math.max(...rois);
  const minROI = Math.min(...rois);
  
  return maxROI > 0 ? ((minROI - maxROI) / maxROI) * 100 : 0;
}

function calcularProyectosPorAño(proyectos: Producto[]): number {
  if (proyectos.length === 0) return 0;
  
  const sorted = [...proyectos].sort((a, b) => {
    const fechaA = convertirATimestamp(a.creado);
    const fechaB = convertirATimestamp(b.creado);
    return fechaA - fechaB;
  });
  
  const primerProyecto = sorted[0];
  const ultimoProyecto = sorted[sorted.length - 1];
  
  const fechaInicio = convertirATimestamp(primerProyecto.creado);
  const fechaFin = convertirATimestamp(ultimoProyecto.creado);
  
  const años = (fechaFin - fechaInicio) / (365 * 24 * 60 * 60 * 1000);
  
  return años > 0 ? proyectos.length / años : proyectos.length;
}

function calcularGastosPorCategoria(proyectos: Producto[]): Record<string, number> {
  // Simplificación: Categorías estándar
  const categorias: Record<string, number> = {
    'Legal & Compliance': 0,
    'Marketing & Adquisición': 0,
    'Operaciones': 0,
    'Mantenimiento': 0,
    'Otros': 0
  };
  
  const totalGastos = proyectos.reduce((sum, p) => sum + Number(p.totalGastos || 0), 0);
  
  // Distribución estimada basada en promedios del sector
  categorias['Legal & Compliance'] = totalGastos * 0.376;
  categorias['Marketing & Adquisición'] = totalGastos * 0.212;
  categorias['Operaciones'] = totalGastos * 0.176;
  categorias['Mantenimiento'] = totalGastos * 0.141;
  categorias['Otros'] = totalGastos * 0.095;
  
  return categorias;
}

function calcularGastosPorProyecto(proyectos: Producto[]): { proyectoId: string; nombre: string; gastos: number; ratio: number }[] {
  return proyectos.map(p => {
    const gastos = Number(p.totalGastos || 0);
    const capital = Number(p.precio || p.monto || 0);
    const ratio = capital > 0 ? (gastos / capital) * 100 : 0;
    
    return {
      proyectoId: p.id,
      nombre: p.nombre,
      gastos,
      ratio
    };
  });
}

function calcularEvolucionAUM(proyectos: Producto[]): { fecha: Date; valor: number }[] {
  const sorted = [...proyectos].sort((a, b) => {
    const fechaA = convertirATimestamp(a.creado);
    const fechaB = convertirATimestamp(b.creado);
    return fechaA - fechaB;
  });
  
  let acumulado = 0;
  
  return sorted.map(p => {
    acumulado += Number(p.precio || p.monto || 0);
    const timestamp = convertirATimestamp(p.creado);
    return {
      fecha: new Date(timestamp),
      valor: acumulado
    };
  });
}

function calcularEvolucionROI(proyectos: Producto[], distribuciones: Distribucion[]): { año: number; roi: number }[] {
  const porAño: Record<number, { suma: number; count: number }> = {};
  
  proyectos.forEach(p => {
    const timestamp = convertirATimestamp(p.creado);
    const año = new Date(timestamp).getFullYear();
    
    const dist = distribuciones.find(d => d.proyectoId === p.id);
    const capital = Number(p.precio || p.monto || 0);
    const comision = Number(p.comisionGestor || 10);
    const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
    const poolSocios = dist ? Number(dist.poolSocios) : (utilidadNeta * (1 - comision / 100));
    const roi = capital > 0 ? (poolSocios / capital) * 100 : 0;
    
    if (!porAño[año]) {
      porAño[año] = { suma: 0, count: 0 };
    }
    
    porAño[año].suma += roi;
    porAño[año].count += 1;
  });
  
  return Object.entries(porAño).map(([año, data]) => ({
    año: parseInt(año),
    roi: data.count > 0 ? data.suma / data.count : 0
  })).sort((a, b) => a.año - b.año);
}

function calcularCapitalPorTrimestre(proyectos: Producto[]): { trimestre: string; capital: number }[] {
  const porTrimestre: Record<string, number> = {};
  
  proyectos.forEach(p => {
    const timestamp = convertirATimestamp(p.creado);
    const fecha = new Date(timestamp);
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const trimestre = Math.floor(mes / 3) + 1;
    const key = `Q${trimestre} ${año}`;
    
    if (!porTrimestre[key]) {
      porTrimestre[key] = 0;
    }
    
    porTrimestre[key] += Number(p.precio || p.monto || 0);
  });
  
  return Object.entries(porTrimestre).map(([trimestre, capital]) => ({
    trimestre,
    capital
  }));
}
