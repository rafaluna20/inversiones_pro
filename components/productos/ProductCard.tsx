'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useState, useMemo } from 'react';
import {
    FaHeart, FaRegHeart, FaComment, FaMapMarkerAlt,
    FaChevronLeft, FaChevronRight, FaCheckCircle,
    FaBookmark, FaRegBookmark, FaUsers, FaChartLine,
    FaCalendarAlt, FaBuilding, FaLock
} from 'react-icons/fa';
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

// Mapa de labels por categoría
const CATEGORIA_LABELS: Record<string, string> = {
    departamento: 'Departamento',
    terreno: 'Terreno',
    casa: 'Casa',
    oficina: 'Oficina',
    localComercial: 'Local Comercial',
    habilitacionUrbana: 'Hab. Urbana',
};

export default function ProductCard({ producto, usuarioId, variant = 'default' }: ProductCardProps) {
    const router = useRouter();
    const [procesando, setProcesando] = useState(false);

    const { phone } = useCreadorPhone(producto.creador?.id);
    const { isBookmarked, toggleBookmark } = useBookmarks();

    // ── Normalizar votos ──────────────────────────────────────────────
    const votosArray = useMemo(() => {
        if (Array.isArray(producto.votos)) return producto.votos;
        return [];
    }, [producto.votos]);

    const [votes, setVotes] = useState(votosArray.length);
    const [hasVoted, setHasVoted] = useState(
        usuarioId ? votosArray.includes(usuarioId) : false
    );

    // ── Carousel ─────────────────────────────────────────────────────
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showMapModal, setShowMapModal] = useState(false);

    const images = useMemo(() => {
        if (!producto.urlimagen) return [];
        if (Array.isArray(producto.urlimagen)) return producto.urlimagen;
        return [producto.urlimagen];
    }, [producto.urlimagen]);

    // ── Cálculo REAL de recaudado y meta ─────────────────────────────
    // Prioridad: etapas.montoRecaudado > suma desde inversores[] > monto legacy
    const { recaudado, meta, porcentaje, numInversores } = useMemo(() => {
        const capitalTotal = Number(producto.precio || producto.monto || 0);

        // 1) Modelo bifásico: usar etapas
        if (producto.etapas) {
            const recTierra = Number(producto.etapas.tierra?.montoRecaudado || 0);
            const recConstruccion = Number(producto.etapas.construccion?.montoRecaudado || 0);
            const metaTierra = Number(producto.etapas.tierra?.montoObjetivo || 0);
            const metaConstruccion = Number(producto.etapas.construccion?.montoObjetivo || 0);
            const totalRecaudado = recTierra + recConstruccion;
            const totalMeta = metaTierra + metaConstruccion;
            const socios = (producto.etapas.tierra?.numeroSociosActuales || 0) +
                           (producto.etapas.construccion?.numeroSociosActuales || 0);
            return {
                recaudado: totalRecaudado,
                meta: totalMeta || capitalTotal,
                porcentaje: totalMeta > 0 ? Math.min(Math.round((totalRecaudado / totalMeta) * 100), 100) : 0,
                numInversores: socios,
            };
        }

        // 2) Modelo legacy: sumar desde el array inversores[]
        const inversoresArr = Array.isArray(producto.inversores) ? producto.inversores : [];
        const numInv = inversoresArr.length;

        // Calcular monto real sumando cubos × precio
        let montoCalculado = 0;
        if (capitalTotal > 0 && numInv > 0) {
            inversoresArr.forEach((inv: any) => {
                const cubos = Number(inv.cubos || 0);
                montoCalculado += (cubos * capitalTotal) / 100;
            });
        }

        const realRecaudado = montoCalculado > 0 ? montoCalculado : Number(producto.monto || 0);
        const pct = capitalTotal > 0 ? Math.min(Math.round((realRecaudado / capitalTotal) * 100), 100) : 0;

        return {
            recaudado: realRecaudado,
            meta: capitalTotal,
            porcentaje: pct,
            numInversores: numInv,
        };
    }, [producto]);

    // ── ROI proyectado ────────────────────────────────────────────────
    const roiProyectado = useMemo(() => {
        // Intentar obtener desde la utilidad neta si está liquidado
        if (producto.utilidadNeta && Number(producto.precio || producto.monto) > 0) {
            return Math.round((Number(producto.utilidadNeta) / Number(producto.precio || producto.monto)) * 100);
        }
        // Fallback: 15% estándar para proyectos inmobiliarios
        return 15;
    }, [producto]);

    // ── Fecha fin estimada ────────────────────────────────────────────
    const fechaFinLabel = useMemo(() => {
        const fechaFin = producto.fechaFinalizacion ||
            producto.etapas?.construccion?.fechaFinEstimada;
        if (!fechaFin) return null;
        const d = new Date(fechaFin);
        return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short' });
    }, [producto]);

    // ── Progreso construcción ─────────────────────────────────────────
    const progresoConstruccion = producto.progresoConstruccion ?? null;

    // ── Estado del proyecto ───────────────────────────────────────────
    const isFeaturedCard = variant === 'featured';
    const isNew = useMemo(() => {
        if (!producto.creado) return false;
        let fecha: Date;
        if (typeof producto.creado === 'number') fecha = new Date(producto.creado);
        else if (producto.creado.toDate) fecha = producto.creado.toDate();
        else return false;
        return Math.floor((Date.now() - fecha.getTime()) / 86400000) <= 7;
    }, [producto.creado]);

    const isPopular = votes >= 10;
    const isLiquidado = producto.estado === false;
    const isFinanciado = porcentaje >= 100 && !isLiquidado;

    const formatearFechaRelativa = (timestamp: any) => {
        if (!timestamp) return 'Fecha desconocida';
        let fecha: Date;
        if (typeof timestamp === 'number') fecha = new Date(timestamp);
        else if (timestamp.toDate) fecha = timestamp.toDate();
        else return 'Fecha desconocida';
        const dias = Math.floor((Date.now() - fecha.getTime()) / 86400000);
        if (dias > 7) return fecha.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
        return formatDistanceToNow(fecha, { locale: es, addSuffix: true });
    };

    // ── Handlers ──────────────────────────────────────────────────────
    const votar = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!usuarioId) { router.push('/login'); return; }
        if (procesando) return;
        setProcesando(true);
        try {
            const ref = doc(db, 'productos', producto.id);
            if (hasVoted) {
                await updateDoc(ref, { votos: arrayRemove(usuarioId) });
                setVotes(p => p - 1); setHasVoted(false);
                headerAnalytics.productUnliked(producto.id, usuarioId);
            } else {
                await updateDoc(ref, { votos: arrayUnion(usuarioId) });
                setVotes(p => p + 1); setHasVoted(true);
                headerAnalytics.productLiked(producto.id, usuarioId);
            }
        } catch { } finally { setProcesando(false); }
    };

    const handleBookmark = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!usuarioId) { router.push('/login'); return; }
        await toggleBookmark(producto.id);
    };

    const handleInvertirClick = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!usuarioId) { router.push('/login'); return; }
        router.push(`/productos/${producto.id}?invertir=true`);
    };

    const handleMapClick = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setShowMapModal(true);
        headerAnalytics.mapOpened(producto.id, usuarioId);
    };

    const nextImage = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setCurrentImageIndex(p => (p + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setCurrentImageIndex(p => (p - 1 + images.length) % images.length);
    };

    // ── Color de barra de progreso ────────────────────────────────────
    const barColor = isLiquidado
        ? 'from-slate-500 to-slate-400'
        : porcentaje >= 100
            ? 'from-amber-500 to-orange-400'
            : porcentaje >= 70
                ? 'from-emerald-500 to-teal-400'
                : 'from-blue-600 to-indigo-500';

    return (
        <>
            <Link href={`/productos/${producto.id}`} className="block h-full">
                <article className={`
                    group relative flex flex-col h-full overflow-hidden
                    bg-slate-900 border border-slate-700/60 rounded-2xl
                    transition-all duration-300
                    hover:border-slate-500/70 hover:shadow-xl hover:shadow-slate-900/30
                    hover:-translate-y-1
                    ${isFeaturedCard ? 'lg:min-h-[520px]' : ''}
                `}>

                    {/* ── Botón Bookmark ── */}
                    <button
                        onClick={handleBookmark}
                        className="absolute top-3 right-3 z-20 p-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-sm rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-90"
                        title={isBookmarked(producto.id) ? 'Quitar de favoritos' : 'Guardar'}
                    >
                        {isBookmarked(producto.id)
                            ? <FaBookmark className="text-yellow-400" size={15} />
                            : <FaRegBookmark className="text-slate-400" size={15} />
                        }
                    </button>

                    {/* ── Imagen + Carousel ── */}
                    <div className={`relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 flex-shrink-0 ${isFeaturedCard ? 'h-72' : 'h-48'}`}>
                        {images.length > 0 ? (
                            <img
                                key={currentImageIndex}
                                src={images[currentImageIndex]}
                                alt={`${producto.nombre} - ${currentImageIndex + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-600">
                                <FaBuilding size={40} />
                                <span className="text-xs text-slate-600">Sin imagen</span>
                            </div>
                        )}

                        {/* Controles carousel */}
                        {images.length > 1 && (
                            <>
                                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10" aria-label="Anterior">
                                    <FaChevronLeft size={12} />
                                </button>
                                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10" aria-label="Siguiente">
                                    <FaChevronRight size={12} />
                                </button>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                                    {images.map((_, idx) => (
                                        <div key={idx} className={`h-1 rounded-full transition-all ${idx === currentImageIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Badges */}
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                            {/* Estado principal */}
                            <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full border border-white/10 backdrop-blur-md shadow
                                ${isLiquidado ? 'bg-slate-700/90 text-slate-300' :
                                  isFinanciado ? 'bg-amber-500/90 text-white' :
                                  'bg-blue-600/90 text-white'}`}>
                                {isLiquidado ? '✓ LIQUIDADO' : isFinanciado ? '⚡ FINANCIADO' : '● EN CURSO'}
                            </span>
                            {/* Sub-badges */}
                            <div className="flex gap-1.5 flex-wrap">
                                {isNew && <span className="px-2 py-0.5 bg-slate-900/80 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold rounded-full backdrop-blur-sm">NUEVO</span>}
                                {isPopular && <span className="px-2 py-0.5 bg-slate-900/80 text-orange-400 border border-orange-500/30 text-[9px] font-bold rounded-full backdrop-blur-sm">🔥 POPULAR</span>}
                                {producto.categoria && <span className="px-2 py-0.5 bg-slate-900/80 text-blue-300 border border-blue-500/20 text-[9px] font-bold rounded-full backdrop-blur-sm uppercase">{CATEGORIA_LABELS[producto.categoria] || producto.categoria}</span>}
                            </div>
                        </div>

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-70 pointer-events-none" />
                    </div>

                    {/* ── Contenido ── */}
                    <div className="flex flex-col flex-1 p-5 gap-4">

                        {/* Título y empresa */}
                        <div>
                            <h3 className={`font-bold text-white leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors duration-200 ${isFeaturedCard ? 'text-2xl' : 'text-base'}`}>
                                {producto.nombre}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs text-slate-400 font-medium">{producto.empresa}</span>
                                {producto.creador?.verified && (
                                    <FaCheckCircle className="text-blue-500 flex-shrink-0" size={11} title="Creador verificado" />
                                )}
                            </div>
                        </div>

                        {/* Descripción */}
                        {isFeaturedCard && (
                            <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
                                {producto.descripcion}
                            </p>
                        )}

                        {/* ── Stats rápidos ── */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* ROI */}
                            <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1 mb-0.5">
                                    <FaChartLine className="text-emerald-400" size={10} />
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">ROI</span>
                                </div>
                                <span className="text-emerald-400 font-bold text-sm">
                                    {isLiquidado && producto.utilidadNeta ? `${roiProyectado}%` : `~${roiProyectado}%`}
                                </span>
                            </div>
                            {/* Inversores */}
                            <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1 mb-0.5">
                                    <FaUsers className="text-blue-400" size={10} />
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Socios</span>
                                </div>
                                <span className="text-blue-400 font-bold text-sm">{numInversores}</span>
                            </div>
                            {/* Fecha / Progreso obra */}
                            <div className="bg-purple-500/8 border border-purple-500/15 rounded-xl p-2.5 text-center">
                                {progresoConstruccion !== null ? (
                                    <>
                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Obra</span>
                                        </div>
                                        <span className="text-purple-400 font-bold text-sm">{progresoConstruccion}%</span>
                                    </>
                                ) : fechaFinLabel ? (
                                    <>
                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                            <FaCalendarAlt className="text-purple-400" size={10} />
                                            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Fin est.</span>
                                        </div>
                                        <span className="text-purple-400 font-bold text-[11px]">{fechaFinLabel}</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                            <FaLock className="text-purple-400" size={10} />
                                            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Comisión</span>
                                        </div>
                                        <span className="text-purple-400 font-bold text-sm">{producto.comisionGestor ?? 10}%</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ── Barra de financiamiento REAL ── */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400 font-medium">Capital recaudado</span>
                                <span className={`font-bold tabular-nums ${porcentaje >= 100 ? 'text-amber-400' : 'text-blue-400'}`}>
                                    {porcentaje}%
                                </span>
                            </div>

                            {/* Track de barra */}
                            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    style={{ width: `${porcentaje}%` }}
                                    className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000 ease-out relative`}
                                >
                                    {/* Brillo animado */}
                                    {!isLiquidado && porcentaje > 5 && (
                                        <div className="absolute inset-y-0 right-0 w-4 bg-white/30 blur-sm animate-pulse" />
                                    )}
                                </div>
                            </div>

                            {/* Montos */}
                            <div className="flex justify-between text-xs">
                                <div>
                                    <span className="text-white font-bold tabular-nums">
                                        S/ {recaudado.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-slate-500 ml-1">recaudado</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-500">Meta: </span>
                                    <span className="text-slate-300 font-semibold tabular-nums">
                                        S/ {meta.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── Footer: acciones + precio ── */}
                        <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between gap-3">

                            {/* Interacciones */}
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <button
                                    onClick={votar}
                                    disabled={procesando}
                                    className="flex items-center gap-1.5 hover:text-rose-400 active:scale-90 transition-all disabled:opacity-50"
                                >
                                    {hasVoted ? <FaHeart className="text-rose-500" size={13} /> : <FaRegHeart size={13} />}
                                    <span className="font-semibold">{votes}</span>
                                </button>

                                <div className="flex items-center gap-1.5">
                                    <FaComment size={12} />
                                    <span>{producto.comentarios?.length || 0}</span>
                                </div>

                                {(producto.cordenadas || producto.coordenadas) && (
                                    <button onClick={handleMapClick} className="hover:text-blue-400 hover:scale-110 active:scale-90 transition-all" title="Ver ubicación">
                                        <FaMapMarkerAlt size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Precio + CTA */}
                            <div className="flex items-center gap-3">
                                {producto.precio && (
                                    <div className="text-right hidden sm:block">
                                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Ticket mín.</div>
                                        <div className="text-white font-bold text-sm tabular-nums">
                                            S/ {Number(producto.precio).toLocaleString('es-PE')}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={handleInvertirClick}
                                    disabled={isLiquidado}
                                    className={`
                                        flex-shrink-0 py-2 px-4 text-xs font-bold rounded-xl transition-all duration-200 active:scale-95 whitespace-nowrap
                                        ${isLiquidado
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                                        }
                                    `}
                                >
                                    {isLiquidado ? 'Finalizado' : 'Invertir'}
                                </button>
                            </div>
                        </div>
                    </div>
                </article>
            </Link>

            {/* Modal de Mapa */}
            {(producto.cordenadas || producto.coordenadas) && (
                <MapModal
                    isOpen={showMapModal}
                    onClose={() => setShowMapModal(false)}
                    coordinates={(producto.coordenadas || producto.cordenadas)!}
                    projectName={producto.nombre}
                    address={producto.direccion}
                />
            )}
        </>
    );
}
