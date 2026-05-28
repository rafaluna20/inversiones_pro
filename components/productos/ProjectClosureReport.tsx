'use client';

import { useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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
    };
    esCreador: boolean;
    usuarioId?: string;
}

function formatCurrency(n: number) {
    return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProjectClosureReport({ producto, esCreador, usuarioId }: ProjectClosureReportProps) {
    const reportRef = useRef<HTMLDivElement>(null);

    const inversores = producto.inversores || [];
    const totalCubos = inversores.reduce((s, inv) => s + inv.cubos, 0);
    const capitalRecaudado = producto.precio;
    const montoVenta = producto.monto || capitalRecaudado;
    const gananciaTotalDistribuida = montoVenta;
    const gananciaNeta = montoVenta - capitalRecaudado;
    const roi = capitalRecaudado > 0 ? (gananciaNeta / capitalRecaudado) * 100 : 0;
    const codigoOperacion = `OP-${new Date(producto.creado).getFullYear()}-${producto.id.slice(0, 6).toUpperCase()}`;
    const fechaGeneracion = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });

    const inversoresVisibles = esCreador
        ? inversores
        : inversores.filter(inv => inv.usuarioId === usuarioId);

    // ───────────────────────────────────────────────────
    // Genera HTML completo y lo imprime en ventana nueva
    // ───────────────────────────────────────────────────
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
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">${inv.cubos}</td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">
                  <span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">
                    ${(participacion * 100).toFixed(2)}%
                  </span>
                </td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;border-bottom:1px solid #e5e7eb;color:#374151;">${formatCurrency(capitalInvertido)}</td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #e5e7eb;color:#111;">${formatCurrency(retornoTotal)}</td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #e5e7eb;color:${gananciaNetaInv >= 0 ? '#059669' : '#dc2626'};">
                  ${gananciaNetaInv >= 0 ? '+' : ''}${formatCurrency(gananciaNetaInv)}
                </td>
              </tr>`;
        }).join('');

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

    /* KPIs */
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi { background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
    .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .kpi-value { font-family: monospace; font-size: 15px; font-weight: 800; color: #111; }
    .kpi-value.green { color: #059669; }
    .kpi-value.blue { color: #2563eb; }
    .kpi-value.red { color: #dc2626; }

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

  <!-- KPIs -->
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Capital Recaudado</div>
      <div class="kpi-value blue">${formatCurrency(capitalRecaudado)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Monto de Venta Total</div>
      <div class="kpi-value">${formatCurrency(montoVenta)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Ganancia Neta</div>
      <div class="kpi-value ${gananciaNeta >= 0 ? 'green' : 'red'}">${gananciaNeta >= 0 ? '+' : ''}${formatCurrency(gananciaNeta)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">ROI del Proyecto</div>
      <div class="kpi-value ${roi >= 0 ? 'green' : 'red'}">${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%</div>
    </div>
  </div>

  <!-- RESUMEN CONTABLE -->
  <div class="section-title">Resumen Contable de la Operación</div>
  <div class="accounting">
    <div class="acc-row"><span>Capital aportado por inversores:</span><span class="val-blue">${formatCurrency(capitalRecaudado)}</span></div>
    <div class="acc-row"><span>Monto bruto de venta del activo:</span><span>${formatCurrency(montoVenta)}</span></div>
    <div class="acc-row divider"><span>Ganancia neta generada (Plusvalía):</span><span class="val-green">${gananciaNeta >= 0 ? '+' : ''}${formatCurrency(gananciaNeta)}</span></div>
    <div class="acc-row"><span>ROI (Retorno sobre inversión):</span><span class="val-green">${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%</span></div>
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
          <td style="text-align:center;color:#111;">${totalCubos}</td>
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
                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Capital Recaudado', value: formatCurrency(capitalRecaudado), color: 'text-blue-400' },
                            { label: 'Monto de Venta Total', value: formatCurrency(montoVenta), color: 'text-white' },
                            { label: 'Ganancia Neta', value: `${gananciaNeta >= 0 ? '+' : ''}${formatCurrency(gananciaNeta)}`, color: gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400' },
                            { label: 'ROI del Proyecto', value: `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`, color: roi >= 0 ? 'text-emerald-400' : 'text-red-400' },
                        ].map((kpi) => (
                            <div key={kpi.label} className="p-4 bg-slate-800/60 rounded-xl border border-white/5">
                                <p className="text-xs text-gray-400">{kpi.label}</p>
                                <p className={`text-base font-bold font-mono mt-1 ${kpi.color}`}>{kpi.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Resumen contable */}
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-xl">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Resumen Contable</h4>
                        <div className="font-mono text-sm space-y-2 text-gray-300">
                            <div className="flex justify-between"><span>Capital aportado por inversores:</span><span className="text-blue-400">{formatCurrency(capitalRecaudado)}</span></div>
                            <div className="flex justify-between"><span>Monto bruto de venta del activo:</span><span className="text-white">{formatCurrency(montoVenta)}</span></div>
                            <div className="flex justify-between border-t border-white/5 pt-2"><span>Ganancia neta (Plusvalía):</span><span className={`font-bold ${gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{gananciaNeta >= 0 ? '+' : ''}{formatCurrency(gananciaNeta)}</span></div>
                            <div className="flex justify-between"><span>ROI:</span><span className={`font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{roi >= 0 ? '+' : ''}{roi.toFixed(2)}%</span></div>
                            <div className="flex justify-between"><span>Total inversores:</span><span className="text-white">{inversores.length} inversores</span></div>
                        </div>
                    </div>

                    {/* Tabla */}
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
                                                <td className="px-4 py-3 text-center font-mono text-gray-300">{inv.cubos}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold border border-blue-500/10">{(participacion * 100).toFixed(2)}%</span>
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
                                        <td className="px-4 py-3 text-center font-mono font-bold text-white">{totalCubos}</td>
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
