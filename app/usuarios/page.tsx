'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import { 
  FaHeart, FaChartLine, FaUserTie, FaMapMarkerAlt, 
  FaSearch, FaThLarge, FaList, FaCheckCircle, FaSpinner 
} from 'react-icons/fa';

export default function UsuariosPage() {
  const [allUsuarios, setAllUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para Filtros y Vistas
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Paginación local
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const usuariosRef = collection(db, 'usuarios');
        const q = query(usuariosRef, orderBy('like', 'desc'));
        const querySnapshot = await getDocs(q);

        const usuariosData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setAllUsuarios(usuariosData);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  // Filtrado
  const filteredUsuarios = useMemo(() => {
    return allUsuarios.filter(user => {
      const matchSearch = (user.nombre || 'Inversor Anónimo').toLowerCase().includes(searchTerm.toLowerCase());
      const matchLocation = locationFilter === '' || (user.departamento && user.departamento.toLowerCase() === locationFilter.toLowerCase());
      return matchSearch && matchLocation;
    });
  }, [allUsuarios, searchTerm, locationFilter]);

  const visibleUsuarios = filteredUsuarios.slice(0, visibleCount);
  const hasMore = visibleCount < filteredUsuarios.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  };

  // Extraer ubicaciones únicas para el filtro
  const uniqueLocations = useMemo(() => {
    const locs = allUsuarios.map(u => u.departamento).filter(Boolean);
    return Array.from(new Set(locs)).sort();
  }, [allUsuarios]);

  // KPIs
  const totalInversores = allUsuarios.length;
  const inversoresVerificados = allUsuarios.filter(u => u.verificado).length;
  const topInversor = allUsuarios[0]; // Como están ordenados por like desc

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-blue-400 font-medium animate-pulse">Cargando directorio empresarial...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* --- HEADER & KPIs --- */}
        <div className="mb-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="border-l-4 border-blue-500 pl-6">
            <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab">Directorio de Inversores</h1>
            <p className="text-slate-400 text-lg">Comunidad exclusiva de líderes en el sector inmobiliario</p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-[160px]">
              <p className="text-slate-400 text-sm mb-1">Total Miembros</p>
              <p className="text-3xl font-bold text-white">{totalInversores}</p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-md border border-blue-500/20 rounded-2xl p-4 min-w-[160px]">
              <p className="text-blue-400 text-sm mb-1 flex items-center gap-1">
                <FaCheckCircle /> Verificados
              </p>
              <p className="text-3xl font-bold text-white">{inversoresVerificados}</p>
            </div>
            {topInversor && (
              <div className="bg-slate-900/50 backdrop-blur-md border border-purple-500/20 rounded-2xl p-4 min-w-[180px] hidden md:block">
                <p className="text-purple-400 text-sm mb-1 flex items-center gap-1">
                  <FaHeart /> Más Valorados
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <img src={topInversor.photoURL || '/static/img/imagenPerfil.png'} className="w-8 h-8 rounded-full border border-purple-500/50 object-cover" alt="Top" />
                  <span className="text-white font-medium text-sm truncate max-w-[100px]">{topInversor.nombre || 'Anónimo'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- TOOLBAR (Buscador, Filtros y Toggle) --- */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* Buscador */}
            <div className="relative w-full sm:w-72">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(PAGE_SIZE); }}
                className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            
            {/* Filtro Ubicación */}
            <select
              value={locationFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              className="w-full sm:w-auto bg-slate-800/50 border border-slate-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-all appearance-none"
            >
              <option value="">Todas las ubicaciones</option>
              {uniqueLocations.map(loc => (
                <option key={loc as string} value={loc as string}>{loc as string}</option>
              ))}
            </select>
          </div>

          {/* Toggle View */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-1 w-full sm:w-auto justify-center">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <FaThLarge /> <span className="hidden sm:inline">Tarjetas</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <FaList /> <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>

        {/* --- CONTENIDO --- */}
        {filteredUsuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-3xl text-center p-8">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-white/5">
              <FaSearch className="text-4xl text-slate-600" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 font-roboto-slab">No hay resultados</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              No encontramos inversores que coincidan con tu búsqueda. Intenta con otros filtros.
            </p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visibleUsuarios.map((usuario) => (
                  <Link
                    key={usuario.id}
                    href={`/usuarios/${usuario.id}`}
                    className="group relative bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 hover:bg-slate-800/80 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-blue-500/10 flex flex-col"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    <div className="text-center relative z-10 flex-1">
                      <div className="relative inline-block mb-4">
                        <img
                          src={usuario.photoURL || '/static/img/imagenPerfil.png'}
                          alt={usuario.nombre || 'Usuario'}
                          className="w-24 h-24 rounded-full object-cover border-4 border-slate-800 group-hover:border-blue-500/50 transition-colors shadow-xl"
                        />
                        {usuario.verificado && (
                          <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1.5 rounded-full border-2 border-slate-900 shadow-sm" title="Inversor Verificado">
                            <FaCheckCircle className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">
                        {usuario.nombre || 'Inversor Anónimo'}
                      </h3>

                      <div className="flex items-center justify-center gap-1.5 text-sm text-slate-400 mb-6">
                        <FaMapMarkerAlt className="text-xs text-slate-500" />
                        <span className="truncate max-w-[150px]">{usuario.departamento || 'No especificada'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-auto">
                      <div className="flex flex-col items-center gap-1 w-1/2">
                        <div className="flex items-center gap-1.5 text-red-400 font-bold text-lg">
                          <FaHeart className="text-sm" />
                          <span>{usuario.like || 0}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Reputación</span>
                      </div>

                      <div className="w-px h-8 bg-white/10"></div>

                      <div className="flex flex-col items-center gap-1 w-1/2">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-lg">
                          <FaChartLine className="text-sm" />
                          <span>{usuario.inversionesCompletadas || 0}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Inversiones</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
                        <th className="px-6 py-4 font-semibold">Inversor</th>
                        <th className="px-6 py-4 font-semibold">Ubicación</th>
                        <th className="px-6 py-4 font-semibold text-center">Reputación</th>
                        <th className="px-6 py-4 font-semibold text-center">Inversiones</th>
                        <th className="px-6 py-4 font-semibold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visibleUsuarios.map((usuario) => (
                        <tr key={usuario.id} className="hover:bg-slate-800/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <img
                                  src={usuario.photoURL || '/static/img/imagenPerfil.png'}
                                  alt={usuario.nombre}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                                />
                                {usuario.verificado && (
                                  <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border border-slate-900">
                                    <FaCheckCircle className="w-2.5 h-2.5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-white font-medium group-hover:text-blue-400 transition-colors truncate">
                                  {usuario.nombre || 'Inversor Anónimo'}
                                </p>
                                <p className="text-slate-500 text-xs truncate">{usuario.email || 'Usuario verificado'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-300 truncate">
                              <FaMapMarkerAlt className="text-slate-500 shrink-0" />
                              <span className="truncate">{usuario.departamento || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center min-w-[3rem] gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 font-semibold text-sm border border-red-500/20">
                              <FaHeart /> {usuario.like || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center min-w-[3rem] gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold text-sm border border-emerald-500/20">
                              <FaChartLine /> {usuario.inversionesCompletadas || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/usuarios/${usuario.id}`}
                              className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors border border-white/5 hover:border-blue-500 whitespace-nowrap"
                            >
                              Ver Perfil
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BOTÓN CARGAR MÁS */}
            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  className="group relative px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl border border-white/10 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 overflow-hidden active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <FaSpinner className="text-slate-400 group-hover:text-white group-hover:animate-spin transition-all" />
                  <span className="relative z-10">Cargar más miembros</span>
                </button>
              </div>
            )}
            
            {/* Indicador de fin de lista */}
            {!hasMore && filteredUsuarios.length > 0 && (
              <div className="mt-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2 before:h-px before:flex-1 before:bg-slate-800 after:h-px after:flex-1 after:bg-slate-800">
                <span className="px-4 bg-slate-900/50 rounded-full py-1 border border-slate-800/50">Has visto a todos los inversores</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
