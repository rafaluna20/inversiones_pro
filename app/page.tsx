'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import useProductos from '@/Hooks/useProductos';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useStats from '@/Hooks/useStats';
import ProductCard from '@/components/productos/ProductCard';
import FeaturedCarousel from '@/components/ui/FeaturedCarousel';
import QuickFilters from '@/components/ui/QuickFilters';
import Testimonials from '@/components/ui/Testimonials';
import CountUp from 'react-countup';
import { CategoriaProducto } from '@/types';
import { FaFilter, FaTh, FaList, FaArrowUp, FaArrowDown } from 'react-icons/fa';

type SortOption = 'recientes' | 'populares' | 'mayor-inversion' | 'menor-inversion' | 'casi-completos';
type ViewMode = 'grid' | 'list';

export default function HomePage() {
    const {
        productos,
        loading: loadingProductos,
        cargarMas,
        hasMore,
        cargandoMas
    } = useProductos('creado');

    const { usuario, loading: loadingAuth } = useAutenticacion();
    const { stats, loading: loadingStats } = useStats();

    const [activeFilter, setActiveFilter] = useState<CategoriaProducto | 'todos'>('todos');
    const [sortBy, setSortBy] = useState<SortOption>('recientes');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [showFAB, setShowFAB] = useState(false);

    // Scroll listeners
    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 400);
            setShowFAB(window.scrollY > 800 && hasMore);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasMore]);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Filtrar productos por categoría
    const productosFiltrados = useMemo(() => {
        const filtrados = productos.filter(
            (item) => item.categoria !== 'habilitacionUrbana'
        );

        if (activeFilter === 'todos') {
            return filtrados;
        }

        return filtrados.filter(item => item.categoria === activeFilter);
    }, [productos, activeFilter]);

    // Ordenar productos según opción seleccionada
    const productosOrdenados = useMemo(() => {
        const ordenados = [...productosFiltrados];

        switch (sortBy) {
            case 'populares':
                return ordenados.sort((a, b) => {
                    const votosA = Array.isArray(a.votos) ? a.votos.length : 0;
                    const votosB = Array.isArray(b.votos) ? b.votos.length : 0;
                    return votosB - votosA;
                });
            case 'mayor-inversion':
                return ordenados.sort((a, b) => {
                    const precioA = typeof a.precio === 'string' ? parseFloat(a.precio) : a.precio;
                    const precioB = typeof b.precio === 'string' ? parseFloat(b.precio) : b.precio;
                    return (precioB || 0) - (precioA || 0);
                });
            case 'menor-inversion':
                return ordenados.sort((a, b) => {
                    const precioA = typeof a.precio === 'string' ? parseFloat(a.precio) : a.precio;
                    const precioB = typeof b.precio === 'string' ? parseFloat(b.precio) : b.precio;
                    return (precioA || 0) - (precioB || 0);
                });
            case 'casi-completos':
                // Simulado basado en votos (en producción sería progreso real)
                return ordenados.sort((a, b) => {
                    const votosA = Array.isArray(a.votos) ? a.votos.length : 0;
                    const votosB = Array.isArray(b.votos) ? b.votos.length : 0;
                    return votosB - votosA;
                });
            case 'recientes':
            default:
                return ordenados.sort((a, b) => {
                    const fechaA = typeof a.creado === 'number' ? a.creado : a.creado?.toDate?.().getTime() || 0;
                    const fechaB = typeof b.creado === 'number' ? b.creado : b.creado?.toDate?.().getTime() || 0;
                    return fechaB - fechaA;
                });
        }
    }, [productosFiltrados, sortBy]);

    // Obtener proyectos destacados (más votados y recientes)
    const proyectosDestacados = useMemo(() => {
        const destacados = [...productosFiltrados]
            .filter(p => {
                const votos = Array.isArray(p.votos) ? p.votos.length : 0;
                return votos >= 5;
            })
            .sort((a, b) => {
                const votosA = Array.isArray(a.votos) ? a.votos.length : 0;
                const votosB = Array.isArray(b.votos) ? b.votos.length : 0;
                return votosB - votosA;
            })
            .slice(0, 6);

        return destacados.length > 0 ? destacados : productosFiltrados.slice(0, 6);
    }, [productosFiltrados]);

    const loading = loadingProductos || loadingAuth;

    const handleFilterChange = (categoria: CategoriaProducto | 'todos') => {
        setActiveFilter(categoria);
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Stats Section */}
            <div className="-mx-4 lg:-mx-8 relative z-20">
                <section className="py-12 bg-slate-900/50 backdrop-blur-sm border-y border-white/5" aria-labelledby="stats-titulo">
                    <h2 id="stats-titulo" className="sr-only">Estadísticas de la plataforma</h2>
                    <div className="max-w-7xl mx-auto px-4">
                        <div
                            className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
                            role="list"
                        >
                            <div
                                className="p-8 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl border border-blue-500/20 hover:scale-105 hover:-translate-y-1.5 transition-all duration-300"
                                role="listitem"
                            >
                                <div className="text-5xl font-bold text-blue-500 mb-3 font-roboto-slab">
                                    {loadingStats ? (
                                        <span className="animate-pulse">S/ ---</span>
                                    ) : (
                                        <span>
                                            S/{' '}
                                            <CountUp
                                                end={stats.totalInvertido}
                                                duration={2.5}
                                                separator=","
                                                suffix="+"
                                            />
                                        </span>
                                    )}
                                </div>
                                <div className="text-slate-300 font-pt-sans text-lg">Invertidos</div>
                            </div>

                            <div
                                className="p-8 bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-2xl border border-purple-500/20 hover:scale-105 hover:-translate-y-1.5 transition-all duration-300"
                                role="listitem"
                            >
                                <div className="text-5xl font-bold text-purple-500 mb-3 font-roboto-slab">
                                    {loadingStats ? (
                                        <span className="animate-pulse">---</span>
                                    ) : (
                                        <CountUp
                                            end={stats.totalInversores}
                                            duration={2.5}
                                            suffix="+"
                                        />
                                    )}
                                </div>
                                <div className="text-slate-300 font-pt-sans text-lg">Inversores</div>
                            </div>

                            <div
                                className="p-8 bg-gradient-to-br from-pink-500/10 to-pink-600/10 rounded-2xl border border-pink-500/20 hover:scale-105 hover:-translate-y-1.5 transition-all duration-300"
                                role="listitem"
                            >
                                <div className="text-5xl font-bold text-pink-500 mb-3 font-roboto-slab">
                                    {loadingStats ? (
                                        <span className="animate-pulse">---</span>
                                    ) : (
                                        <CountUp
                                            end={stats.totalProyectos}
                                            duration={2.5}
                                        />
                                    )}
                                </div>
                                <div className="text-slate-300 font-pt-sans text-lg">Proyectos Activos</div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Featured Carousel */}
            {!loading && proyectosDestacados.length > 0 && (
                <div className="-mx-4 lg:-mx-8 mt-12">
                    <FeaturedCarousel productos={proyectosDestacados} />
                </div>
            )}

            {/* Quick Filters */}
            {!loading && productosFiltrados.length > 0 && (
                <div className="-mx-4 lg:-mx-8 mt-8">
                    <QuickFilters
                        onFilterChange={handleFilterChange}
                        resultCount={productosOrdenados.length}
                    />
                </div>
            )}

            {/* Banner de filtro activo */}
            {activeFilter !== 'todos' && (
                <div
                    className="bg-blue-600/20 border-l-4 border-blue-500 px-6 py-4 mb-6 mt-6 rounded-r-lg"
                >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <FaFilter className="text-blue-400" />
                            <span className="text-white font-semibold">
                                Filtrando por: <span className="text-blue-400 capitalize">{activeFilter}</span>
                            </span>
                            <span className="text-slate-400">
                                ({productosOrdenados.length} {productosOrdenados.length === 1 ? 'resultado' : 'resultados'})
                            </span>
                        </div>
                        <button
                            onClick={() => setActiveFilter('todos')}
                            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                        >
                            Limpiar filtro ×
                        </button>
                    </div>
                </div>
            )}

            {/* Productos Section */}
            <section className="py-12 px-0" aria-labelledby="proyectos-titulo">
                <div className="max-w-[90%] mx-auto px-4 w-full">
                    {/* Header de sección con sorting y view mode */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                        <h2 id="proyectos-titulo" className="text-2xl md:text-3xl font-bold text-white font-roboto-slab">
                            {activeFilter === 'todos'
                                ? 'Todos los Proyectos'
                                : `Proyectos: ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}`
                            }
                        </h2>
                        
                        <div className="flex items-center gap-4 flex-wrap">
                            {/* Sorting */}
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">Ordenar:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value="recientes">Más Recientes</option>
                                    <option value="populares">Más Populares</option>
                                    <option value="mayor-inversion">Mayor Inversión</option>
                                    <option value="menor-inversion">Menor Inversión</option>
                                    <option value="casi-completos">Casi Completos</option>
                                </select>
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded transition-colors ${
                                        viewMode === 'grid'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="Vista Grid"
                                >
                                    <FaTh />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded transition-colors ${
                                        viewMode === 'list'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="Vista Lista"
                                >
                                    <FaList />
                                </button>
                            </div>

                            {/* Links de navegación */}
                            <nav className="flex flex-wrap gap-3" aria-label="Navegación de productos">
                                <Link
                                    href="/productos/populares"
                                    className="text-sm text-white hover:text-blue-400 font-semibold transition-colors"
                                >
                                    Ver Populares →
                                </Link>
                                <Link
                                    href="/productos/buscar"
                                    className="text-sm text-white hover:text-purple-400 font-semibold transition-colors"
                                >
                                    Buscar →
                                </Link>
                            </nav>
                        </div>
                    </div>

                    {/* Loading State con Skeleton Mejorado */}
                    {loading ? (
                        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="bg-slate-800/50 rounded-2xl overflow-hidden">
                                    {/* Imagen skeleton */}
                                    <div className="h-64 bg-slate-700 animate-pulse" />
                                    {/* Content skeleton */}
                                    <div className="p-6 space-y-4">
                                        <div className="h-6 bg-slate-700 rounded w-3/4 animate-pulse" />
                                        <div className="h-4 bg-slate-700 rounded w-1/2 animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="h-3 bg-slate-700 rounded animate-pulse" />
                                            <div className="h-3 bg-slate-700 rounded w-5/6 animate-pulse" />
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="h-8 bg-slate-700 rounded w-20 animate-pulse" />
                                            <div className="h-8 bg-slate-700 rounded w-20 animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : productosOrdenados.length === 0 ? (
                        /* Empty State Mejorado */
                        <div className="text-center py-20" role="status">
                            <div className="max-w-md mx-auto">
                                <div className="text-6xl mb-4" aria-hidden="true">
                                    {activeFilter === 'todos' ? '🏗️' : '🔍'}
                                </div>
                                <h3 className="text-2xl font-semibold text-gray-200 mb-2">
                                    {activeFilter === 'todos'
                                        ? 'No hay proyectos disponibles'
                                        : `No hay proyectos en la categoría "${activeFilter}"`
                                    }
                                </h3>
                                <p className="text-gray-400 mb-6">
                                    Intenta con:
                                </p>
                                <div className="flex gap-3 justify-center mb-6">
                                    {activeFilter !== 'todos' && (
                                        <button
                                            onClick={() => setActiveFilter('todos')}
                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold hover:scale-105 transition-all duration-200"
                                        >
                                            Ver Todos
                                        </button>
                                    )}
                                    {usuario && (
                                        <Link
                                            href="/productos/nuevo"
                                            className="inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-semibold hover:scale-105 transition-all duration-200"
                                        >
                                            Crear Proyecto
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Grid de Productos con Layout Asimétrico */
                        <>
                             <div
                                 className={
                                     viewMode === 'grid'
                                         ? 'grid gap-12 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto'
                                         : 'flex flex-col gap-12'
                                 }
                                 role="list"
                             >
                                {productosOrdenados.map((producto) => (
                                    <div key={producto.id}>
                                        <ProductCard
                                            producto={producto}
                                            usuarioId={usuario?.uid}
                                            variant="default"
                                        />
                                    </div>
                                ))}
                             </div>

                            {/* Botón Cargar Más */}
                            {hasMore && (
                                <div className="mt-12 text-center">
                                     <button
                                         onClick={cargarMas}
                                         disabled={cargandoMas}
                                         className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg rounded-xl shadow-lg shadow-blue-500/25 active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                     >
                                         {cargandoMas ? (
                                             <span className="flex items-center gap-3">
                                                 <svg
                                                     className="animate-spin h-5 w-5 text-white"
                                                     xmlns="http://www.w3.org/2000/svg"
                                                     fill="none"
                                                     viewBox="0 0 24 24"
                                                 >
                                                     <circle
                                                         className="opacity-25"
                                                         cx="12"
                                                         cy="12"
                                                         r="10"
                                                         stroke="currentColor"
                                                         strokeWidth="4"
                                                     ></circle>
                                                     <path
                                                         className="opacity-75"
                                                         fill="currentColor"
                                                         d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                     ></path>
                                                 </svg>
                                                 Cargando más proyectos...
                                             </span>
                                         ) : (
                                             'Cargar Más Proyectos'
                                         )}
                                     </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* Testimonials Section */}
            <Testimonials />

            {/* CTA Section */}
            {!usuario && (
                <section
                    className="py-20 bg-gradient-to-r from-blue-900 to-purple-900 text-white relative overflow-hidden -mx-4 lg:-mx-8"
                    aria-labelledby="cta-titulo"
                >
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
                    </div>

                    <div className="max-w-4xl mx-auto text-center px-4 relative z-10">
                         <div>
                             <h2 id="cta-titulo" className="text-4xl md:text-5xl font-bold mb-6 font-roboto-slab">
                                 ¿Listo para empezar?
                             </h2>
                             <p className="text-xl md:text-2xl mb-8 text-gray-200">
                                 Crea tu cuenta gratis y comienza a invertir hoy
                             </p>
                             <div className="hover:scale-105 active:scale-95 transition-transform duration-200 inline-block">
                                 <Link
                                     href="/crear-cuenta"
                                     className="inline-block bg-white text-blue-900 px-10 py-5 rounded-xl font-bold text-xl hover:bg-gray-100 transition shadow-2xl"
                                 >
                                     Crear Cuenta Gratis
                                 </Link>
                             </div>
                         </div>
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="bg-black text-white py-12 -mx-4 lg:-mx-8" role="contentinfo">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-gray-400">
                        © 2026 Inversiones Pro. Todos los derechos reservados.
                    </p>
                    <nav className="mt-4 space-x-4" aria-label="Enlaces del footer">
                        <Link
                            href="/nosotros"
                            className="text-gray-400 hover:text-white transition"
                        >
                            Nosotros
                        </Link>
                        {!usuario && (
                            <Link
                                href="/login"
                                className="text-gray-400 hover:text-white transition"
                            >
                                Iniciar Sesión
                            </Link>
                        )}
                    </nav>
                </div>
            </footer>

            {/* FAB: Cargar Más (Floating Action Button) */}
            <button
                onClick={cargarMas}
                className={`fixed bottom-24 right-8 z-50 p-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-2xl shadow-blue-500/50 flex items-center gap-2 transition-all duration-300 hover:scale-110 active:scale-95 ${
                    showFAB && hasMore && !cargandoMas ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
                }`}
                title="Cargar más proyectos"
            >
                <FaArrowDown className="animate-bounce" />
                <span className="hidden md:inline font-semibold">Cargar Más</span>
            </button>

            {/* Scroll to Top Button */}
            <button
                onClick={scrollToTop}
                className={`fixed bottom-8 right-8 z-50 p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-2xl border border-slate-600 transition-all duration-300 hover:scale-110 active:scale-95 ${
                    showScrollTop ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
                }`}
                title="Volver arriba"
            >
                <FaArrowUp />
            </button>
        </div>
    );
}
