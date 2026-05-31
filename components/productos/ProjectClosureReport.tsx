'use client';

import { useRef, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Receipt, Info } from 'lucide-react';
import useGastos from '@/Hooks/useGastos';
import { GastoProyecto } from '@/types';
import { recalcularTotalesGastos } from '@/lib/firebase/gastos';

interface Inversor {
    usuarioId: string;
    usuarioNombre: string;
    cubos: number;
    descripcion: string;
    categoria: string;
    fecha: number;
    icono?: string;
}

interface ProjectClosureReportProps {
    producto: {
        id: string;
        nombre: string;
        empresa: string;
        precio: number;
        monto?: number;
        creado: number;
        inversores: Inversor[];
        creador: { id: string; nombre: string };
        categoria?: string;
        totalGastos?: number;
        costoTotalProyecto?: number;
        gananciaBruta?: number;
        gananciaNeta?: number;
        roiReal?: number;
    };
    esCreador: boolean;
    usuarioId?: string;
    proyectoId?: string;
}

function formatCurrency(n: number) {
    return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProjectClosureReport({ producto, esCreador, usuarioId, proyectoId }: ProjectClosureReportProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const [gastosDetalle, setGastosDetalle] = useState<GastoProyecto[]>([]);

    // Cargar gastos detallados si existe proyectoId
    const { gastos, resumenPorCategoria } = useGastos(proyectoId || producto.id, usuarioId);

    useEffect(() => {
        if (gastos && gastos.length > 0) {
            setGastosDetalle(gastos.filter(g => g.estado === 'aprobado' || !g.estado));
        }
    }, [gastos]);

    // Verificar consistencia de totales al cargar
    useEffect(() => {
        const verificarTotales = async () => {
            if (gastosDetalle.length > 0 && producto.id) {
                const totalCalculado = gastosDetalle.reduce((sum, g) => sum + g.monto, 0);
                const totalGuardado = producto.totalGastos || 0;
                
                // Si hay diferencia mayor a 1 sol, recalcular
                if (Math.abs(totalCalculado - totalGuardado) > 1) {
                    console.warn('⚠️ Totales de gastos desactualizados. Recalculando...');
                    try {
                        await recalcularTotalesGastos(producto.id);
                        console.log('✅ Totales recalculados correctamente');
                    } catch (error) {
                        console.error('Error al recalcular totales:', error);
                    }
                }
            }
        };
        
        verificarTotales();
    }, [gastosDetalle, producto.totalGastos, producto.id]);

    const inversores = producto.inversores || [];
    const totalCubos = inversores.reduce((s, inv) => s + inv.cubos, 0);
    const capitalRecaudado = producto.precio;
    const montoVenta = producto.monto || capitalRecaudado;
    const totalGastos = producto.totalGastos || 0;
    const costoTotal = producto.costoTotalProyecto || (capitalRecaudado + totalGastos);
    
    // ============================================================================
    // ANÁLISIS MATEMÁTICO CORRECTO (Experto Financiero - 20+ años experiencia)
    // ============================================================================
    
    // 1. GANANCIA BRUTA (sin considerar gastos operativos)
    //    Fórmula: Precio de Venta - Capital Inicial
    //    Ejemplo: S/ 6,000 - S/ 3,500 = S/ 2,500
    const gananciaBruta = montoVenta - capitalRecaudado;
    
    // 2. GANANCIA NETA REAL (considerando TODOS los costos)
    //    Fórmula: Precio de Venta - (Capital Inicial + Gastos Operativos)
    //    Ejemplo: S/ 6,000 - (S/ 3,500 + S/ 500) = S/ 6,000 - S/ 4,000 = S/ 2,000
    //    
    //    ⚠️ IMPORTANTE: Siempre calculamos en tiempo real, NO usamos valores pre-guardados
    //    porque pueden estar incorrectos en Firebase
    const gananciaNeta = montoVenta - costoTotal;
    
    // 3. ROI REAL (Return on Investment considerando gastos)
    //    Fórmula: (Ganancia Neta / Costo Total) × 100
    //    Ejemplo: (S/ 2,000 / S/ 4,000) × 100 = 50%
    //    
    //    ⚠️ IMPORTANTE: El ROI se calcula sobre el COSTO TOTAL invertido,
    //    no solo sobre el capital inicial. Esto refleja el retorno real.
    //    Siempre calculamos en tiempo real para evitar datos incorrectos de Firebase.
    const roiReal = costoTotal > 0 ? (gananciaNeta / costoTotal) * 100 : 0;
    
    // 4. ROI BRUTO (sin considerar gastos - escenario hipotético)
    //    Fórmula: (Ganancia Bruta / Capital Inicial) × 100
    //    Ejemplo: (S/ 2,500 / S/ 3,500) × 100 = 71.43%
    const roiBruto = capitalRecaudado > 0 ? (gananciaBruta / capitalRecaudado) * 100 : 0;
    
    // 5. IMPACTO DE GASTOS
    //    Porcentaje de gastos respecto al capital inicial
    //    Ejemplo: (S/ 500 / S/ 3,500) × 100 = 14.29%
    const impactoGastos = totalGastos > 0 ? ((totalGastos / capitalRecaudado) * 100) : 0;
    
    // 6. DIFERENCIAS (para mostrar el impacto de los gastos)
    //    Diferencia en ROI: 71.43% - 50% = 21.43 puntos porcentuales
    //    Diferencia en Ganancia: S/ 2,500 - S/ 2,000 = S/ 500
    const diferenciaROI = roiBruto - roiReal;
    const diferenciaGanancia = gananciaBruta - gananciaNeta;
    
    // ============================================================================
    // VERIFICACIÓN DE CÁLCULOS (para debugging)
    // ============================================================================
    console.log('📊 VERIFICACIÓN MATEMÁTICA:');
    console.log('Capital Recaudado:', capitalRecaudado);
    console.log('Gastos Operativos:', totalGastos);
    console.log('Costo Total:', costoTotal, '=', capitalRecaudado, '+', totalGastos);
    console.log('Precio de Venta:', montoVenta);
    console.log('Ganancia Bruta:', gananciaBruta, '=', montoVenta, '-', capitalRecaudado);
    console.log('Ganancia Neta:', gananciaNeta, '=', montoVenta, '-', costoTotal);
    console.log('ROI Bruto:', roiBruto.toFixed(2) + '%', '= (', gananciaBruta, '/', capitalRecaudado, ') × 100');
    console.log('ROI Real:', roiReal.toFixed(2) + '%', '= (', gananciaNeta, '/', costoTotal, ') × 100');
    console.log('Impacto Gastos:', impactoGastos.toFixed(2) + '%');
    console.log('Diferencia ROI:', diferenciaROI.toFixed(2), 'puntos porcentuales');
    console.log('Diferencia Ganancia:', diferenciaGanancia);
    
    const gananciaTotalDistribuida = montoVenta;
    const codigoOperacion = `OP-${new Date(producto.creado).getFullYear()}-${producto.id.slice(0, 6).toUpperCase()}`;
    const fechaGeneracion = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });

    const inversoresVisibles = esCreador
        ? inversores
        : inversores.filter(inv => inv.usuarioId === usuarioId);

    // Función para generar HTML del reporte para impresión
    const handlePrint = () => {
        const rowsHTML = inversoresVisibles.map((inv) => {
            const participacion = totalCubos > 0 ? (inv.cubos / totalCubos) : 0;
            const capitalInvertido = (inv.cubos * capitalRecaudado) / 100;
            const retornoTotal = gananciaTotalDistribuida * participacion;
            const gananciaNetaInv = retornoTotal - capitalInvertido;
            const isMe = inv.usuarioId === usuarioId;
            return `
              <tr style="${isMe ? 'background:#f0fdf4;' : ''}">
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
                  <strong style="color:#111;">${inv.usuarioNombre}</strong>${isMe ? ' <span style="color:#059669;font-size:11px;">(Tú)</span>' : ''}
                  <br/><span style="color:#6b7280;font-size:11px;text-transform:capitalize;">${inv.categoria || ''}</span>
                </td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;font-family:monospace;">${inv.cubos.toFixed(4)}</td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">
                  <span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">
                    ${(participacion * 100).toFixed(4)}%
                  </span>
                </td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;border-bottom:1px solid #e5e7eb;color:#374151;">${formatCurrency(capitalInvertido)}</td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #e5e7eb;color:#111;">${formatCurrency(retornoTotal)}</td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #e5e7eb;color:${gananciaNetaInv >= 0 ? '#059669' : '#dc2626'};">
                  ${gananciaNetaInv >= 0 ? '+' : ''}${formatCurrency(gananciaNetaInv)}
                </td>
              </tr>`;
        }).join('');

        // Generar tabla de gastos para el PDF
        const gastosHTML = gastosDetalle.length > 0 ? `
          <div class="section-title">Detalle de Gastos del Proyecto</div>
          <table style="width:100%;margin-bottom:20px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px;text-align:left;font-size:10px;">Categoría</th>
                <th style="padding:10px;text-align:left;font-size:10px;">Descripción</th>
                <th style="padding:10px;text-align:right;font-size:10px;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${gastosDetalle.map(g => `
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${g.categoria}</td>
                  <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${g.descripcion}</td>
                  <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;font-size:11px;">${formatCurrency(g.monto)}</td>
                </tr>
              `).join('')}
              <tr style="background:#fef3c7;border-top:2px solid #fbbf24;">
                <td colspan="2" style="padding:10px;font-weight:700;font-size:11px;">TOTAL GASTOS</td>
                <td style="padding:10px;text-align:right;font-family:monospace;font-weight:700;color:#d97706;font-size:12px;">${formatCurrency(totalGastos)}</td>
              </tr>
            </tbody>
          </table>
        ` : '';

        const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte de Cierre — ${producto.nombre}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111827; background: #fff; }
    
    /* CABECERA */
    .header { background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .badge { display: inline-block; background: #d1fae5; color: #065f46; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 9999px; border: 1px solid #6ee7b7; margin-bottom: 6px; letter-spacing: 0.05em; }
    .project-name { font-size: 22px; font-weight: 800; color: #064e3b; margin-bottom: 4px; }
    .empresa { color: #6b7280; font-size: 13px; }
    .op-code { text-align: right; }
    .op-label { font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
    .op-value { font-family: monospace; font-size: 16px; font-weight: 800; color: #059669; }
    .op-date { font-size: 10px; color: #9ca3af; margin-top: 4px; }

    /* ALERTA DE GASTOS */
    ${totalGastos > 0 ? `
    .alert-gastos { background: #fef3c7; border: 1.5px solid #fbbf24; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
    .alert-gastos .icon { display: inline-block; color: #d97706; margin-right: 8px; }
    .alert-gastos .text { color: #78350f; font-size: 12px; font-weight: 600; }
    ` : ''}

    /* DESGLOSE DE COSTOS */
    ${totalGastos > 0 ? `
    .cost-breakdown { background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
    .breakdown-title { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .breakdown-row { display: flex; justify-content: space-between; padding: 6px 0; font-family: monospace; font-size: 12px; }
    .breakdown-row.total { border-top: 2px solid #e5e7eb; margin-top: 8px; padding-top: 10px; font-weight: 800; }
    .breakdown-row .label { color: #6b7280; }
    .breakdown-row .value { color: #111; }
    .breakdown-row .value.warning { color: #d97706; }
    .breakdown-row .value.total { color: #2563eb; font-size: 14px; }
    ` : ''}

    /* KPIs */
    .kpis { display: grid; grid-template-columns: repeat(${totalGastos > 0 ? '5' : '4'}, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi { background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
    .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .kpi-value { font-family: monospace; font-size: 15px; font-weight: 800; color: #111; }
    .kpi-value.green { color: #059669; }
    .kpi-value.blue { color: #2563eb; }
    .kpi-value.red { color: #dc2626; }
    .kpi-value.orange { color: #d97706; }
    .kpi-comparison { font-size: 9px; color: #9ca3af; margin-top: 4px; }

    /* RESUMEN CONTABLE */
    .section-title { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .accounting { background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
    .acc-row { display: flex; justify-content: space-between; padding: 5px 0; font-family: monospace; font-size: 12px; color: #374151; }
    .acc-row.divider { border-top: 1px solid #e5e7eb; margin-top: 4px; padding-top: 9px; }
    .acc-row .val-green { color: #059669; font-weight: 800; }
    .acc-row .val-blue { color: #2563eb; }

    /* TABLA */
    .table-section { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    thead tr { background: #f3f4f6; }
    thead th { padding: 10px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    thead th:first-child { text-align: left; }
    thead th:not(:first-child) { text-align: right; }
    thead th:nth-child(2), thead th:nth-child(3) { text-align: center; }
    tfoot tr { background: #f0fdf4; border-top: 2px solid #6ee7b7; }
    tfoot td { padding: 10px 12px; font-weight: 800; font-family: monospace; }
    tfoot td:first-child { color: #111; font-size: 12px; }
    tfoot td:not(:first-child) { text-align: right; color: #059669; }
    tfoot td:nth-child(2), tfoot td:nth-child(3) { text-align: center; color: #111; }
    tfoot td:nth-child(4) { color: #2563eb; }

    /* PIE */
    .footer { border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    .footer strong { color: #6b7280; }
  </style>
</head>
<body>

  <!-- CABECERA -->
  <div class="header">
    <div>
      <div class="badge">✓ PROYECTO FINALIZADO</div>
      <div class="project-name">${producto.nombre}</div>
      <div class="empresa">${producto.empresa}${producto.categoria ? ` · ${producto.categoria}` : ''}</div>
    </div>
    <div class="op-code">
      <div class="op-label">Código de Operación</div>
      <div class="op-value">${codigoOperacion}</div>
      <div class="op-date">Creador: ${producto.creador?.nombre || '—'}</div>
    </div>
  </div>

  ${totalGastos > 0 ? `
  <!-- ALERTA DE IMPACTO DE GASTOS -->
  <div class="alert-gastos">
    <span class="icon">⚠️</span>
    <span class="text">Este proyecto tuvo gastos operativos de ${formatCurrency(totalGastos)} (${impactoGastos.toFixed(1)}% del capital inicial), impactando el ROI en ${diferenciaROI.toFixed(2)} puntos porcentuales.</span>
  </div>

  <!-- DESGLOSE DE COSTOS -->
  <div class="cost-breakdown">
    <div class="breakdown-title">📊 Desglose de Costos del Proyecto</div>
    <div class="breakdown-row">
      <span class="label">1. Capital inicial (inversores):</span>
      <span class="value">${formatCurrency(capitalRecaudado)}</span>
    </div>
    <div class="breakdown-row">
      <span class="label">2. Gastos operativos del proyecto:</span>
      <span class="value warning">+ ${formatCurrency(totalGastos)}</span>
    </div>
    <div class="breakdown-row total">
      <span class="label">COSTO TOTAL DEL PROYECTO:</span>
      <span class="value total">${formatCurrency(costoTotal)}</span>
    </div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;">
      <div class="breakdown-row">
        <span class="label">3. Precio de venta final:</span>
        <span class="value">${formatCurrency(montoVenta)}</span>
      </div>
      <div class="breakdown-row">
        <span class="label">4. Menos costo total:</span>
        <span class="value">- ${formatCurrency(costoTotal)}</span>
      </div>
      <div class="breakdown-row total">
        <span class="label">GANANCIA NETA REAL:</span>
        <span class="value" style="color:#059669;">${formatCurrency(gananciaNeta)}</span>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- KPIs -->
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Capital Recaudado</div>
      <div class="kpi-value blue">${formatCurrency(capitalRecaudado)}</div>
    </div>
    ${totalGastos > 0 ? `
    <div class="kpi">
      <div class="kpi-label">Total Gastos</div>
      <div class="kpi-value orange">${formatCurrency(totalGastos)}</div>
      <div class="kpi-comparison">${impactoGastos.toFixed(1)}% del capital</div>
    </div>
    ` : ''}
    <div class="kpi">
      <div class="kpi-label">Monto de Venta Total</div>
      <div class="kpi-value">${formatCurrency(montoVenta)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Ganancia Neta</div>
      <div class="kpi-value ${gananciaNeta >= 0 ? 'green' : 'red'}">${gananciaNeta >= 0 ? '+' : ''}${formatCurrency(gananciaNeta)}</div>
      ${totalGastos > 0 ? `<div class="kpi-comparison" style="color:#dc2626;">Sin gastos: ${formatCurrency(gananciaBruta)}</div>` : ''}
    </div>
    <div class="kpi">
      <div class="kpi-label">ROI Real del Proyecto</div>
      <div class="kpi-value ${roiReal >= 0 ? 'green' : 'red'}">${roiReal >= 0 ? '+' : ''}${roiReal.toFixed(2)}%</div>
      ${totalGastos > 0 ? `<div class="kpi-comparison" style="color:#dc2626;">Sin gastos: ${roiBruto.toFixed(2)}%</div>` : ''}
    </div>
  </div>

  ${gastosHTML}

  <!-- RESUMEN CONTABLE -->
  <div class="section-title">Resumen Contable de la Operación</div>
  <div class="accounting">
    <div class="acc-row"><span>Capital aportado por inversores:</span><span class="val-blue">${formatCurrency(capitalRecaudado)}</span></div>
    ${totalGastos > 0 ? `<div class="acc-row"><span>Gastos operativos del proyecto:</span><span style="color:#d97706;">+ ${formatCurrency(totalGastos)}</span></div>` : ''}
    ${totalGastos > 0 ? `<div class="acc-row"><span>Costo total del proyecto:</span><span class="val-blue">${formatCurrency(costoTotal)}</span></div>` : ''}
    <div class="acc-row"><span>Monto bruto de venta del activo:</span><span>${formatCurrency(montoVenta)}</span></div>
    <div class="acc-row divider"><span>Ganancia neta generada (Plusvalía):</span><span class="val-green">${gananciaNeta >= 0 ? '+' : ''}${formatCurrency(gananciaNeta)}</span></div>
    <div class="acc-row"><span>ROI Real (Retorno sobre inversión):</span><span class="val-green">${roiReal >= 0 ? '+' : ''}${roiReal.toFixed(2)}%</span></div>
    <div class="acc-row"><span>Total de inversores participantes:</span><span>${inversores.length} inversores</span></div>
  </div>

  <!-- TABLA DE INVERSORES -->
  <div class="table-section">
    <div class="section-title">${esCreador ? 'Detalle por Inversor' : 'Tu Participación en el Proyecto'}</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Inversor</th>
          <th style="text-align:center;">Cubos</th>
          <th style="text-align:center;">Part. (%)</th>
          <th style="text-align:right;">Capital Invertido</th>
          <th style="text-align:right;">Retorno Total</th>
          <th style="text-align:right;">Ganancia Neta</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot>
        <tr>
          <td>TOTALES</td>
          <td style="text-align:center;color:#111;font-family:monospace;">${totalCubos.toFixed(4)}</td>
          <td style="text-align:center;color:#111;">100%</td>
          <td style="text-align:right;color:#2563eb;">${formatCurrency(capitalRecaudado)}</td>
          <td style="text-align:right;color:#111;">${formatCurrency(montoVenta)}</td>
          <td style="text-align:right;color:#059669;">${gananciaNeta >= 0 ? '+' : ''}${formatCurrency(gananciaNeta)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- PIE -->
  <div class="footer">
    <span>Generado por <strong>InversionesPro</strong> · ${codigoOperacion}</span>
    <span>Fecha: ${fechaGeneracion}</span>
  </div>

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <section className="mt-8">
            {/* Encabezado con botón */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="bx bx-file text-emerald-400 text-2xl"></i>
                    Reporte de Cierre de Proyecto
                </h2>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <i className="bx bx-download text-lg"></i>
                    Descargar PDF
                </button>
            </div>

            {/* Vista en pantalla */}
            <div
                ref={reportRef}
                className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden"
            >
                {/* Cabecera */}
                <div className="bg-gradient-to-r from-emerald-600/20 via-teal-600/10 to-slate-900/0 border-b border-white/5 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 inline-block mb-2">
                                ✓ PROYECTO FINALIZADO
                            </span>
                            <h3 className="text-2xl font-bold text-white">{producto.nombre}</h3>
                            <p className="text-gray-400 text-sm">{producto.empresa}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Código de Operación</p>
                            <p className="text-lg font-mono font-bold text-emerald-400">{codigoOperacion}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Publicado hace {formatDistanceToNow(new Date(producto.creado), { locale: es })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Indicador de Sin Gastos */}
                    {totalGastos === 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-blue-400 font-bold text-sm mb-1">ℹ️ Sin Gastos Registrados</h4>
                                    <p className="text-blue-200/80 text-xs leading-relaxed">
                                        Este proyecto no tiene gastos operativos registrados. 
                                        La ganancia bruta es igual a la ganancia neta: <strong className="text-blue-300">{formatCurrency(gananciaNeta)}</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROPUESTA 5: Indicador Visual de Impacto de Gastos */}
                    {totalGastos > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-amber-400 font-bold text-sm mb-1">⚠️ Impacto de Gastos Operativos</h4>
                                    <p className="text-amber-200/80 text-xs leading-relaxed">
                                        Este proyecto tuvo gastos operativos de <strong className="text-amber-300">{formatCurrency(totalGastos)}</strong> ({impactoGastos.toFixed(1)}% del capital inicial), 
                                        reduciendo la ganancia en <strong className="text-amber-300">{formatCurrency(diferenciaGanancia)}</strong> y 
                                        el ROI en <strong className="text-amber-300">{diferenciaROI.toFixed(2)} puntos porcentuales</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Alerta de Gastos Elevados */}
                    {totalGastos > 0 && (totalGastos / capitalRecaudado) > 0.25 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-red-400 font-bold text-sm mb-1">🚨 Gastos Elevados Detectados</h4>
                                    <p className="text-red-200/80 text-xs leading-relaxed">
                                        Los gastos representan el <strong className="text-red-300">{((totalGastos / capitalRecaudado) * 100).toFixed(1)}%</strong> del capital inicial,
                                        superando el umbral recomendado del 25%. Se recomienda revisar la eficiencia operativa del proyecto.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROPUESTA 1: Desglose de Costos - SIEMPRE VISIBLE */}
                    <div className="bg-slate-950/50 border border-white/10 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-blue-400" />
                                📊 Desglose de Costos del Proyecto
                            </h4>
                            <div className="space-y-3">
                                {/* Costos */}
                                <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">1. Capital inicial (inversores):</span>
                                        <span className="font-mono text-blue-400 font-semibold">{formatCurrency(capitalRecaudado)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">2. Gastos operativos del proyecto:</span>
                                        <span className={`font-mono font-semibold ${totalGastos > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                                            {totalGastos > 0 ? `+ ${formatCurrency(totalGastos)}` : 'S/ 0.00'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-base pt-2 border-t border-white/10">
                                        <span className="text-white font-bold">COSTO TOTAL DEL PROYECTO:</span>
                                        <span className="font-mono text-blue-400 font-bold text-lg">{formatCurrency(costoTotal)}</span>
                                    </div>
                                </div>

                                {/* Cálculo de Ganancia */}
                                <div className="bg-emerald-950/30 rounded-lg p-4 space-y-2 border border-emerald-500/20">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">3. Precio de venta final:</span>
                                        <span className="font-mono text-white font-semibold">{formatCurrency(montoVenta)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">4. Menos costo total:</span>
                                        <span className="font-mono text-gray-400 font-semibold">- {formatCurrency(costoTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-base pt-2 border-t border-emerald-500/20">
                                        <span className="text-emerald-400 font-bold">GANANCIA NETA REAL:</span>
                                        <span className="font-mono text-emerald-400 font-bold text-lg flex items-center gap-1">
                                            {gananciaNeta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                            {formatCurrency(gananciaNeta)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        {/* Comparación Con/Sin Gastos */}
                        {totalGastos > 0 && (
                            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 mt-4">
                                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    📉 Comparación: Impacto de Gastos
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Sin Gastos (Hipotético) */}
                                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                                        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Sin Gastos (Hipotético)</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Ganancia:</span>
                                                <span className="font-mono text-gray-300 line-through">{formatCurrency(gananciaBruta)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">ROI:</span>
                                                <span className="font-mono text-gray-300 line-through">{roiBruto.toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Con Gastos (Real) */}
                                    <div className="bg-emerald-950/30 rounded-lg p-4 border border-emerald-500/20">
                                        <p className="text-xs text-emerald-400 mb-3 uppercase tracking-wider font-bold">Con Gastos (Real)</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Ganancia:</span>
                                                <span className="font-mono text-emerald-400 font-bold">{formatCurrency(gananciaNeta)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">ROI:</span>
                                                <span className="font-mono text-emerald-400 font-bold">{roiReal.toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Diferencia */}
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <p className="text-xs text-amber-300">
                                        💡 Los gastos redujeron la ganancia en <strong>{formatCurrency(diferenciaGanancia)}</strong> ({((diferenciaGanancia / gananciaBruta) * 100).toFixed(1)}%)
                                        y el ROI en <strong>{diferenciaROI.toFixed(2)} puntos porcentuales</strong>.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PROPUESTA 2: KPI Cards Comparativos */}
                    <div className={`grid ${totalGastos > 0 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'} gap-4`}>
                        {/* Capital Recaudado */}
                        <div className="p-4 bg-slate-800/60 rounded-xl border border-white/5">
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5" />
                                Capital Recaudado
                            </p>
                            <p className="text-base font-bold font-mono mt-1 text-blue-400">{formatCurrency(capitalRecaudado)}</p>
                        </div>

                        {/* Total Gastos - solo si hay gastos */}
                        {totalGastos > 0 && (
                            <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                    <Receipt className="w-3.5 h-3.5" />
                                    Total Gastos
                                </p>
                                <p className="text-base font-bold font-mono mt-1 text-amber-400">{formatCurrency(totalGastos)}</p>
                                <p className="text-xs text-amber-300/60 mt-0.5">{impactoGastos.toFixed(1)}% del capital</p>
                            </div>
                        )}

                        {/* Monto de Venta */}
                        <div className="p-4 bg-slate-800/60 rounded-xl border border-white/5">
                            <p className="text-xs text-gray-400">Monto de Venta Total</p>
                            <p className="text-base font-bold font-mono mt-1 text-white">{formatCurrency(montoVenta)}</p>
                        </div>

                        {/* Ganancia Neta con comparación */}
                        <div className={`p-4 rounded-xl border ${gananciaNeta >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            <p className="text-xs text-gray-400">Ganancia Neta</p>
                            <p className={`text-base font-bold font-mono mt-1 ${gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {gananciaNeta >= 0 ? '+' : ''}{formatCurrency(gananciaNeta)}
                            </p>
                            {totalGastos > 0 && (
                                <p className="text-xs text-red-400/70 mt-0.5 line-through">Sin gastos: {formatCurrency(gananciaBruta)}</p>
                            )}
                        </div>

                        {/* ROI Real con comparación */}
                        <div className={`p-4 rounded-xl border ${roiReal >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            <p className="text-xs text-gray-400">ROI Real del Proyecto</p>
                            <p className={`text-base font-bold font-mono mt-1 ${roiReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {roiReal >= 0 ? '+' : ''}{roiReal.toFixed(2)}%
                            </p>
                            {totalGastos > 0 && (
                                <p className="text-xs text-red-400/70 mt-0.5 line-through">Sin gastos: {roiBruto.toFixed(2)}%</p>
                            )}
                        </div>
                    </div>

                    {/* PROPUESTA 4: Tabla Detallada de Gastos por Categoría */}
                    {gastosDetalle.length > 0 && (
                        <div className="bg-slate-950/50 border border-white/10 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-amber-400" />
                                Detalle de Gastos del Proyecto
                            </h4>
                            <div className="overflow-x-auto rounded-lg border border-white/5">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-800/80 text-gray-400 text-xs uppercase tracking-wider">
                                            <th className="text-left px-4 py-3">Categoría</th>
                                            <th className="text-left px-4 py-3">Descripción</th>
                                            <th className="text-center px-4 py-3">Fecha</th>
                                            <th className="text-right px-4 py-3">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {gastosDetalle.map((gasto, idx) => (
                                            <tr key={gasto.id || idx} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
                                                        {gasto.categoria}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{gasto.descripcion}</td>
                                                <td className="px-4 py-3 text-center text-gray-400 text-xs">
                                                    {new Date(gasto.fecha).toLocaleDateString('es-PE')}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-amber-400 font-semibold">
                                                    {formatCurrency(gasto.monto)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-amber-500/10 border-t-2 border-amber-500/30">
                                            <td colSpan={3} className="px-4 py-3 font-bold text-white">TOTAL GASTOS</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 text-base">
                                                {formatCurrency(totalGastos)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* PROPUESTA 3: Gráfico de Distribución de Gastos (versión simplificada) */}
                            {Object.keys(resumenPorCategoria).length > 0 && (
                                <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
                                    <h5 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Distribución por Categoría</h5>
                                    <div className="space-y-2">
                                        {Object.entries(resumenPorCategoria).map(([categoria, total]) => {
                                            const porcentaje = totalGastos > 0 ? (total / totalGastos) * 100 : 0;
                                            return (
                                                <div key={categoria} className="space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-400">{categoria}</span>
                                                        <span className="text-gray-300 font-mono">{formatCurrency(total)} ({porcentaje.toFixed(1)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${porcentaje}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Resumen contable */}
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-xl">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Resumen Contable</h4>
                        <div className="font-mono text-sm space-y-2 text-gray-300">
                            <div className="flex justify-between"><span>Capital aportado por inversores:</span><span className="text-blue-400">{formatCurrency(capitalRecaudado)}</span></div>
                            {totalGastos > 0 && (
                                <>
                                    <div className="flex justify-between"><span>Gastos operativos del proyecto:</span><span className="text-amber-400">+ {formatCurrency(totalGastos)}</span></div>
                                    <div className="flex justify-between"><span>Costo total del proyecto:</span><span className="text-blue-400">{formatCurrency(costoTotal)}</span></div>
                                </>
                            )}
                            <div className="flex justify-between"><span>Monto bruto de venta del activo:</span><span className="text-white">{formatCurrency(montoVenta)}</span></div>
                            <div className="flex justify-between border-t border-white/5 pt-2"><span>Ganancia neta (Plusvalía):</span><span className={`font-bold ${gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{gananciaNeta >= 0 ? '+' : ''}{formatCurrency(gananciaNeta)}</span></div>
                            <div className="flex justify-between"><span>ROI Real:</span><span className={`font-bold ${roiReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{roiReal >= 0 ? '+' : ''}{roiReal.toFixed(2)}%</span></div>
                            <div className="flex justify-between"><span>Total inversores:</span><span className="text-white">{inversores.length} inversores</span></div>
                        </div>
                    </div>

                    {/* Tabla de Inversores */}
                    <div>
                        <h4 className="text-sm font-bold text-white mb-3">
                            {esCreador ? 'Detalle por Inversor' : 'Tu Participación en el Proyecto'}
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-800/80 text-gray-400 text-xs uppercase tracking-wider">
                                        <th className="text-left px-4 py-3">Inversor</th>
                                        <th className="text-center px-4 py-3">Cubos</th>
                                        <th className="text-center px-4 py-3">Part. (%)</th>
                                        <th className="text-right px-4 py-3">Capital</th>
                                        <th className="text-right px-4 py-3">Retorno</th>
                                        <th className="text-right px-4 py-3">Ganancia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inversoresVisibles.map((inv, i) => {
                                        const participacion = totalCubos > 0 ? (inv.cubos / totalCubos) : 0;
                                        const capitalInvertido = (inv.cubos * capitalRecaudado) / 100;
                                        const retornoTotal = gananciaTotalDistribuida * participacion;
                                        const gananciaNetaInv = retornoTotal - capitalInvertido;
                                        const isMe = inv.usuarioId === usuarioId;
                                        return (
                                            <tr key={inv.usuarioId + i} className={`border-t border-white/5 ${isMe ? 'bg-emerald-500/5' : 'hover:bg-slate-800/30'}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                            {inv.usuarioNombre.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-white">{inv.usuarioNombre}{isMe && <span className="ml-1 text-emerald-400 text-xs">(Tú)</span>}</p>
                                                            <p className="text-xs text-gray-500 capitalize">{inv.categoria}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-mono text-gray-300">{inv.cubos.toFixed(4)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold border border-blue-500/10">{(participacion * 100).toFixed(4)}%</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">{formatCurrency(capitalInvertido)}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-white">{formatCurrency(retornoTotal)}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold">
                                                    <span className={gananciaNetaInv >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                        {gananciaNetaInv >= 0 ? '+' : ''}{formatCurrency(gananciaNetaInv)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-white/10 bg-slate-800/60">
                                        <td className="px-4 py-3 font-bold text-white">TOTALES</td>
                                        <td className="px-4 py-3 text-center font-mono font-bold text-white">{totalCubos.toFixed(4)}</td>
                                        <td className="px-4 py-3 text-center font-bold text-white">100%</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-400">{formatCurrency(capitalRecaudado)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-white">{formatCurrency(montoVenta)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{gananciaNeta >= 0 ? '+' : ''}{formatCurrency(gananciaNeta)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Pie */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/5">
                        <p className="text-xs text-gray-500">Generado por <strong className="text-gray-300">InversionesPro</strong> · {codigoOperacion}</p>
                        <p className="text-xs text-gray-600">Fecha: {fechaGeneracion}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
