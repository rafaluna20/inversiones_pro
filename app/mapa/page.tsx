'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  FaMapMarkerAlt,
  FaFilter,
  FaSearch,
  FaBuilding,
  FaLock,
  FaUnlock,
  FaTimes,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import { MdApartment, MdHouse, MdBusiness, MdLandscape, MdLocationCity } from 'react-icons/md';

// ─── Tipos ───────────────────────────────────────────────────────────────────
type CategoriaProducto =
  | 'departamento' | 'terreno' | 'casa'
  | 'oficina' | 'localComercial' | 'habilitacionUrbana';

type FiltroEstado = 'todos' | 'activo' | 'liquidado';

interface ProyectoMapa {
  id: string;
  nombre: string;
  empresa: string;
  categoria: CategoriaProducto;
  estado: boolean;
  distribucionEjecutada?: boolean;
  coordenadas?: { lat: number; lng: number };
  cordenadas?: { lat: number; lng: number };
  precio?: number;
  monto?: number;
  roiReal?: number;
  gananciaNeta?: number;
  urlimagen?: string | string[];
  direccion?: string;
  inversores?: string[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORIAS_CONFIG: Record<CategoriaProducto, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  departamento:      { label: 'Departamento',   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    icon: <MdApartment /> },
  terreno:           { label: 'Terreno',         color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',  icon: <MdLandscape /> },
  casa:              { label: 'Casa',            color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <MdHouse /> },
  oficina:           { label: 'Oficina',         color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20', icon: <MdBusiness /> },
  localComercial:    { label: 'Local Comercial', color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20', icon: <MdBusiness /> },
  habilitacionUrbana:{ label: 'Hab. Urbana',    color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20',    icon: <MdLocationCity /> },
};

const formatSoles = (v: number) =>
  `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getCoordenadas(p: ProyectoMapa) {
  return p.coordenadas || p.cordenadas;
}
function getImagen(p: ProyectoMapa): string {
  const img = p.urlimagen;
  if (!img) return '';
  return Array.isArray(img) ? img[0] : img;
}

// ─── Mapa dinámico (evita errores SSR) ────────────────────────────────────────
// Se importa el mapa como componente separado para evitar problemas con refs y dynamic
const MapaInteractivo = dynamic(() => import('@/components/mapa/MapaInteractivo'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Cargando mapa...</p>
      </div>
    </div>
  ),
});

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function MapaPage() {
  const [proyectos, setProyectos] = useState<ProyectoMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ProyectoMapa | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaProducto | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  useEffect(() => {
    const fetchProyectos = async () => {
      try {
        const snap = await getDocs(collection(db, 'productos'));
        const data = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as ProyectoMapa))
          .filter((p) => getCoordenadas(p));
        setProyectos(data);
      } catch (err) {
        console.error('Error al cargar proyectos del mapa:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProyectos();
  }, []);

  const proyectosFiltrados = useMemo(() => {
    return proyectos.filter((p) => {
      const matchBusqueda =
        p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.empresa?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.direccion?.toLowerCase().includes(busqueda.toLowerCase());
      const matchCategoria = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
      const estaLiquidado = p.estado === false || p.distribucionEjecutada === true;
      const matchEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activo' && !estaLiquidado) ||
        (filtroEstado === 'liquidado' && estaLiquidado);
      return matchBusqueda && matchCategoria && matchEstado;
    });
  }, [proyectos, busqueda, filtroCategoria, filtroEstado]);

  const categoriasDisponibles = useMemo(
    () => [...new Set(proyectos.map((p) => p.categoria).filter(Boolean))],
    [proyectos]
  );

  const stats = useMemo(() => ({
    total: proyectosFiltrados.length,
    activos: proyectosFiltrados.filter((p) => p.estado !== false && !p.distribucionEjecutada).length,
    liquidados: proyectosFiltrados.filter((p) => p.estado === false || p.distribucionEjecutada).length,
  }), [proyectosFiltrados]);

  const handleSeleccionar = useCallback((p: ProyectoMapa) => {
    setSeleccionado(p);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#020617' }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FaMapMarkerAlt className="text-emerald-400" />
              Mapa de Proyectos
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">
              {loading ? 'Cargando...' : `${stats.total} proyectos`}
              {!loading && <span className="ml-2 text-emerald-400 font-medium">{stats.activos} activos</span>}
              {!loading && stats.liquidados > 0 && <span className="ml-2 text-amber-400 font-medium">{stats.liquidados} liquidados</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar proyecto..."
                className="bg-slate-800 border border-white/10 text-white rounded-xl pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-500 w-52"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                mostrarFiltros || filtroCategoria !== 'todas' || filtroEstado !== 'todos'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-white/10 text-gray-300 hover:text-white'
              }`}
            >
              <FaFilter className="text-xs" />
              Filtros
              {(filtroCategoria !== 'todas' || filtroEstado !== 'todos') && (
                <span className="w-4 h-4 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {[filtroCategoria !== 'todas', filtroEstado !== 'todos'].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filtros expandibles */}
        {mostrarFiltros && (
          <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2 items-center">
            <span className="text-gray-500 text-xs font-medium uppercase">Estado:</span>
            {(['todos', 'activo', 'liquidado'] as FiltroEstado[]).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  filtroEstado === e
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {e === 'todos' ? 'Todos' : e === 'activo' ? '🟢 Activos' : '🔒 Liquidados'}
              </button>
            ))}
            <span className="text-gray-500 text-xs font-medium uppercase ml-2">Tipo:</span>
            <button
              onClick={() => setFiltroCategoria('todas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                filtroCategoria === 'todas'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              Todas
            </button>
            {categoriasDisponibles.map((cat) => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  filtroCategoria === cat
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {CATEGORIAS_CONFIG[cat]?.label || cat}
              </button>
            ))}
            {(filtroCategoria !== 'todas' || filtroEstado !== 'todos') && (
              <button
                onClick={() => { setFiltroCategoria('todas'); setFiltroEstado('todos'); }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all ml-1"
              >
                <FaTimes className="inline mr-1 text-xs" />
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Cuerpo: panel lateral + mapa ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Panel lateral */}
        <div style={{ width: 300, flexShrink: 0, background: 'rgba(15,23,42,0.7)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">
              {proyectosFiltrados.length} resultado{proyectosFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <div className="w-7 h-7 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Cargando...</p>
              </div>
            ) : proyectosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
                <FaMapMarkerAlt className="text-3xl text-gray-600" />
                <p className="text-gray-400 text-sm font-medium">Sin resultados</p>
                <p className="text-gray-600 text-xs">Ajusta los filtros</p>
              </div>
            ) : (
              proyectosFiltrados.map((p) => {
                const estaLiquidado = p.estado === false || p.distribucionEjecutada === true;
                const cfg = CATEGORIAS_CONFIG[p.categoria] || CATEGORIAS_CONFIG.terreno;
                
                // Cálculos financieros en tiempo real
                const capital = typeof p.precio === 'number' ? p.precio : 0;
                const montoVenta = p.monto || capital;
                const totalGastos = (p as any).totalGastos || 0;
                const costoTotal = (p as any).costoTotalProyecto || (capital + totalGastos);
                
                let roiRealMostrar = p.roiReal;
                if (estaLiquidado) {
                  const gananciaNeta = montoVenta - costoTotal;
                  roiRealMostrar = costoTotal > 0 ? (gananciaNeta / costoTotal) * 100 : 0;
                } else if (!estaLiquidado && totalGastos > 0) {
                  roiRealMostrar = undefined;
                }

                const imagen = getImagen(p);
                const isSelected = seleccionado?.id === p.id;

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSeleccionar(p)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      borderLeft: isSelected ? '2px solid #10b981' : '2px solid transparent',
                      background: isSelected ? 'rgba(16,185,129,0.05)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-700 flex items-center justify-center">
                        {imagen
                          ? <img src={imagen} alt={p.nombre} className="w-full h-full object-cover" />
                          : <span className="text-gray-500 text-lg">{cfg.icon}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-xs font-semibold ${estaLiquidado ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {estaLiquidado ? <FaLock className="inline text-xs" /> : <FaUnlock className="inline text-xs" />}
                            {' '}{estaLiquidado ? 'Liquidado' : 'Activo'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-white text-sm font-semibold leading-tight truncate">{p.nombre}</p>
                        <p className="text-gray-500 text-xs truncate">{p.empresa}</p>
                        {capital > 0 && (
                          <p className="text-emerald-400 text-xs font-mono font-semibold mt-0.5">{formatSoles(capital)}</p>
                        )}
                        {roiRealMostrar !== undefined && roiRealMostrar !== null && (
                          <p className="text-blue-400 text-xs">ROI: {roiRealMostrar > 0 ? '+' : ''}{roiRealMostrar.toFixed(2)}%</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Mapa */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <MapaInteractivo
            proyectos={proyectosFiltrados}
            seleccionado={seleccionado}
            onSeleccionar={handleSeleccionar}
          />

          {/* Contador flotante */}
          <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 shadow-xl z-[1000]">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <FaBuilding className="text-emerald-400" />
                <span className="text-white font-bold">{proyectosFiltrados.length}</span>
                <span className="text-gray-400">proyectos</span>
              </div>
              {stats.activos > 0 && (
                <>
                  <div className="w-px h-3 bg-white/10" />
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-emerald-400 font-medium">{stats.activos} activos</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Leyenda */}
          <div className="absolute bottom-6 right-4 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-xl z-[1000] hidden md:block">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Leyenda</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                <span className="text-xs text-gray-300">Proyecto Activo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                <span className="text-xs text-gray-300">Proyecto Liquidado</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">Clic en pin para ver detalles</p>
          </div>
        </div>
      </div>
    </div>
  );
}
