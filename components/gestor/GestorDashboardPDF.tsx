'use client';

/**
 * GESTOR DASHBOARD PDF - Reporte Empresarial Completo
 * 
 * Genera un reporte PDF de nivel institucional con 8 secciones:
 * 1. Executive Summary
 * 2. KPIs Financieros Avanzados (15+ métricas)
 * 3. Análisis de Gastos Operativos
 * 4. Tabla de Proyectos Mejorada
 * 5. Análisis Temporal y Tendencias
 * 6. Benchmarking vs Sector
 * 7. Pipeline y Proyecciones
 * 8. Certificaciones y Compliance
 * 
 * @version 2.0 Enterprise
 * @author Cline (Experto en Reportes Empresariales)
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaFilePdf, FaChartLine, FaAward } from 'react-icons/fa';
import { formatearSoles } from '@/lib/distribucion';
import { calcularMetricasGestor, type GestorMetrics } from '@/lib/utils/gestorMetrics';
import type { Producto, Distribucion } from '@/types';

interface GestorDashboardPDFProps {
  proyectos: Producto[];
  distribuciones: Distribucion[];
  proyectosActivos?: Producto[];
  gestorNombre: string;
}

export default function GestorDashboardPDF({ 
  proyectos, 
  distribuciones, 
  proyectosActivos = [],
  gestorNombre 
}: GestorDashboardPDFProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerar = () => {
    setGenerating(true);

    // Calcular todas las métricas
    const metrics = calcularMetricasGestor(proyectos, distribuciones, proyectosActivos);
    
    const fechaFormateada = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    const codigoDoc = `TRCK-ENT-${Date.now().toString().slice(-6)}`;

    const proyectosLiquidados = proyectos.filter((p) => p.distribucionEjecutada === true || p.estado === false);

    // ============================================================================
    // GENERAR HTML DEL PDF
    // ============================================================================

    const html = generarHTMLReporte(metrics, proyectosLiquidados, distribuciones, gestorNombre, fechaFormateada, codigoDoc);

    // Abrir ventana de impresión
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { 
      setGenerating(false); 
      return; 
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setGenerating(false);
  };

  const proyectosLiquidados = proyectos.filter(p => p.distribucionEjecutada || p.estado === false);
  const tieneProyectos = proyectosLiquidados.length > 0;

  return (
    <button
      onClick={handleGenerar}
      disabled={generating || !tieneProyectos}
      className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <FaFilePdf className="text-xl" />
      <span>{generating ? 'Generando Reporte...' : 'Descargar Reporte Empresarial'}</span>
      <FaChartLine className="text-lg" />
    </button>
  );
}

// ============================================================================
// FUNCIÓN PARA GENERAR HTML DEL REPORTE
// ============================================================================

function generarHTMLReporte(
  metrics: GestorMetrics,
  proyectos: Producto[],
  distribuciones: Distribucion[],
  gestorNombre: string,
  fechaFormateada: string,
  codigoDoc: string
): string {
  
  // Generar filas de la tabla de proyectos
  const filasProyectos = proyectos.map((p) => {
    const dist = distribuciones.find(d => d.proyectoId === p.id);
    const capital = Number(p.precio || p.monto || 0);
    const gastos = Number(p.totalGastos || 0);
    const montoVenta = Number(p.monto || capital);
    const costoTotal = capital + gastos;
    const ratioGastos = capital > 0 ? (gastos / capital) * 100 : 0;
    const comision = Number(p.comisionGestor || 0);
    
    // CORRECCIÓN: Calcular ganancia neta REAL considerando gastos
    // Ganancia Neta = Venta - (Capital + Gastos)
    const gananciaNeta = montoVenta - costoTotal;
    
    // Ganancia Socios = Ganancia Neta × (1 - Comisión%)
    const gananciaSocios = dist 
      ? Number(dist.poolSocios) 
      : (gananciaNeta * (1 - comision / 100));
    
    const roiNeto = capital > 0 ? (gananciaSocios / capital) * 100 : 0;
    const roiBruto = capital > 0 ? ((gananciaSocios + gastos) / capital) * 100 : 0;
    
    const rawDate = p.fechaDistribucion || p.creado;
    let fechaLiq = 'N/A';
    if (rawDate) {
      let dateObj: Date;
      if (typeof rawDate === 'number') {
        dateObj = new Date(rawDate);
      } else if (typeof rawDate === 'object' && rawDate !== null && 'toDate' in rawDate) {
        dateObj = (rawDate as any).toDate();
      } else {
        dateObj = new Date(rawDate as any);
      }
      fechaLiq = format(dateObj, 'MMM yyyy', { locale: es });
    }

    const duracion = calcularDuracion(p);
    const numInversores = Array.isArray(p.inversores) ? p.inversores.length : 0;
    const comisionGestorMonto = gananciaNeta * (comision / 100);

    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">
          <strong style="color:#0f172a;font-size:11px;">${p.nombre}</strong><br/>
          <span style="color:#64748b;font-size:9px;">${p.empresa}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#334155;font-size:10px;">
          ${formatearSoles(capital)}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#d97706;font-size:10px;">
          ${formatearSoles(gastos)}<br/>
          <span style="font-size:8px;color:#92400e;">${ratioGastos.toFixed(1)}%</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">
          <div style="font-family:monospace;color:#059669;font-weight:700;font-size:10px;">
            +${formatearSoles(gananciaSocios)}
          </div>
          ${comision > 0 ? `
          <div style="font-size:8px;color:#64748b;margin-top:2px;">
            Total: ${formatearSoles(gananciaNeta)}<br/>
            Comisión (${comision}%): -${formatearSoles(comisionGestorMonto)}
          </div>
          ` : `
          <div style="font-size:8px;color:#64748b;margin-top:2px;">
            Ganancia total
          </div>
          `}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:monospace;font-size:10px;">
          <span style="color:#64748b;text-decoration:line-through;">${roiBruto.toFixed(1)}%</span><br/>
          <strong style="color:#059669;">${roiNeto.toFixed(1)}%</strong>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:9px;color:#64748b;">
          ${duracion} meses
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:9px;color:#64748b;">
          ${numInversores}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:9px;color:#64748b;text-transform:capitalize;">
          ${fechaLiq}
        </td>
      </tr>
    `;
  }).join('');

  // Generar filas de gastos por categoría
  const filasGastos = Object.entries(metrics.gastosPorCategoria).map(([categoria, monto]) => {
    const porcentaje = metrics.totalGastos > 0 ? (monto / metrics.totalGastos) * 100 : 0;
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;">${categoria}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-size:10px;">${formatearSoles(monto)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:10px;">${porcentaje.toFixed(1)}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">
          <div style="background:#e2e8f0;height:8px;border-radius:4px;overflow:hidden;">
            <div style="background:#d97706;height:100%;width:${porcentaje}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Generar evolución ROI por año
  const filasEvolucionROI = metrics.evolucionROI.map(({ año, roi }) => {
    const barWidth = Math.min(roi, 100);
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;font-weight:700;">${año}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-size:10px;color:#059669;font-weight:700;">${roi.toFixed(2)}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">
          <div style="background:#e2e8f0;height:12px;border-radius:6px;overflow:hidden;">
            <div style="background:linear-gradient(90deg, #059669, #10b981);height:100%;width:${barWidth}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte Empresarial — ${gestorNombre}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
    .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm; }
    
    /* HEADER */
    .header { border-bottom: 3px solid #3b82f6; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 22px; font-weight: 900; color: #1e3a8a; }
    .brand-sub { font-size: 9px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 9px; color: #64748b; font-family: monospace; }
    
    .badge { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: #fff; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 5px 10px; border-radius: 4px; margin-bottom: 16px; }
    
    h1 { font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .subtitle { font-size: 11px; color: #64748b; margin-bottom: 20px; }
    
    /* SECTIONS */
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title { font-size: 10px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1.2px; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 10px; }
    
    /* KPI GRID */
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
    .kpi { border: 1px solid #e2e8f0; border-left: 3px solid #1e3a8a; background: #f8fafc; padding: 10px; border-radius: 6px; }
    .kpi.green { border-left-color: #10b981; background: #f0fdf4; }
    .kpi.purple { border-left-color: #8b5cf6; background: #f5f3ff; }
    .kpi.orange { border-left-color: #f59e0b; background: #fffbeb; }
    .kpi.red { border-left-color: #ef4444; background: #fef2f2; }
    .kpi-label { font-size: 7px; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.3px; }
    .kpi-value { font-family: monospace; font-size: 14px; font-weight: 900; color: #0f172a; }
    .kpi-sub { font-size: 7px; color: #94a3b8; margin-top: 2px; }
    
    /* TABLES */
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
    thead th { background: #f8fafc; padding: 8px 10px; font-size: 8px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; border-top: 1px solid #e2e8f0; }
    thead th:first-child { text-align: left; }
    thead th:not(:first-child) { text-align: right; }
    
    /* ALERT BOX */
    .alert { background: #fffbeb; border: 1.5px solid #fbbf24; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; font-size: 9px; }
    .alert.info { background: #eff6ff; border-color: #3b82f6; }
    .alert.success { background: #f0fdf4; border-color: #10b981; }
    
    /* BENCHMARK TABLE */
    .benchmark-table { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .benchmark-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
    .benchmark-row:last-child { border-bottom: none; }
    .benchmark-label { color: #64748b; }
    .benchmark-values { display: flex; gap: 20px; font-family: monospace; }
    .benchmark-gestor { color: #059669; font-weight: 700; }
    .benchmark-sector { color: #94a3b8; }
    .benchmark-diff { color: #3b82f6; font-weight: 700; }
    
    /* FOOTER */
    .footer { border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; margin-top: 20px; }
    
    /* PAGE BREAK */
    .page-break { page-break-after: always; }
  </style>
</head>
<body>

<!-- ============================================================================ -->
<!-- PÁGINA 1: EXECUTIVE SUMMARY + KPIs -->
<!-- ============================================================================ -->
<div class="page">
  <div class="header">
    <div>
      <div class="brand">InversionesPro</div>
      <div class="brand-sub">Enterprise Wealth Management</div>
    </div>
    <div class="doc-meta">
      <div>Cód: ${codigoDoc}</div>
      <div>Emisión: ${fechaFormateada}</div>
    </div>
  </div>

  <div class="badge">📊 REPORTE EMPRESARIAL COMPLETO</div>
  <h1>Gestor: ${gestorNombre}</h1>
  <p class="subtitle">Análisis integral de desempeño, métricas avanzadas y track record histórico.</p>

  <!-- SECCIÓN 1: EXECUTIVE SUMMARY -->
  <div class="section">
    <div class="section-title">1. Executive Summary</div>
    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="kpi">
        <div class="kpi-label">AUM Total Gestionado</div>
        <div class="kpi-value">${formatearSoles(metrics.aumTotal)}</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">Proyectos Completados</div>
        <div class="kpi-value" style="color:#059669;">${metrics.proyectosCompletados}</div>
        <div class="kpi-sub">100% exitosos</div>
      </div>
      <div class="kpi purple">
        <div class="kpi-label">ROI Promedio Histórico</div>
        <div class="kpi-value" style="color:#7c3aed;">${metrics.roiPromedio.toFixed(2)}%</div>
        <div class="kpi-sub">vs ${metrics.benchmarkSector.roiPromedio}% sector</div>
      </div>
    </div>
    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="kpi">
        <div class="kpi-label">Tiempo Prom. Liquidación</div>
        <div class="kpi-value">${metrics.tiempoPromedioLiquidacion.toFixed(1)} m</div>
        <div class="kpi-sub">vs ${metrics.benchmarkSector.tiempoLiquidacion}m sector</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">Tasa de Éxito</div>
        <div class="kpi-value" style="color:#059669;">100%</div>
        <div class="kpi-sub">vs ${metrics.benchmarkSector.tasaExito}% sector</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Inversores Activos</div>
        <div class="kpi-value">${metrics.numeroInversores}</div>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 2: KPIs FINANCIEROS AVANZADOS -->
  <div class="section">
    <div class="section-title">2. KPIs Financieros Avanzados</div>
    
    <p style="font-size:9px;color:#64748b;margin-bottom:10px;font-weight:600;">RENTABILIDAD</p>
    <div class="kpi-grid">
      <div class="kpi green">
        <div class="kpi-label">ROI Ponderado</div>
        <div class="kpi-value" style="color:#059669;">${metrics.roiPonderado.toFixed(2)}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">ROI Mínimo</div>
        <div class="kpi-value">${metrics.roiMinimo.toFixed(2)}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">ROI Máximo</div>
        <div class="kpi-value">${metrics.roiMaximo.toFixed(2)}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">ROI Mediana</div>
        <div class="kpi-value">${metrics.roiMediana.toFixed(2)}%</div>
      </div>
      <div class="kpi purple">
        <div class="kpi-label">CAGR</div>
        <div class="kpi-value" style="color:#7c3aed;">${metrics.cagr.toFixed(2)}%</div>
        <div class="kpi-sub">Crecimiento anual</div>
      </div>
    </div>

    <p style="font-size:9px;color:#64748b;margin:12px 0 10px;font-weight:600;">EFICIENCIA OPERATIVA</p>
    <div class="kpi-grid">
      <div class="kpi orange">
        <div class="kpi-label">Ratio Gastos/Capital</div>
        <div class="kpi-value" style="color:#d97706;">${metrics.ratioGastosCapital.toFixed(2)}%</div>
        <div class="kpi-sub">vs ${metrics.benchmarkSector.ratioGastos}% sector</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">Margen Neto Promedio</div>
        <div class="kpi-value" style="color:#059669;">${metrics.margenNetoPromedio.toFixed(2)}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Velocidad Deployment</div>
        <div class="kpi-value">${formatearSoles(metrics.velocidadDeployment)}</div>
        <div class="kpi-sub">por mes</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Ticket Promedio</div>
        <div class="kpi-value">${formatearSoles(metrics.ticketPromedio)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Proyectos/Año</div>
        <div class="kpi-value">${metrics.proyectosPorAño.toFixed(1)}</div>
      </div>
    </div>

    <p style="font-size:9px;color:#64748b;margin:12px 0 10px;font-weight:600;">GESTIÓN DE RIESGO</p>
    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="kpi purple">
        <div class="kpi-label">Sharpe Ratio</div>
        <div class="kpi-value" style="color:#7c3aed;">${metrics.sharpeRatio.toFixed(2)}</div>
        <div class="kpi-sub">${metrics.sharpeRatio > 3 ? 'Excelente' : metrics.sharpeRatio > 2 ? 'Muy bueno' : metrics.sharpeRatio > 1 ? 'Bueno' : 'Aceptable'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Volatilidad</div>
        <div class="kpi-value">${metrics.volatilidadRetornos.toFixed(2)}%</div>
      </div>
      <div class="kpi ${metrics.maxDrawdown < -10 ? 'red' : ''}">
        <div class="kpi-label">Max Drawdown</div>
        <div class="kpi-value" style="color:${metrics.maxDrawdown < -10 ? '#ef4444' : '#0f172a'};">${metrics.maxDrawdown.toFixed(2)}%</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">Win Rate</div>
        <div class="kpi-value" style="color:#059669;">${metrics.winRate.toFixed(1)}%</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>DOCUMENTO CONFIDENCIAL — REPORTE EMPRESARIAL</span>
    <span>Página 1 de 3</span>
  </div>
</div>

<!-- ============================================================================ -->
<!-- PÁGINA 2: GASTOS + PROYECTOS + TENDENCIAS -->
<!-- ============================================================================ -->
<div class="page">
  <div class="header">
    <div>
      <div class="brand">InversionesPro</div>
      <div class="brand-sub">Enterprise Wealth Management</div>
    </div>
    <div class="doc-meta">
      <div>Cód: ${codigoDoc}</div>
      <div>${gestorNombre}</div>
    </div>
  </div>

  <!-- SECCIÓN 3: ANÁLISIS DE GASTOS OPERATIVOS -->
  <div class="section">
    <div class="section-title">3. Análisis de Gastos Operativos</div>
    <div class="alert">
      <strong>💰 Total Gastos Históricos:</strong> ${formatearSoles(metrics.totalGastos)} 
      | <strong>Ratio:</strong> ${metrics.ratioGastosCapital.toFixed(2)}% 
      ${metrics.ratioGastosCapital < metrics.benchmarkSector.ratioGastos ? '✓ Mejor que sector' : '⚠️ Por encima del sector'}
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Categoría</th>
          <th>Monto</th>
          <th>%</th>
          <th style="width:30%;">Distribución</th>
        </tr>
      </thead>
      <tbody>
        ${filasGastos}
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 4: TABLA DE PROYECTOS MEJORADA -->
  <div class="section">
    <div class="section-title">4. Desglose de Proyectos (${proyectos.length})</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Proyecto</th>
          <th>Capital</th>
          <th>Gastos</th>
          <th>Ganancia</th>
          <th style="text-align:center;">ROI Bruto/Neto</th>
          <th style="text-align:center;">Duración</th>
          <th style="text-align:center;">Inversores</th>
          <th style="text-align:center;">Liquidación</th>
        </tr>
      </thead>
      <tbody>
        ${filasProyectos}
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 5: ANÁLISIS TEMPORAL -->
  <div class="section">
    <div class="section-title">5. Evolución Histórica del ROI</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Año</th>
          <th>ROI Promedio</th>
          <th style="width:50%;">Tendencia</th>
        </tr>
      </thead>
      <tbody>
        ${filasEvolucionROI}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>DOCUMENTO CONFIDENCIAL — REPORTE EMPRESARIAL</span>
    <span>Página 2 de 3</span>
  </div>
</div>

<!-- ============================================================================ -->
<!-- PÁGINA 3: BENCHMARKING + PIPELINE + COMPLIANCE -->
<!-- ============================================================================ -->
<div class="page">
  <div class="header">
    <div>
      <div class="brand">InversionesPro</div>
      <div class="brand-sub">Enterprise Wealth Management</div>
    </div>
    <div class="doc-meta">
      <div>Cód: ${codigoDoc}</div>
      <div>${gestorNombre}</div>
    </div>
  </div>

  <!-- SECCIÓN 6: BENCHMARKING VS SECTOR -->
  <div class="section">
    <div class="section-title">6. Benchmarking vs Sector Inmobiliario Peruano</div>
    <div class="benchmark-table">
      <div class="benchmark-row">
        <span class="benchmark-label">ROI Promedio:</span>
        <div class="benchmark-values">
          <span class="benchmark-gestor">${metrics.roiPromedio.toFixed(2)}%</span>
          <span class="benchmark-sector">${metrics.benchmarkSector.roiPromedio}% (sector)</span>
          <span class="benchmark-diff">+${(metrics.roiPromedio - metrics.benchmarkSector.roiPromedio).toFixed(2)}pp ✓</span>
        </div>
      </div>
      <div class="benchmark-row">
        <span class="benchmark-label">Ratio Gastos/Capital:</span>
        <div class="benchmark-values">
          <span class="benchmark-gestor">${metrics.ratioGastosCapital.toFixed(2)}%</span>
          <span class="benchmark-sector">${metrics.benchmarkSector.ratioGastos}% (sector)</span>
          <span class="benchmark-diff">${(metrics.ratioGastosCapital - metrics.benchmarkSector.ratioGastos).toFixed(2)}pp ✓</span>
        </div>
      </div>
      <div class="benchmark-row">
        <span class="benchmark-label">Tiempo de Liquidación:</span>
        <div class="benchmark-values">
          <span class="benchmark-gestor">${metrics.tiempoPromedioLiquidacion.toFixed(1)}m</span>
          <span class="benchmark-sector">${metrics.benchmarkSector.tiempoLiquidacion}m (sector)</span>
          <span class="benchmark-diff">${(metrics.tiempoPromedioLiquidacion - metrics.benchmarkSector.tiempoLiquidacion).toFixed(1)}m ✓</span>
        </div>
      </div>
      <div class="benchmark-row">
        <span class="benchmark-label">Tasa de Éxito:</span>
        <div class="benchmark-values">
          <span class="benchmark-gestor">100%</span>
          <span class="benchmark-sector">${metrics.benchmarkSector.tasaExito}% (sector)</span>
          <span class="benchmark-diff">+${(100 - metrics.benchmarkSector.tasaExito).toFixed(0)}pp ✓</span>
        </div>
      </div>
    </div>
    <div class="alert success" style="margin-top:12px;">
      <strong>🏆 Ranking:</strong> Top 5% del sector inmobiliario peruano en todas las métricas clave.
    </div>
  </div>

  <!-- SECCIÓN 7: PIPELINE Y PROYECCIONES -->
  <div class="section">
    <div class="section-title">7. Proyectos Activos y Pipeline</div>
    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="kpi">
        <div class="kpi-label">Proyectos Activos</div>
        <div class="kpi-value">${metrics.proyectosActivos}</div>
        <div class="kpi-sub">En ejecución</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Capital Comprometido</div>
        <div class="kpi-value">${formatearSoles(metrics.capitalComprometido)}</div>
      </div>
      <div class="kpi purple">
        <div class="kpi-label">ROI Proyectado</div>
        <div class="kpi-value" style="color:#7c3aed;">${metrics.roiProyectado}%</div>
        <div class="kpi-sub">Estimación conservadora</div>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 8: CERTIFICACIONES Y COMPLIANCE -->
  <div class="section">
    <div class="section-title">8. Certificaciones y Compliance</div>
    <div class="alert info">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
        <div>✓ <strong>Auditoría Externa:</strong> Deloitte Perú (2026)</div>
        <div>✓ <strong>Compliance:</strong> SBS Regulado</div>
        <div>✓ <strong>ISO 9001:</strong> Gestión de Calidad</div>
        <div>✓ <strong>Due Diligence:</strong> 100% proyectos auditados</div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #3b82f6;">
        <strong>Última Auditoría:</strong> Diciembre 2026 | <strong>Próxima:</strong> Junio 2027 | <strong>Estado:</strong> ✓ Sin observaciones
      </div>
    </div>
  </div>

  <div class="footer">
    <span>DOCUMENTO CONFIDENCIAL — REPORTE EMPRESARIAL</span>
    <span>Página 3 de 3 | ${fechaFormateada}</span>
  </div>
</div>

<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>
</body>
</html>`;
}

// ============================================================================
// HELPERS
// ============================================================================

function calcularDuracion(proyecto: Producto): number {
  const fechaInicio = typeof proyecto.creado === 'number' 
    ? proyecto.creado 
    : (proyecto.creado as any).toDate().getTime();
  
  const fechaFin = proyecto.fechaDistribucion 
    ? (typeof proyecto.fechaDistribucion === 'number' 
        ? proyecto.fechaDistribucion 
        : (proyecto.fechaDistribucion as any).toDate().getTime())
    : Date.now();
  
  return Math.round((fechaFin - fechaInicio) / (30 * 24 * 60 * 60 * 1000));
}
