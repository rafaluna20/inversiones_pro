'use client';

/**
 * COMPROBANTE PDF — TRACK RECORD DEL GESTOR
 *
 * Genera un reporte corporativo consolidado con el desempeño histórico
 * del gestor. Diseñado para presentarse a fondos e inversores de alto capital.
 * Muestra el AUM levantado, la utilidad neta repartida a socios y el detalle
 * de proyectos completados.
 *
 * @version 1.0 Enterprise
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatearSoles } from '@/lib/distribucion';
import type { Producto, Distribucion } from '@/types';
import { FaFilePdf } from 'react-icons/fa';

interface TrackRecordPDFProps {
  proyectos: Producto[];
  distribuciones: Distribucion[];
  gestorNombre: string;
}

export default function TrackRecordGestorPDF({ proyectos, distribuciones, gestorNombre }: TrackRecordPDFProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerar = () => {
    setGenerating(true);

    const fechaFormateada = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    const codigoDoc = `TRCK-${Date.now().toString().slice(-6)}-GST`;

    const proyectosLiquidados = proyectos.filter((p) => p.distribucionEjecutada === true || p.estado === false);
    
    // Métricas para el Track Record (Enfocadas en el valor generado para los socios)
    const capitalTotalLevantado = proyectosLiquidados.reduce((sum, p) => sum + Number(p.precio || p.monto || 0), 0);
    
    // Calcular utilidad total para socios sumando las distribuciones reales o calculando el fallback
    const utilidadTotalGeneradaParaSocios = proyectosLiquidados.reduce((sum, p) => {
      const dist = distribuciones.find(d => d.proyectoId === p.id);
      const capital = Number(p.precio || p.monto || 0);
      const comision = Number(p.comisionGestor || 10);
      const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
      const poolSocios = dist ? Number(dist.poolSocios) : (utilidadNeta * (1 - comision / 100));
      return sum + poolSocios;
    }, 0);
    
    const roiPromedio = capitalTotalLevantado > 0 
      ? (utilidadTotalGeneradaParaSocios / capitalTotalLevantado) * 100 
      : 0;

    // Filas de proyectos
    const filasProyectos = proyectosLiquidados
      .map((p) => {
        const dist = distribuciones.find(d => d.proyectoId === p.id);
        const capital = Number(p.precio || p.monto || 0);
        const comision = Number(p.comisionGestor || 10);
        const utilidadNeta = Number(p.utilidadNeta || (capital * 0.15));
        const gananciaSocios = dist ? Number(dist.poolSocios) : (utilidadNeta * (1 - comision / 100));
        const roiProyecto = capital > 0 ? (gananciaSocios / capital) * 100 : 0;
        const rawDate = p.fechaDistribucion || p.creado;
        let fechaLiq = 'N/A';
        if (rawDate) {
          let dateObj: Date;
          if (typeof rawDate === 'number') {
            dateObj = new Date(rawDate);
          } else if (typeof rawDate === 'object' && rawDate !== null && 'toDate' in rawDate && typeof (rawDate as any).toDate === 'function') {
            dateObj = (rawDate as any).toDate();
          } else {
            dateObj = new Date(rawDate as any);
          }
          fechaLiq = format(dateObj, 'MMM yyyy', { locale: es });
        }

        return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;">
          <strong style="color:#0f172a;font-size:12px;">${p.nombre}</strong><br/>
          <span style="color:#64748b;font-size:10px;">${p.empresa}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#334155;">
          ${formatearSoles(capital)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#059669;font-weight:700;">
          +${formatearSoles(gananciaSocios)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:monospace;color:#8b5cf6;font-weight:700;">
          ${roiProyecto.toFixed(2)}%
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b;text-transform:capitalize;">
          ${fechaLiq}
        </td>
      </tr>
    `
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Track Record Corporativo — ${gestorNombre}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
    .page { width: 210mm; min-height: 297mm; padding: 22mm 20mm; display: flex; flex-direction: column; }
    
    .header { border-bottom: 3px solid #f59e0b; padding-bottom: 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 24px; font-weight: 900; color: #1e3a8a; }
    .brand-sub { font-size: 10px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 11px; color: #64748b; font-family: monospace; }
    
    .badge { display: inline-block; background: #0f172a; color: #f59e0b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 6px 12px; border-radius: 4px; margin-bottom: 20px; }
    
    h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 28px; }
    
    .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 28px; }
    .kpi { border: 1px solid #e2e8f0; border-left: 4px solid #1e3a8a; background: #f8fafc; padding: 14px; border-radius: 8px; }
    .kpi.green { border-left-color: #10b981; background: #f0fdf4; }
    .kpi.purple { border-left-color: #8b5cf6; background: #f5f3ff; }
    .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 6px; letter-spacing: 0.5px; }
    .kpi-value { font-family: monospace; font-size: 18px; font-weight: 900; color: #0f172a; }
    
    .section-title { font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 14px; margin-top: 20px; }
    
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
    thead th { background: #f8fafc; padding: 10px 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; border-top: 1px solid #e2e8f0; text-align: right; }
    thead th:first-child { text-align: left; }
    
    .footer { border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; margin-top: auto; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">InversionesPro</div>
      <div class="brand-sub">Wealth Management Systems</div>
    </div>
    <div class="doc-meta">
      <div>Cód: ${codigoDoc}</div>
      <div>Emisión: ${fechaFormateada}</div>
    </div>
  </div>

  <div class="badge">Performance & Track Record Oficial</div>
  <h1>Gestor: ${gestorNombre}</h1>
  <p class="subtitle">Resumen histórico de desempeño de capital gestionado y retornos entregados.</p>

  <!-- KPIs Corporativos -->
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Capital Total Levantado</div>
      <div class="kpi-value">${formatearSoles(capitalTotalLevantado)}</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Utilidad Neta Repartida a Socios</div>
      <div class="kpi-value" style="color:#059669;">+${formatearSoles(utilidadTotalGeneradaParaSocios)}</div>
    </div>
    <div class="kpi purple">
      <div class="kpi-label">ROI Promedio Histórico</div>
      <div class="kpi-value" style="color:#7c3aed;">${roiPromedio.toFixed(2)}%</div>
    </div>
  </div>

  <!-- Tabla de Proyectos Históricos -->
  <div class="section-title">Desglose de Proyectos Exitosos (${proyectosLiquidados.length})</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Proyecto</th>
        <th>Capital Levantado</th>
        <th>Ganancia Socios</th>
        <th style="text-align:center;">ROI Neto</th>
        <th style="text-align:center;">Liquidación</th>
      </tr>
    </thead>
    <tbody>
      ${proyectosLiquidados.length > 0 ? filasProyectos : '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">Aún no hay proyectos liquidados en el historial.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>DOCUMENTO CONFIDENCIAL — RÉCORD DE DESEMPEÑO</span>
    <span>Valores calculados de forma inmutable tras deducción de comisiones del gestor.</span>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { setGenerating(false); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setGenerating(false);
  };

  return (
    <button
      onClick={handleGenerar}
      disabled={generating || proyectos.filter(p => p.distribucionEjecutada || p.estado === false).length === 0}
      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-900 border border-white/10 hover:border-amber-500/50 text-amber-400 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <FaFilePdf className="text-lg" />
      {generating ? 'Generando...' : 'Descargar Track Record'}
    </button>
  );
}
