'use client';

/**
 * COMPROBANTE PDF DE DISTRIBUCIÓN
 *
 * Genera un comprobante PDF individual para el gestor
 * que puede compartir con cada socio. Incluye hash SHA-256.
 *
 * @version 1.0 Enterprise
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatearSoles } from '@/lib/distribucion';
import type { Distribucion, DistribucionSocio } from '@/types';

interface ComprobantePDFProps {
  distribucion: Distribucion;
  /** Si se pasa un socioUid, genera el comprobante individual de ese socio */
  socioUid?: string;
  nombreSocio?: string;
}

export default function ComprobantePDF({ distribucion, socioUid, nombreSocio }: ComprobantePDFProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerar = () => {
    setGenerating(true);

    const fechaFormateada = format(
      new Date(distribucion.fechaEjecucion),
      "dd 'de' MMMM 'de' yyyy, HH:mm",
      { locale: es }
    );
    const codigoDoc = `DIST-${distribucion.proyectoId.slice(0, 6).toUpperCase()}-${distribucion.createdAt.toString().slice(-5)}`;

    // Filtrar: si se especifica socioUid, solo ese socio; si no, todos
    const sociosAMostrar: DistribucionSocio[] = socioUid
      ? distribucion.distribucionPorSocio.filter((s) => s.usuarioId === socioUid)
      : distribucion.distribucionPorSocio;

    const filasSocios = sociosAMostrar
      .map(
        (s, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;font-family:monospace;">
          ${socioUid ? (nombreSocio || s.usuarioId) : `Socio ${i + 1} — ${s.usuarioId.slice(0, 8).toUpperCase()}`}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#334155;">
          ${formatearSoles(s.montoInvertido)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:monospace;color:#8b5cf6;font-weight:700;">
          ${s.participacionPorcentaje.toFixed(4)}%
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#059669;font-weight:700;">
          +${formatearSoles(s.gananciaDistribuida)}
        </td>
      </tr>
    `
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Comprobante de Distribución — ${distribucion.proyectoNombre}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
    .page { width: 210mm; min-height: 297mm; padding: 22mm 20mm; display: flex; flex-direction: column; }
    
    .header { border-bottom: 3px solid #f59e0b; padding-bottom: 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 24px; font-weight: 900; color: #1e3a8a; }
    .brand-sub { font-size: 10px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 11px; color: #64748b; font-family: monospace; }
    
    .badge { display: inline-block; background: #f59e0b; color: #fff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 4px; margin-bottom: 20px; }
    
    h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 28px; }
    
    .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 28px; }
    .kpi { border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; background: #fffbeb; padding: 14px; border-radius: 8px; }
    .kpi.green { border-left-color: #10b981; background: #f0fdf4; }
    .kpi.blue { border-left-color: #3b82f6; background: #eff6ff; }
    .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 6px; letter-spacing: 0.5px; }
    .kpi-value { font-family: monospace; font-size: 16px; font-weight: 900; color: #0f172a; }
    
    .section-title { font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 14px; }
    
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
    thead th { background: #f8fafc; padding: 10px 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; border-top: 1px solid #e2e8f0; text-align: right; }
    thead th:first-child { text-align: left; }
    
    .formula-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px; }
    .formula-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
    .formula-divider { border-top: 1px solid #cbd5e1; margin: 8px 0; }
    
    .crypto-box { background: #0f172a; border-left: 4px solid #10b981; color: #f8fafc; padding: 14px; border-radius: 8px; margin-top: auto; font-family: monospace; }
    .crypto-title { font-size: 9px; text-transform: uppercase; font-weight: 800; color: #10b981; letter-spacing: 1px; margin-bottom: 5px; }
    .crypto-hash { font-size: 10px; word-break: break-all; color: #f1f5f9; }
    
    .footer { border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; margin-top: 20px; }
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
      <div>${fechaFormateada}</div>
    </div>
  </div>

  <div class="badge">Comprobante Oficial de Distribución</div>
  <h1>${distribucion.proyectoNombre}</h1>
  <p class="subtitle">Liquidación de utilidades ejecutada el ${fechaFormateada}</p>

  <!-- KPIs -->
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Utilidad Neta</div>
      <div class="kpi-value">${formatearSoles(distribucion.utilidadNeta)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Fee Gestor (${distribucion.comisionGestorPorcentaje}%)</div>
      <div class="kpi-value" style="color:#f59e0b;">${formatearSoles(distribucion.feeGestor)}</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Pool Socios (${100 - distribucion.comisionGestorPorcentaje}%)</div>
      <div class="kpi-value" style="color:#059669;">${formatearSoles(distribucion.poolSocios)}</div>
    </div>
  </div>

  <!-- Fórmula aplicada -->
  <div class="section-title">Fórmula de Distribución Aplicada</div>
  <div class="formula-box">
    <div class="formula-row"><span style="color:#475569;">Utilidad Neta Total</span><span style="font-family:monospace;font-weight:700;">${formatearSoles(distribucion.utilidadNeta)}</span></div>
    <div class="formula-row"><span style="color:#f59e0b;">Fee Gestor (${distribucion.comisionGestorPorcentaje}%)</span><span style="font-family:monospace;color:#f59e0b;">−${formatearSoles(distribucion.feeGestor)}</span></div>
    <div class="formula-divider"></div>
    <div class="formula-row"><span style="color:#059669;font-weight:700;">Pool Distribuible para Socios</span><span style="font-family:monospace;font-weight:900;color:#059669;">${formatearSoles(distribucion.poolSocios)}</span></div>
    <div style="font-size:11px;color:#94a3b8;margin-top:10px;">Ganancia socio[i] = Pool Socios × (inversión[i] / capital total ${formatearSoles(distribucion.capitalTotalSocios)})</div>
  </div>

  <!-- Tabla de socios -->
  <div class="section-title">Detalle por Socio</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Inversor</th>
        <th>Capital Aportado</th>
        <th style="text-align:center;">Participación</th>
        <th>Ganancia Neta</th>
      </tr>
    </thead>
    <tbody>
      ${filasSocios}
    </tbody>
  </table>

  <!-- Hash de auditoría -->
  <div class="crypto-box">
    <div class="crypto-title">🔑 Certificado de Inmutabilidad — SHA-256 Audit Hash</div>
    <div class="crypto-hash">${distribucion.hashSHA256}</div>
  </div>

  <div class="footer">
    <span>COMPROBANTE OFICIAL DE DISTRIBUCIÓN — CONFIDENCIAL</span>
    <span>InversionesPro S.A. — Documento generado por sistema</span>
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
      disabled={generating}
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-amber-900/20 disabled:opacity-50"
    >
      <span>📄</span>
      {generating ? 'Generando...' : 'Comprobante PDF'}
    </button>
  );
}
