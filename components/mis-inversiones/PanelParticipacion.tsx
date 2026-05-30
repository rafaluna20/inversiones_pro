'use client';

/**
 * PANEL DE PARTICIPACIÓN POR PROYECTO
 *
 * Muestra al inversor su participación exacta en un proyecto,
 * con el desglose completo de la fórmula 10/90 aplicada.
 *
 * @version 1.0 Enterprise
 */

import { FaPercentage, FaCoins, FaCheckCircle, FaClock } from 'react-icons/fa';
import { formatearSoles } from '@/lib/distribucion';

interface PanelParticipacionProps {
  proyectoNombre: string;
  capitalTotalProyecto: number;
  miInversion: number;
  comisionGestor: number;       // Porcentaje (ej: 10)
  utilidadNeta?: number;        // Solo si el proyecto fue liquidado
  estaLiquidado: boolean;
  miParticipacionReal?: number; // Valor exacto desde Firestore
  miGananciaReal?: number;      // Ganancia real distribuida desde Firestore
}

export default function PanelParticipacion({
  proyectoNombre,
  capitalTotalProyecto,
  miInversion,
  comisionGestor,
  utilidadNeta,
  estaLiquidado,
  miParticipacionReal,
  miGananciaReal,
}: PanelParticipacionProps) {
  // Usa el valor exacto de Firestore si existe, de lo contrario calcula estimado
  const miParticipacion = miParticipacionReal !== undefined && miParticipacionReal > 0
    ? miParticipacionReal
    : capitalTotalProyecto > 0
      ? (miInversion / capitalTotalProyecto) * 100
      : 0;

  // Cálculo de distribución (si el proyecto ya fue liquidado)
  const utilidad = Number(utilidadNeta || 0);
  const feeGestor = utilidad * (comisionGestor / 100);
  const poolSocios = utilidad - feeGestor;
  
  // Usa la ganancia real de Firestore (calculada por Server Action), fallback local
  const miGananciaDistribuida = miGananciaReal !== undefined 
    ? miGananciaReal 
    : poolSocios * (miParticipacion / 100);

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${estaLiquidado ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
          <h3 className="text-white font-semibold text-sm truncate">{proyectoNombre}</h3>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
          estaLiquidado
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-blue-500/10 text-blue-400'
        }`}>
          {estaLiquidado ? <FaCheckCircle className="text-xs" /> : <FaClock className="text-xs" />}
          {estaLiquidado ? 'Liquidado' : 'En Curso'}
        </span>
      </div>

      {/* Cuerpo */}
      <div className="p-5 space-y-4">
        {/* Capital y participación */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/50 rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-1">Mi Inversión</p>
            <p className="text-white font-mono font-bold">{formatearSoles(miInversion)}</p>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-1">Mi Participación</p>
            <p className="text-purple-400 font-mono font-bold flex items-center gap-1">
              <FaPercentage className="text-xs" /> {miParticipacion.toFixed(2)}%
            </p>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-1">Capital Total Proyecto</p>
            <p className="text-gray-300 font-mono text-sm">{formatearSoles(capitalTotalProyecto)}</p>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-1">Comisión Gestor</p>
            <p className="text-amber-400 font-mono font-bold">{comisionGestor}%</p>
          </div>
        </div>

        {/* Desglose de distribución */}
        {estaLiquidado && utilidad > 0 ? (
          <div className="bg-slate-950/40 rounded-xl p-4 border border-emerald-500/10 space-y-2">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">
              Distribución Ejecutada
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Utilidad Neta del Proyecto</span>
              <span className="text-white font-mono font-bold">{formatearSoles(utilidad)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-amber-400">Fee del Gestor ({comisionGestor}%)</span>
              <span className="text-amber-400 font-mono">−{formatearSoles(feeGestor)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-400">Pool para Socios ({100 - comisionGestor}%)</span>
              <span className="text-blue-400 font-mono">{formatearSoles(poolSocios)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Tu Participación ({miParticipacion.toFixed(2)}%)</span>
              <span className="text-gray-400 font-mono">× {(miParticipacion / 100).toFixed(4)}</span>
            </div>
            <div className="border-t border-emerald-500/20 pt-3 flex justify-between items-center">
              <span className="text-emerald-400 font-bold flex items-center gap-2">
                <FaCoins /> Tu Ganancia Neta
              </span>
              <span className="text-emerald-400 font-mono font-black text-lg">
                +{formatearSoles(miGananciaDistribuida)}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/40 rounded-xl p-4 border border-blue-500/10">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">
              Proyección (pendiente de liquidación)
            </p>
            <p className="text-gray-500 text-xs text-center">
              Cuando el gestor ejecute la distribución, verás aquí tu ganancia neta exacta.<br/>
              Recibirás el <span className="text-blue-400 font-bold">{(100 - comisionGestor)}%</span> del pool de socios proporcional a tu {miParticipacion.toFixed(2)}% de participación.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
