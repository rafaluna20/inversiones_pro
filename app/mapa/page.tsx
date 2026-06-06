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
  FaChartLine,
  FaUsers,
  FaLock,
  FaUnlock,
  FaTimes,
  FaExternalLinkAlt,
  FaCoins,
} from 'react-icons/fa';
import { MdApartment, MdHouse, MdBusiness, MdLandscape, MdLocationCity } from 'react-icons/md';

// ─── Dynamic imports para evitar SSR con Leaflet ───────────────────────────
const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((m) => m.Popup),
  { ssr: false }
);
const useMap = dynamic(
  () => import('react-leaflet').then((m) => m.useMap),
  { ssr: false }
) as any;

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
  totalGastos?: number;
}

// ─── Configuración de Categorías ─────────────────────────────────────────────
const CATEGORIAS_CONFIG: Record<CategoriaProducto, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  departamento: { label: 'Departamento', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: <MdApartment /> },
  terreno:      { label: 'Terreno',      color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: <MdLandscape /> },
  casa:         { label: 'Casa',         color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <MdHouse /> },
  oficina:      { label: 'Oficina',      color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: <MdBusiness /> },
  localComercial:    { label: 'Local Comercial',    color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: <MdBusiness /> },
  habilitacionUrbana:{ label: 'Hab. Urbana', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', icon: <MdLocationCity /> },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── Componente: MapCenterFly ─────────────────────────────────────────────────
function MapCenterFly({ coords }: { coords: { lat: number; lng: number } | null }) {
  // Importamos useMap client-side
  const [mapRef, setMapRef] = useState<any>(null);

  useEffect(() => {
    import('react-leaflet').then(({ useMap: _useMap }) => {
      // solo se usa para tipo, el flyTo se controla desde el componente padre
    });
  }, []);

  return null;
}

// ─── Componente: MapaCentrador ─────────────────────────────────────────────────
function MapEventHandler({
  target,
}: {
  target: { lat: number; lng: number } | null;
}) {
  // useMap solo funciona dentro de MapContainer
  const [, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return null;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function MapaPage() {
  const [proyectos, setProyectos] = useState<ProyectoMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ProyectoMapa | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaProducto | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Fix Leaflet icons on mount
  useEffect(() => {
    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    });
    setMounted(true);
  }, []);

  // Load projects from Firestore
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

  // Filtered projects
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

  // Center: Lima, Perú por defecto
  const centerDefault: [number, number] = [-12.0464, -77.0428];

  const handleSeleccionar = useCallback((p: ProyectoMapa) => {
    setSeleccionado(p);
    const coords = getCoordenadas(p);
    if (coords && mapInstance) {
      mapInstance.flyTo([coords.lat, coords.lng], 16, { duration: 1 });
    }
  }, [mapInstance]);

  const categoriasDisponibles = useMemo(
    () => [...new Set(proyectos.map((p) => p.categoria).filter(Boolean))],
    [proyectos]
  );

  const stats = useMemo(() => ({
    total: proyectosFiltrados.length,
    activos: proyectosFiltrados.filter((p) => p.estado !== false && !p.distribucionEjecutada).length,
    liquidados: proyectosFiltrados.filter((p) => p.estado === false || p.distribucionEjecutada).length,
  }), [proyectosFiltrados]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 px-6 py-4 z-10">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FaMapMarkerAlt className="text-emerald-400" />
              Mapa de Proyectos
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {loading ? 'Cargando...' : `${stats.total} proyectos con ubicación`}
              {!loading && <span className="ml-3 text-emerald-400 font-medium">{stats.activos} activos</span>}
              {!loading && stats.liquidados > 0 && <span className="ml-2 text-amber-400 font-medium">{stats.liquidados} liquidados</span>}
            </p>
          </div>

          {/* Barra de búsqueda */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar proyecto, empresa..."
                className="w-full bg-slate-800 border border-white/10 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-500"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
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

        {/* Panel de filtros expandible */}
        {mostrarFiltros && (
          <div className="max-w-screen-2xl mx-auto mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-3">
            {/* Filtro por Estado */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Estado:</span>
              {(['todos', 'activo', 'liquidado'] as FiltroEstado[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltroEstado(e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filtroEstado === e
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {e === 'todos' ? 'Todos' : e === 'activo' ? '🟢 Activos' : '🔒 Liquidados'}
                </button>
              ))}
            </div>

            {/* Filtro por Categoría */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Tipo:</span>
              <button
                onClick={() => setFiltroCategoria('todas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filtroCategoria === 'todas'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                Todas
              </button>
              {categoriasDisponibles.map((cat) => {
                const cfg = CATEGORIAS_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setFiltroCategoria(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      filtroCategoria === cat
                        ? `bg-emerald-500/20 border-emerald-500/40 text-emerald-300`
                        : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {cfg?.label || cat}
                  </button>
                );
              })}
            </div>

            {/* Limpiar filtros */}
            {(filtroCategoria !== 'todas' || filtroEstado !== 'todos') && (
              <button
                onClick={() => { setFiltroCategoria('todas'); setFiltroEstado('todos'); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all"
              >
                <FaTimes className="inline mr-1" />
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body: mapa + panel */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: 'calc(100vh - 85px)' }}>

        {/* ── Panel lateral ── */}
        <div className="lg:w-80 xl:w-96 bg-slate-900/60 border-r border-white/5 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              {proyectosFiltrados.length} resultado{proyectosFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Cargando proyectos...</p>
              </div>
            ) : proyectosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
                <FaMapMarkerAlt className="text-4xl text-gray-600" />
                <p className="text-gray-400 font-medium">Sin resultados</p>
                <p className="text-gray-500 text-sm">Ajusta los filtros para ver más proyectos</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {proyectosFiltrados.map((p) => {
                  const coords = getCoordenadas(p);
                  const estaLiquidado = p.estado === false || p.distribucionEjecutada === true;
                  const cfg = CATEGORIAS_CONFIG[p.categoria] || CATEGORIAS_CONFIG.terreno;
                  const capital = p.monto || (typeof p.precio === 'number' ? p.precio : 0);
                  const imagen = getImagen(p);
                  const isSelected = seleccionado?.id === p.id;

                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSeleccionar(p)}
                      className={`w-full text-left px-4 py-4 transition-all hover:bg-slate-800/50 ${
                        isSelected ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : 'border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Imagen miniatura */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-700">
                          {imagen ? (
                            <img src={imagen} alt={p.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl">
                              {cfg.icon}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${estaLiquidado ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {estaLiquidado ? <FaLock className="inline text-xs" /> : <FaUnlock className="inline text-xs" />}
                              {' '}{estaLiquidado ? 'Liquidado' : 'Activo'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-white text-sm font-semibold leading-tight truncate">{p.nombre}</p>
                          <p className="text-gray-500 text-xs mt-0.5 truncate">{p.empresa}</p>
                          {capital > 0 && (
                            <p className="text-emerald-400 text-xs font-mono mt-1 font-medium">
                              {formatSoles(capital)}
                            </p>
                          )}
                          {p.roiReal !== undefined && p.roiReal !== null && (
                            <p className="text-blue-400 text-xs mt-0.5">
                              ROI: {p.roiReal > 0 ? '+' : ''}{p.roiReal.toFixed(2)}%
                            </p>
                          )}
                        </div>

                        {isSelected && (
                          <div className="shrink-0">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Mapa ── */}
        <div className="flex-1 relative">
          {!mounted ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Cargando mapa...</p>
              </div>
            </div>
          ) : (
            <>
              <style>{`
                .leaflet-popup-content-wrapper {
                  background: rgb(15 23 42) !important;
                  border: 1px solid rgba(255,255,255,0.1) !important;
                  border-radius: 16px !important;
                  box-shadow: 0 25px 50px rgba(0,0,0,0.8) !important;
                  color: white !important;
                  padding: 0 !important;
                }
                .leaflet-popup-content {
                  margin: 0 !important;
                  width: auto !important;
                }
                .leaflet-popup-tip-container { display: none !important; }
                .leaflet-popup-close-button {
                  color: rgb(148 163 184) !important;
                  top: 12px !important;
                  right: 12px !important;
                  font-size: 18px !important;
                }
                .leaflet-popup-close-button:hover { color: white !important; }
                .leaflet-container { background: rgb(15 23 42) !important; }
                .leaflet-tile { filter: brightness(0.85) saturate(0.7) !important; }
              `}</style>

              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <MapContainer
                center={centerDefault}
                zoom={6}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                ref={(map: any) => { if (map && !mapInstance) setMapInstance(map); }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {proyectosFiltrados.map((p) => {
                  const coords = getCoordenadas(p);
                  if (!coords) return null;

                  const estaLiquidado = p.estado === false || p.distribucionEjecutada === true;
                  const cfg = CATEGORIAS_CONFIG[p.categoria] || CATEGORIAS_CONFIG.terreno;
                  const capital = p.monto || (typeof p.precio === 'number' ? p.precio : 0);
                  const imagen = getImagen(p);

                  return (
                    <Marker
                      key={p.id}
                      position={[coords.lat, coords.lng]}
                      eventHandlers={{
                        click: () => handleSeleccionar(p),
                      }}
                    >
                      <Popup minWidth={280} maxWidth={320}>
                        <div className="p-0 overflow-hidden rounded-2xl">
                          {/* Imagen del proyecto */}
                          {imagen && (
                            <div className="w-full h-36 overflow-hidden">
                              <img src={imagen} alt={p.nombre} className="w-full h-full object-cover" />
                            </div>
                          )}

                          <div className="p-4">
                            {/* Badges */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                                estaLiquidado
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {estaLiquidado ? '🔒 Liquidado' : '🟢 Activo'}
                              </span>
                            </div>

                            {/* Nombre */}
                            <h3 className="text-white font-bold text-base leading-tight mb-1">{p.nombre}</h3>
                            <p className="text-slate-400 text-xs mb-3">{p.empresa}</p>

                            {/* Métricas */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {capital > 0 && (
                                <div className="bg-slate-800/80 rounded-xl p-2.5">
                                  <p className="text-slate-500 text-xs mb-0.5">Capital</p>
                                  <p className="text-emerald-400 font-mono font-bold text-sm">{formatSoles(capital)}</p>
                                </div>
                              )}
                              {p.roiReal !== undefined && p.roiReal !== null && (
                                <div className="bg-slate-800/80 rounded-xl p-2.5">
                                  <p className="text-slate-500 text-xs mb-0.5">ROI Real</p>
                                  <p className={`font-mono font-bold text-sm ${p.roiReal >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {p.roiReal > 0 ? '+' : ''}{p.roiReal.toFixed(2)}%
                                  </p>
                                </div>
                              )}
                              {p.gananciaNeta !== undefined && p.gananciaNeta !== null && (
                                <div className="bg-slate-800/80 rounded-xl p-2.5">
                                  <p className="text-slate-500 text-xs mb-0.5">Gan. Neta</p>
                                  <p className={`font-mono font-bold text-xs ${p.gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {p.gananciaNeta >= 0 ? '+' : ''}{formatSoles(p.gananciaNeta)}
                                  </p>
                                </div>
                              )}
                              {p.inversores && p.inversores.length > 0 && (
                                <div className="bg-slate-800/80 rounded-xl p-2.5">
                                  <p className="text-slate-500 text-xs mb-0.5">Socios</p>
                                  <p className="text-white font-bold text-sm">{p.inversores.length}</p>
                                </div>
                              )}
                            </div>

                            {/* Dirección */}
                            {p.direccion && (
                              <p className="text-slate-500 text-xs mb-3 flex items-start gap-1">
                                <FaMapMarkerAlt className="text-emerald-400 mt-0.5 shrink-0" />
                                {p.direccion}
                              </p>
                            )}

                            {/* Botón Ver proyecto */}
                            <Link
                              href={`/productos/${p.id}`}
                              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95"
                            >
                              <FaExternalLinkAlt className="text-xs" />
                              Ver Proyecto
                            </Link>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* Overlay: Sin ubicación seleccionada */}
              {proyectosFiltrados.length === 0 && !loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-8 text-center max-w-xs">
                    <FaMapMarkerAlt className="text-5xl text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-300 font-semibold mb-1">Sin proyectos visibles</p>
                    <p className="text-gray-500 text-sm">Ajusta los filtros para ver proyectos en el mapa</p>
                  </div>
                </div>
              )}

              {/* Leyenda flotante */}
              <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl z-[1000] hidden md:block">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">Leyenda</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                    <span className="text-xs text-gray-300">Proyecto Activo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full" />
                    <span className="text-xs text-gray-300">Proyecto Liquidado</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-xs text-gray-500">Haz clic en un pin para ver detalles</p>
                </div>
              </div>

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
