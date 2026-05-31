'use client';

import { useState } from 'react';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useGestorProyectos from '@/Hooks/useGestorProyectos';
import useDistribucionesGestor from '@/Hooks/useDistribucionesGestor';
import { ejecutarDistribucionAction } from '@/app/actions/distribucion';
import ComprobantePDF from '@/components/gestor/ComprobantePDF';
import TrackRecordGestorPDF from '@/components/gestor/TrackRecordGestorPDF';
import GestorDashboardPDF from '@/components/gestor/GestorDashboardPDF';
import { formatearSoles } from '@/lib/distribucion';
import { showToast } from '@/lib/toast';
import Link from 'next/link';
import {
  FaChartLine,
  FaBriefcase,
  FaCheckCircle,
  FaLock,
  FaUnlock,
  FaCoins,
  FaPercentage,
  FaFire,
  FaShieldAlt,
} from 'react-icons/fa';

// Modal de Liquidación
function ModalLiquidacion({
  proyecto,
  onClose,
  onSuccess,
}: {
  proyecto: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [utilidadNeta, setUtilidadNeta] = useState('');
  const [loading, setLoading] = useState(false);
  const { usuario } = useAutenticacion();

  const comision = Number(proyecto.comisionGestor || 10);
  const utilidad = Number(utilidadNeta) || 0;
  const feePreview = utilidad * (comision / 100);
  const poolPreview = utilidad - feePreview;

  const handleLiquidar = async () => {
    if (utilidad <= 0) {
      showToast.error('Ingresa la utilidad neta del proyecto');
      return;
    }
    if (!usuario) return;

    setLoading(true);
    const result = await ejecutarDistribucionAction(proyecto.id, utilidad, usuario.uid);
    setLoading(false);

    if (result.ok) {
      showToast.success(`✅ ${result.mensaje}`);
      onSuccess();
    } else {
      showToast.error(result.mensaje);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <FaCoins className="text-amber-400 text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Ejecutar Distribución</h2>
            <p className="text-gray-400 text-sm">{proyecto.nombre}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">
              Utilidad Neta del Proyecto (S/)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={utilidadNeta}
              onChange={(e) => setUtilidadNeta(e.target.value)}
              placeholder="Ej: 80000"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors font-mono text-lg"
            />
          </div>

          {/* Preview distribución */}
          {utilidad > 0 && (
            <div className="bg-slate-950/60 rounded-2xl p-5 border border-white/5 space-y-3">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">
                Vista Previa de Distribución
              </p>
              <div className="flex justify-between">
                <span className="text-gray-400">Utilidad Neta</span>
                <span className="text-white font-mono font-bold">{formatearSoles(utilidad)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400 flex items-center gap-1">
                  <FaPercentage className="text-xs" /> Tu Fee ({comision}%)
                </span>
                <span className="text-amber-400 font-mono font-bold">{formatearSoles(feePreview)}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between">
                <span className="text-emerald-400 font-semibold">Pool para Socios ({100 - comision}%)</span>
                <span className="text-emerald-400 font-mono font-bold text-lg">{formatearSoles(poolPreview)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
          <p className="text-amber-300 text-xs font-medium flex items-start gap-2">
            <FaShieldAlt className="mt-0.5 shrink-0" />
            Esta acción es irreversible. Se generará un registro criptográfico SHA-256 en Firestore y se actualizará la ganancia de cada socio automáticamente.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleLiquidar}
            disabled={loading || utilidad <= 0}
            className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ejecutando...' : '✅ Confirmar Distribución'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl font-medium transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// Fila de proyecto en el dashboard
function FilaProyecto({ proyecto, onLiquidar, distribucion }: { proyecto: any; onLiquidar: (p: any) => void; distribucion?: any }) {
  const comision = Number(proyecto.comisionGestor || 10);
  const capital = Number(proyecto.monto || proyecto.precio || 0);
  const estaLiquidado = proyecto.distribucionEjecutada === true;

  return (
    <div className={`bg-slate-900/50 border ${estaLiquidado ? 'border-emerald-500/20' : 'border-white/10'} rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${estaLiquidado ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
          <h3 className="text-white font-semibold text-sm truncate">{proyecto.nombre}</h3>
        </div>
        <p className="text-gray-500 text-xs">{proyecto.empresa}</p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="text-center">
          <p className="text-gray-500 text-xs mb-1">Capital</p>
          <p className="text-white font-mono font-bold text-sm">{formatearSoles(capital)}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs mb-1">Comisión</p>
          <p className="text-amber-400 font-mono font-bold text-sm">{comision}%</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs mb-1">Estado</p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
            estaLiquidado
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {estaLiquidado ? <FaLock className="text-xs" /> : <FaUnlock className="text-xs" />}
            {estaLiquidado ? 'Liquidado' : 'Activo'}
          </span>
        </div>
      </div>

      {!estaLiquidado && (
        <button
          onClick={() => onLiquidar(proyecto)}
          className="px-4 py-2 bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-sm font-bold transition flex items-center gap-2 whitespace-nowrap"
        >
          <FaCoins /> Liquidar Proyecto
        </button>
      )}
      {estaLiquidado && (
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-bold flex items-center gap-2 border border-emerald-500/20">
            <FaCheckCircle /> Distribuido
          </div>
          {distribucion && (
            <ComprobantePDF distribucion={distribucion} />
          )}
        </div>
      )}
    </div>
  );
}

export default function GestorPage() {
  const { usuario, loading } = useAutenticacion();
  const { proyectos, kpis, loading: loadingProyectos } = useGestorProyectos(usuario?.uid || '');
  const { distribuciones } = useDistribucionesGestor(usuario?.uid || '');
  const [proyectoALiquidar, setProyectoALiquidar] = useState<any | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl max-w-md w-full text-center">
          <FaBriefcase className="text-5xl text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Acceso de Gestor</h2>
          <p className="text-gray-400 mb-6">Inicia sesión para acceder al panel de gestión de proyectos.</p>
          <Link href="/login" className="inline-flex w-full justify-center py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold transition">
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[500px] h-[500px] bg-orange-600/5 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-8">

        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="border-l-4 border-amber-500 pl-6">
            <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab">Panel del Gestor</h1>
            <p className="text-gray-400 text-lg">Administra tus proyectos y ejecuta distribuciones de utilidades</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Reporte Empresarial Completo (NUEVO) */}
            <GestorDashboardPDF 
              proyectos={proyectos} 
              distribuciones={distribuciones} 
              gestorNombre={usuario.displayName || usuario.email || 'Gestor'} 
            />
            
            {/* Reporte Básico (Anterior) */}
            <TrackRecordGestorPDF 
              proyectos={proyectos} 
              distribuciones={distribuciones} 
              gestorNombre={usuario.displayName || usuario.email || 'Gestor'} 
            />
            
            <Link
              href="/productos/nuevo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-bold shadow-lg shadow-amber-900/20 transition"
            >
              <FaFire /> Nuevo Proyecto
            </Link>
          </div>
        </div>

        {/* KPIs del Gestor */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-6">
            <p className="text-amber-400/70 text-xs font-bold uppercase tracking-wider mb-2">AUM Total Gestionado</p>
            <h2 className="text-3xl font-black text-amber-300 font-mono">{formatearSoles(kpis.aumTotal)}</h2>
            <p className="text-gray-500 text-xs mt-2">Assets Under Management</p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Fee Total Ganado</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">{formatearSoles(kpis.feeTotalGanado)}</h3>
            <p className="text-gray-500 text-xs mt-2">Comisiones cobradas</p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Proyectos</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-blue-400">{kpis.proyectosActivos}</span>
              <span className="text-gray-600 text-sm mb-1">activos</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <FaCheckCircle className="text-emerald-400 text-xs" />
              <span className="text-gray-500 text-xs">{kpis.proyectosLiquidados} liquidados</span>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">ROI Histórico</p>
            <h3 className="text-2xl font-black text-purple-400 font-mono">{kpis.roiHistoricoPromedio.toFixed(1)}%</h3>
            <p className="text-gray-500 text-xs mt-2">Promedio proyectos completados</p>
          </div>
        </div>

        {/* Lista de Proyectos */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FaChartLine className="text-amber-400" /> Mis Proyectos
          </h2>

          {loadingProyectos ? (
            <div className="py-20 flex justify-center">
              <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : proyectos.length === 0 ? (
            <div className="py-20 text-center bg-slate-900/30 rounded-3xl border border-white/5">
              <FaBriefcase className="text-5xl text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Sin proyectos aún</h3>
              <p className="text-gray-500 mb-6">Crea tu primer proyecto para comenzar a gestionar inversiones</p>
              <Link href="/productos/nuevo" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold transition">
                <FaFire /> Crear Primer Proyecto
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {proyectos.map((p) => {
                const dist = distribuciones.find((d) => d.proyectoId === p.id);
                return (
                  <FilaProyecto key={p.id} proyecto={p} onLiquidar={setProyectoALiquidar} distribucion={dist} />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Liquidación */}
      {proyectoALiquidar && (
        <ModalLiquidacion
          proyecto={proyectoALiquidar}
          onClose={() => setProyectoALiquidar(null)}
          onSuccess={() => {
            setProyectoALiquidar(null);
          }}
        />
      )}
    </div>
  );
}
