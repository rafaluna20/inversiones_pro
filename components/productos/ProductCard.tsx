'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useState, useMemo } from 'react';
import { FaHeart, FaRegHeart, FaComment, FaMapMarkerAlt, FaWhatsapp, FaChevronLeft, FaChevronRight, FaCheckCircle, FaBookmark, FaRegBookmark } from 'react-icons/fa';
import { Producto } from '@/types';
import useCreadorPhone from '@/Hooks/useCreadorPhone';
import useBookmarks from '@/Hooks/useBookmarks';
import MapModal from '@/components/ui/MapModal';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { headerAnalytics } from '@/lib/analytics';

interface ProductCardProps {
    producto: Producto;
    usuarioId?: string;
    variant?: 'default' | 'featured';
}

export default function ProductCard({ producto, usuarioId, variant = 'default' }: ProductCardProps) {
    const router = useRouter();
    const [procesando, setProcesando] = useState(false);

    // Hooks
    const { phone, loading: phoneLoading } = useCreadorPhone(producto.creador?.id);
    const { isBookmarked, toggleBookmark } = useBookmarks();

    // Normalizar votos a número
    const votosArray = useMemo(() => {
        if (Array.isArray(producto.votos)) return producto.votos;
        if (typeof producto.votos === 'number') return [];
        return [];
    }, [producto.votos]);

    const [votes, setVotes] = useState(votosArray.length);
    const [hasVoted, setHasVoted] = useState(
        usuarioId ? votosArray.includes(usuarioId) : false
    );

    // Estados para múltiples imágenes
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Estados para modales
    const [showMapModal, setShowMapModal] = useState(false);

    // Normalizar imágenes a array
    const images = useMemo(() => {
        if (!producto.urlimagen) return [];
        if (Array.isArray(producto.urlimagen)) return producto.urlimagen;
        return [producto.urlimagen];
    }, [producto.urlimagen]);

    // Calcular progreso de inversión (simulado - en producción vendría de la BD)
    const { recaudado, meta, porcentaje } = useMemo(() => {
        // Simulación basada en votos y precio
        const precioNum = typeof producto.precio === 'string' ? parseFloat(producto.precio) : producto.precio;
        const metaCalculada = precioNum ? precioNum * 10 : 100000;
        const recaudadoCalculado = Math.min(
            metaCalculada * (votes / 100) * Math.random() * 2,
            metaCalculada
        );
        const porcentajeCalculado = Math.round((recaudadoCalculado / metaCalculada) * 100);

        return {
            recaudado: recaudadoCalculado,
            meta: metaCalculada,
            porcentaje: porcentajeCalculado
        };
    }, [votes, producto.precio]);

    const votar = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!usuarioId) {
            router.push('/login');
            return;
        }

        if (procesando) return;

        setProcesando(true);
        try {
            const productoRef = doc(db, 'productos', producto.id);

            if (hasVoted) {
                await updateDoc(productoRef, {
                    votos: arrayRemove(usuarioId),
                });
                setVotes((prev) => prev - 1);
                setHasVoted(false);
                headerAnalytics.productUnliked(producto.id, usuarioId);
            } else {
                await updateDoc(productoRef, {
                    votos: arrayUnion(usuarioId),
                });
                setVotes((prev) => prev + 1);
                setHasVoted(true);
                headerAnalytics.productLiked(producto.id, usuarioId);
            }
        } catch (error) {
            console.error('Error al votar:', error);
        } finally {
            setProcesando(false);
        }
    };

    const handleBookmark = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!usuarioId) {
            router.push('/login');
            return;
        }

        await toggleBookmark(producto.id);
    };

    const handleInvertirClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!usuarioId) {
            router.push('/login');
            return;
        }

        // Navegar a la página de detalle con parámetro para abrir modal de inversión
        router.push(`/productos/${producto.id}?invertir=true`);
    };

    const formatearFechaRelativa = (timestamp: any) => {
        if (!timestamp) return 'Fecha desconocida';

        // Manejar timestamp de Firestore o número
        let fecha: Date;
        if (typeof timestamp === 'number') {
            fecha = new Date(timestamp);
        } else if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            fecha = timestamp.toDate();
        } else {
            return 'Fecha desconocida';
        }

        const diasDiferencia = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));

        // Si es mayor a 7 días, mostrar fecha absoluta
        if (diasDiferencia > 7) {
            return fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        }

        // Si es menor a 7 días, mostrar tiempo relativo
        return formatDistanceToNow(fecha, { locale: es, addSuffix: true });
    };

    const handleWhatsAppClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (phone) {
            const mensaje = encodeURIComponent(`Hola, me interesa tu proyecto "${producto.nombre}"`);
            const url = `https://wa.me/${phone}?text=${mensaje}`;
            window.open(url, '_blank');
            headerAnalytics.whatsappClicked(producto.id, usuarioId);
        }
    };

    const handleMapClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMapModal(true);
        headerAnalytics.mapOpened(producto.id, usuarioId);
    };

    const nextImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Badges & Estado
    const isNew = useMemo(() => {
        if (!producto.creado) return false;

        let fecha: Date;
        if (typeof producto.creado === 'number') {
            fecha = new Date(producto.creado);
        } else if (producto.creado.toDate && typeof producto.creado.toDate === 'function') {
            fecha = producto.creado.toDate();
        } else {
            return false;
        }

        const diasDiferencia = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
        return diasDiferencia <= 7;
    }, [producto.creado]);

    const isPopular = useMemo(() => votes >= 10, [votes]);
    const isFeaturedCard = variant === 'featured';

    const estadoProyecto = useMemo(() => {
        if (producto.estado === false) return { label: 'LIQUIDADO', styles: 'from-slate-600 to-slate-500 text-white' };
        if (porcentaje >= 100) return { label: '100% FINANCIADO', styles: 'from-amber-500 to-orange-500 text-white' };
        return { label: 'EN CURSO', styles: 'from-blue-600 to-indigo-600 text-white' };
    }, [producto.estado, porcentaje]);

    return (
        <>
            <Link href={`/productos/${producto.id}`}>
                <article className={`group relative card overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-900/20 ${isFeaturedCard ? 'lg:h-[500px]' : ''
                    }`}>
                    {/* Bookmark Button */}
                    <button
                        onClick={handleBookmark}
                        className="absolute top-4 right-4 z-20 p-2.5 bg-slate-900/90 hover:bg-slate-800 active:scale-90 hover:scale-110 backdrop-blur-sm rounded-full shadow-lg transition-all duration-200"
                        title={isBookmarked(producto.id) ? 'Quitar de favoritos' : 'Guardar para después'}
                    >
                        {isBookmarked(producto.id) ? (
                            <FaBookmark className="text-yellow-400" size={18} />
                        ) : (
                            <FaRegBookmark className="text-slate-400" size={18} />
                        )}
                    </button>

                    {/* Imagen con Carousel */}
                    <div className={`relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 ${isFeaturedCard ? 'h-80' : 'h-52'
                        }`}>
                        {images.length > 0 ? (
                            <img
                                key={currentImageIndex}
                                src={images[currentImageIndex]}
                                alt={`${producto.nombre} - Imagen ${currentImageIndex + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                        )}

                        {/* Controles de Carousel */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 active:scale-90 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                                    aria-label="Imagen anterior"
                                >
                                    <FaChevronLeft size={16} />
                                </button>

                                <button
                                    onClick={nextImage}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 active:scale-90 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                                    aria-label="Siguiente imagen"
                                >
                                    <FaChevronRight size={16} />
                                </button>

                                {/* Indicadores */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                    {images.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-1.5 rounded-full transition-all duration-200 hover:scale-125 ${idx === currentImageIndex
                                                ? 'w-6 bg-white'
                                                : 'w-1.5 bg-white/50'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Badges - Esquina superior izquierda */}
                        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10 items-start">
                            {/* ESTADO PRINCIPAL DEL PROYECTO */}
                            <div className={`px-3 py-1 bg-gradient-to-r ${estadoProyecto.styles} text-xs font-bold rounded-full shadow-lg border border-white/20`}>
                                {estadoProyecto.label}
                            </div>
                            
                            <div className="flex gap-2">
                                {isNew && (
                                    <div className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full">
                                        NUEVO
                                    </div>
                                )}
                                {isPopular && (
                                    <div className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-md text-orange-400 border border-orange-500/30 text-[10px] font-bold rounded-full">
                                        🔥 POPULAR
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-60" />
                    </div>

                    <div className="p-5 space-y-3">
                        {/* Título y Empresa */}
                        <div>
                            <h3 className={`font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors ${isFeaturedCard ? 'text-3xl' : 'text-xl'
                                }`}>
                                {producto.nombre}
                            </h3>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-400 font-medium">{producto.empresa}</p>
                                {producto.creador?.verified && (
                                    <FaCheckCircle className="text-blue-500" size={14} title="Creador verificado" />
                                )}
                            </div>
                        </div>

                        {/* Descripción */}
                        <p className={`text-slate-400 text-sm leading-relaxed ${isFeaturedCard ? 'line-clamp-4' : 'line-clamp-2'
                            }`}>
                            {producto.descripcion}
                        </p>

                        {/* Progress Bar de Inversión */}
                        <div className="space-y-2 py-3 border-y border-white/5 my-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400 font-medium">Recaudado</span>
                                <span className="text-blue-400 font-bold">
                                    {porcentaje}%
                                </span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    style={{ width: `${porcentaje}%` }}
                                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 transition-all duration-1000 ease-out"
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span className="font-semibold text-gray-300">S/ {recaudado.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                                <span>Meta: S/ {meta.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        {/* Acciones e Interacciones */}
                        <div className="flex items-center justify-between text-sm pt-2">
                            <div className="flex items-center gap-4">
                                {/* Votos */}
                                <button
                                    onClick={votar}
                                    disabled={procesando}
                                    className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 active:scale-95 transition-all duration-200 disabled:opacity-50"
                                >
                                    {hasVoted ? (
                                        <FaHeart className="text-rose-500" />
                                    ) : (
                                        <FaRegHeart />
                                    )}
                                    <span className="font-semibold">{votes}</span>
                                </button>

                                {/* Comentarios */}
                                <div className="flex items-center gap-1.5 text-slate-400">
                                    <FaComment />
                                    <span>{producto.comentarios?.length || 0}</span>
                                </div>

                                {/* Mapa/Ubicación */}
                                {producto.cordenadas && (
                                    <button
                                        onClick={handleMapClick}
                                        className="flex items-center gap-1.5 text-slate-400 hover:text-blue-400 hover:scale-110 active:scale-95 transition-all duration-200"
                                        title="Ver ubicación"
                                    >
                                        <FaMapMarkerAlt size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Fecha Relativa */}
                            <span
                                className="text-slate-500 text-xs"
                                title={
                                    typeof producto.creado === 'number'
                                        ? new Date(producto.creado).toLocaleString('es-ES')
                                        : producto.creado?.toDate?.()?.toLocaleString('es-ES')
                                }
                            >
                                {formatearFechaRelativa(producto.creado)}
                            </span>
                        </div>

                        {/* Precio y Botón Invertir */}
                        <div className="flex items-center justify-between gap-4 pt-4 mt-2 border-t border-white/5">
                            {producto.precio && (
                                <div>
                                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">Ticket Mínimo</span>
                                    <span className="text-white font-bold text-lg font-mono">
                                        S/ {producto.precio.toLocaleString()}
                                    </span>
                                </div>
                            )}

                            {/* Botón Invertir Ahora */}
                            <button
                                onClick={handleInvertirClick}
                                disabled={producto.estado === false}
                                className="w-fit py-2.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-900/20 transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                            >
                                {producto.estado === false ? 'Finalizado' : 'Invertir Ahora'}
                            </button>
                        </div>
                    </div>
                </article>
            </Link>

            {/* Modal de Mapa */}
            {producto.cordenadas && (
                <MapModal
                    isOpen={showMapModal}
                    onClose={() => setShowMapModal(false)}
                    coordinates={producto.cordenadas}
                    projectName={producto.nombre}
                    address={producto.direccion}
                />
            )}
        </>
    );
}
