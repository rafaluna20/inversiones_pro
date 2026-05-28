'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Inversor {
    usuarioId: string;
    usuarioNombre: string;
    cubos: number;
    categoria: string;
}

interface ProyectoInversion {
    id: string;
    nombre: string;
    empresa: string;
    precio: number; // meta de recaudacion
    monto?: number; // total de venta si esta liquidado
    estado: boolean; // true = activo, false = liquidado
    inversores: Inversor[];
    fechaFinalizacion?: number;
}

interface ConsolidatedPortfolioReportProps {
    usuario: {
        uid: string;
        nombre: string;
        email?: string;
    };
    proyectos: ProyectoInversion[];
}

function formatCurrency(n: number) {
    return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConsolidatedPortfolioReport({ usuario, proyectos }: ConsolidatedPortfolioReportProps) {
    
    // Cálculos globales
    let capitalTotalInvertido = 0;
    let gananciasNetasHistoricas = 0;
    let retornoTotalEsperado = 0;

    const filasProyectos = proyectos.map((proyecto) => {
        // Encontrar la inversion del usuario en este proyecto
        const miInversion = proyecto.inversores.find(inv => inv.usuarioId === usuario.uid);
        if (!miInversion) return null;

        const totalCubosProyecto = proyecto.inversores.reduce((s, inv) => s + inv.cubos, 0);
        const participacion = totalCubosProyecto > 0 ? (miInversion.cubos / totalCubosProyecto) : 0;
        const capitalInvertido = (miInversion.cubos * proyecto.precio) / 100;
        
        capitalTotalInvertido += capitalInvertido;

        let retornoIndividual = 0;
        let gananciaNeta = 0;

        if (!proyecto.estado && proyecto.monto) {
            // Liquidado
            retornoIndividual = proyecto.monto * participacion;
            gananciaNeta = retornoIndividual - capitalInvertido;
            gananciasNetasHistoricas += gananciaNeta;
        } else {
            // Activo (Estimado: asumimos al menos recuperar el capital para el reporte conservador, 
            // o podríamos dejarlo en 0. Para el reporte contable, la proyección no se suma al capital realizado,
            // pero podemos mostrar el capital trabajando).
            retornoTotalEsperado += capitalInvertido; // Solo consideramos el capital como "esperado a recuperar" mínimo.
        }

        return `
            <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
                    <strong style="color:#111;">${proyecto.nombre}</strong><br/>
                    <span style="color:#6b7280;font-size:11px;">${proyecto.empresa}</span>
                </td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">
                    <span style="background:${proyecto.estado ? '#dbeafe' : '#d1fae5'};color:${proyecto.estado ? '#1e40af' : '#065f46'};padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;text-transform:uppercase;">
                        ${proyecto.estado ? 'En Curso' : 'Liquidado'}
                    </span>
                </td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">
                    <span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">
                        ${(participacion * 100).toFixed(2)}%
                    </span>
                </td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;border-bottom:1px solid #e5e7eb;color:#374151;">
                    ${formatCurrency(capitalInvertido)}
                </td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #e5e7eb;color:${proyecto.estado ? '#9ca3af' : '#111'};">
                    ${proyecto.estado ? 'Pendiente' : formatCurrency(retornoIndividual)}
                </td>
                <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #e5e7eb;color:${proyecto.estado ? '#9ca3af' : (gananciaNeta >= 0 ? '#059669' : '#dc2626')};">
                    ${proyecto.estado ? 'Pendiente' : (gananciaNeta >= 0 ? '+' : '') + formatCurrency(gananciaNeta)}
                </td>
            </tr>
        `;
    }).filter(Boolean).join('');

    const handlePrint = () => {
        const fechaActual = format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
        const codigoDoc = `ST-${new Date().getTime().toString().slice(-6)}-${usuario.uid.slice(0, 4).toUpperCase()}`;

        const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Estado de Cuenta — ${usuario.nombre}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111827; background: #fff; }
    
    .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 24px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; }
    .doc-title { font-size: 16px; font-weight: 700; color: #111; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .user-info { text-align: right; }
    .user-name { font-size: 14px; font-weight: 800; color: #111; }
    .user-meta { font-size: 11px; color: #6b7280; margin-top: 2px; }

    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
    .kpi { border: 1px solid #e5e7eb; border-left: 4px solid #3b82f6; background: #f8fafc; padding: 16px; border-radius: 6px; }
    .kpi.green { border-left-color: #10b981; background: #f0fdf4; }
    .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
    .kpi-value { font-family: monospace; font-size: 18px; font-weight: 800; color: #0f172a; }

    .section-title { font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
    thead th { background: #f1f5f9; padding: 10px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
    thead th:first-child { text-align: left; }
    thead th:not(:first-child) { text-align: right; }
    thead th:nth-child(2), thead th:nth-child(3) { text-align: center; }

    .footer { border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand">InversionesPro</div>
      <div class="doc-title">Estado de Cuenta Consolidado</div>
    </div>
    <div class="user-info">
      <div class="user-name">${usuario.nombre}</div>
      <div class="user-meta">${usuario.email || ''}</div>
      <div class="user-meta">ID: ${usuario.uid.slice(0,8).toUpperCase()}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Capital Total Invertido</div>
      <div class="kpi-value">${formatCurrency(capitalTotalInvertido)}</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Ganancias Netas Históricas</div>
      <div class="kpi-value" style="color:#059669;">+${formatCurrency(gananciasNetasHistoricas)}</div>
    </div>
    <div class="kpi" style="border-left-color:#8b5cf6;">
      <div class="kpi-label">Proyectos en Portafolio</div>
      <div class="kpi-value">${proyectos.length} activos/liquidados</div>
    </div>
  </div>

  <div class="section-title">Detalle de Inversiones</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Proyecto</th>
        <th style="text-align:center;">Estado</th>
        <th style="text-align:center;">Part. (%)</th>
        <th style="text-align:right;">Capital Invertido</th>
        <th style="text-align:right;">Retorno (Bruto)</th>
        <th style="text-align:right;">Ganancia Neta</th>
      </tr>
    </thead>
    <tbody>
      ${filasProyectos}
    </tbody>
  </table>

  <div class="footer">
    <span>Documento generado por InversionesPro — Documento Informativo</span>
    <span>Cód: ${codigoDoc} | Generado: ${fechaActual}</span>
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
        <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold transition shadow-lg shadow-blue-900/20"
        >
            <i className="bx bx-receipt text-xl"></i>
            Descargar Estado de Cuenta (PDF)
        </button>
    );
}
