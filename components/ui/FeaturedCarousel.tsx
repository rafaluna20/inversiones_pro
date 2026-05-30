'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { FaChevronLeft, FaChevronRight, FaUsers, FaChartLine, FaMapMarkerAlt, FaCheckCircle, FaStar } from 'react-icons/fa';
import Link from 'next/link';
import { Producto } from '@/types';

interface FeaturedCarouselProps {
    productos: Producto[];
}

const CATEGORIA_LABELS: Record<string, string> = {
    departamento: 'Departamento',
    terreno: 'Terreno',
    casa: 'Casa',
    oficina: 'Oficina',
    localComercial: 'Local Comercial',
    habilitacionUrbana: 'Hab. Urbana',
};

export default function FeaturedCarousel({ productos }: FeaturedCarouselProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel(
        {
            loop: true,
            align: 'start',
            skipSnaps: false,
            dragFree: false,
        },
        [Autoplay({ delay: 5000, stopOnInteraction: true, stopOnMouseEnter: true })]
    );

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
    const [isPlaying, setIsPlaying] = useState(true);

    const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
    const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        setScrollSnaps(emblaApi.scrollSnapList());
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
        return () => { emblaApi.off('select', onSelect); emblaApi.off('reInit', onSelect); };
    }, [emblaApi, onSelect]);

    // ── Cálculo real de datos por proyecto ────────────────────────────
    const getProjectData = (producto: Producto) => {
        const capitalTotal = Number(producto.precio || producto.monto || 0);

        let recaudado = 0;
        let numInversores = 0;
        let porcentaje = 0;

        if (producto.etapas) {
            recaudado = Number(producto.etapas.tierra?.montoRecaudado || 0) +
                        Number(producto.etapas.construccion?.montoRecaudado || 0);
            const meta = Number(producto.etapas.tierra?.montoObjetivo || 0) +
                         Number(producto.etapas.construccion?.montoObjetivo || 0);
            numInversores = (producto.etapas.tierra?.numeroSociosActuales || 0) +
                            (producto.etapas.construccion?.numeroSociosActuales || 0);
            porcentaje = meta > 0 ? Math.min(Math.round((recaudado / meta) * 100), 100) : 0;
        } else {
            const inversoresArr = Array.isArray(producto.inversores) ? producto.inversores : [];
            numInversores = inversoresArr.length;
            if (capitalTotal > 0) {
                inversoresArr.forEach((inv: any) => {
                    recaudado += (Number(inv.cubos || 0) * capitalTotal) / 100;
                });
            }
            porcentaje = capitalTotal > 0 ? Math.min(Math.round((recaudado / capitalTotal) * 100), 100) : 0;
        }

        const roiProyectado = producto.utilidadNeta && capitalTotal > 0
            ? Math.round((Number(producto.utilidadNeta) / capitalTotal) * 100)
            : 15;

        const isLiquidado = producto.estado === false;
        const isFinanciado = porcentaje >= 100 && !isLiquidado;

        return { recaudado, numInversores, porcentaje, roiProyectado, isLiquidado, isFinanciado, capitalTotal };
    };

    const getFirstImage = (urlimagen: string | string[]) => {
        if (Array.isArray(urlimagen)) return urlimagen[0] || '';
        return urlimagen || '';
    };

    const formatMonto = (n: number) =>
        `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

    if (!productos || productos.length === 0) return null;

    return (
        <section className="relative overflow-hidden py-10" aria-label="Proyectos Destacados">

            {/* Fondo decorativo sutil */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-7xl mx-auto px-4 relative">

                {/* ── Header compacto ── */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full" />
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                Proyectos Destacados
                            </h2>
                        </div>
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold">
                            <FaStar size={9} />
                            Top {productos.length}
                        </span>
                    </div>

                    {/* Controles integrados al header */}
                    <div className="flex items-center gap-2">
                        {/* Indicador de slide actual */}
                        <span className="hidden sm:block text-xs text-slate-500 tabular-nums mr-1">
                            {selectedIndex + 1} / {scrollSnaps.length}
                        </span>
                        <button
                            onClick={scrollPrev}
                            className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white transition-all duration-200 hover:scale-105 active:scale-95"
                            aria-label="Anterior"
                        >
                            <FaChevronLeft size={12} />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white transition-all duration-200 hover:scale-105 active:scale-95"
                            aria-label="Siguiente"
                        >
                            <FaChevronRight size={12} />
                        </button>
                    </div>
                </div>

                {/* ── Carousel ── */}
                <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
                    <div className="flex gap-4">
                        {productos.map((producto) => {
                            const { recaudado, numInversores, porcentaje, roiProyectado, isLiquidado, isFinanciado, capitalTotal } = getProjectData(producto);
                            const imagen = getFirstImage(producto.urlimagen);
                            const votos = Array.isArray(producto.votos) ? producto.votos.length : 0;

                            // Color de barra según estado
                            const barColor = isLiquidado
                                ? 'from-slate-500 to-slate-400'
                                : porcentaje >= 100 ? 'from-amber-500 to-orange-400'
                                : porcentaje >= 70 ? 'from-emerald-500 to-teal-400'
                                : 'from-blue-500 to-indigo-400';

                            return (
                                <div
                                    key={producto.id}
                                    className="flex-[0_0_100%] sm:flex-[0_0_calc(50%-8px)] lg:flex-[0_0_calc(33.333%-11px)] min-w-0"
                                >
                                    <Link href={`/productos/${producto.id}`} className="block h-full group">
                                        {/* ── Tarjeta: altura reducida ~20% (de 400px → 320px) ── */}
                                        <article className="relative h-[320px] rounded-xl overflow-hidden border border-slate-700/60 shadow-xl transition-all duration-300 hover:border-slate-500/70 hover:shadow-slate-900/30 hover:-translate-y-0.5">

                                            {/* Imagen de fondo */}
                                            {imagen ? (
                                                <img
                                                    src={imagen}
                                                    alt={producto.nombre}
                                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-slate-600">
                                                    <FaMapMarkerAlt size={32} />
                                                </div>
                                            )}

                                            {/* Gradiente escalonado: más opaco abajo */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />

                                            {/* Badges — top left */}
                                            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold rounded-md border border-white/10 backdrop-blur-sm
                                                    ${isLiquidado ? 'bg-slate-700/90 text-slate-300' :
                                                      isFinanciado ? 'bg-amber-500/90 text-white' :
                                                      'bg-blue-600/90 text-white'}`}>
                                                    {isLiquidado ? '✓ LIQUIDADO' : isFinanciado ? '⚡ FINANCIADO' : '● EN CURSO'}
                                                </span>
                                                {producto.categoria && (
                                                    <span className="px-2 py-0.5 bg-slate-900/80 text-blue-300 border border-blue-500/20 text-[9px] font-bold rounded-md backdrop-blur-sm">
                                                        {CATEGORIA_LABELS[producto.categoria] || producto.categoria}
                                                    </span>
                                                )}
                                            </div>

                                            {/* ROI badge — top right */}
                                            <div className="absolute top-3 right-3 z-10">
                                                <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-md backdrop-blur-sm">
                                                    <FaChartLine className="text-emerald-400" size={9} />
                                                    <span className="text-emerald-400 font-bold text-[10px]">~{roiProyectado}% ROI</span>
                                                </div>
                                            </div>

                                            {/* Contenido inferior */}
                                            <div className="absolute bottom-0 left-0 right-0 z-10 p-4">

                                                {/* Empresa */}
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className="text-blue-400 text-xs font-semibold">{producto.empresa}</span>
                                                    {producto.creador?.verified && (
                                                        <FaCheckCircle className="text-blue-500" size={10} />
                                                    )}
                                                </div>

                                                {/* Título */}
                                                <h3 className="text-white font-bold text-base leading-snug line-clamp-1 group-hover:text-blue-300 transition-colors duration-200 mb-2">
                                                    {producto.nombre}
                                                </h3>

                                                {/* Barra de progreso real */}
                                                <div className="mb-2.5">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] text-slate-400">Recaudado</span>
                                                        <span className={`text-[10px] font-bold tabular-nums
                                                            ${porcentaje >= 100 ? 'text-amber-400' : 'text-blue-400'}`}>
                                                            {porcentaje}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            style={{ width: `${porcentaje}%` }}
                                                            className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000`}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span className="text-white text-[10px] font-semibold tabular-nums">{formatMonto(recaudado)}</span>
                                                        <span className="text-slate-500 text-[10px] tabular-nums">meta {formatMonto(capitalTotal)}</span>
                                                    </div>
                                                </div>

                                                {/* Footer: stats + CTA */}
                                                <div className="flex items-center justify-between pt-2 border-t border-white/8">
                                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <FaUsers size={10} className="text-slate-500" />
                                                            <span className="tabular-nums">{numInversores}</span>
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            ❤️ <span className="tabular-nums">{votos}</span>
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all duration-200
                                                        ${isLiquidado
                                                            ? 'bg-slate-700 text-slate-400'
                                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white group-hover:from-blue-500 group-hover:to-indigo-500 shadow-md shadow-blue-900/30'
                                                        }`}>
                                                        {isLiquidado ? 'Ver detalle' : 'Invertir →'}
                                                    </span>
                                                </div>
                                            </div>
                                        </article>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Indicadores compactos ── */}
                <div className="flex items-center justify-center gap-1.5 mt-5">
                    {scrollSnaps.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => scrollTo(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 hover:opacity-100 ${
                                index === selectedIndex
                                    ? 'w-6 bg-blue-500'
                                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                            }`}
                            aria-label={`Ir al proyecto ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
