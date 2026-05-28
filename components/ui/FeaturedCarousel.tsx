'use client';

import { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import Link from 'next/link';
import { Producto } from '@/types';

interface FeaturedCarouselProps {
    productos: Producto[];
}

export default function FeaturedCarousel({ productos }: FeaturedCarouselProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { 
            loop: true,
            align: 'start',
            skipSnaps: false,
        },
        [Autoplay({ delay: 4000, stopOnInteraction: false })]
    );

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

    const scrollPrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const scrollTo = useCallback(
        (index: number) => {
            if (emblaApi) emblaApi.scrollTo(index);
        },
        [emblaApi]
    );

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

        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('reInit', onSelect);
        };
    }, [emblaApi, onSelect]);

    const formatearPrecio = (precio: number | string) => {
        const num = typeof precio === 'string' ? parseFloat(precio) : precio;
        return num.toLocaleString('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
    };

    // Obtener primera imagen
    const getFirstImage = (urlimagen: string | string[]) => {
        if (Array.isArray(urlimagen)) return urlimagen[0];
        return urlimagen;
    };

    if (!productos || productos.length === 0) return null;

    return (
        <section className="py-12 relative overflow-hidden">
            {/* Background decorativo */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-pink-900/10" />
            
            <div className="max-w-7xl mx-auto px-4 relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                            ✨ Proyectos Destacados
                        </h2>
                        <p className="text-slate-400">
                            Los proyectos más populares y recientes de la plataforma
                        </p>
                    </div>

                    {/* Controles Desktop */}
                    <div className="hidden md:flex items-center gap-3">
                        <button
                            onClick={scrollPrev}
                            className="p-3 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-white transition-all hover:scale-110 active:scale-90"
                            aria-label="Proyecto anterior"
                        >
                            <FaChevronLeft size={20} />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="p-3 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-white transition-all hover:scale-110 active:scale-90"
                            aria-label="Siguiente proyecto"
                        >
                            <FaChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Carousel */}
                <div className="overflow-hidden" ref={emblaRef}>
                    <div className="flex gap-6">
                        {productos.map((producto, index) => (
                            <div
                                key={producto.id}
                                className="flex-[0_0_100%] md:flex-[0_0_calc(50%-12px)] lg:flex-[0_0_calc(33.333%-16px)] min-w-0"
                            >
                                <Link href={`/productos/${producto.id}`}>
                                    <article className="group relative h-[400px] rounded-2xl overflow-hidden shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02]">
                                        {/* Imagen de fondo */}
                                        <div className="absolute inset-0">
                                            <img
                                                src={getFirstImage(producto.urlimagen)}
                                                alt={producto.nombre}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                            {/* Gradient overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                                        </div>

                                        {/* Contenido */}
                                        <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
                                            {/* Badges */}
                                            <div className="absolute top-4 left-4 flex gap-2">
                                                {Array.isArray(producto.votos) && producto.votos.length >= 10 && (
                                                    <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full">
                                                        🔥 POPULAR
                                                    </span>
                                                )}
                                            </div>

                                            {/* Empresa */}
                                            <p className="text-blue-400 font-semibold text-sm mb-2">
                                                {producto.empresa}
                                            </p>

                                            {/* Título */}
                                            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3 line-clamp-2 group-hover:text-blue-400 transition-colors">
                                                {producto.nombre}
                                            </h3>

                                            {/* Descripción */}
                                            <p className="text-slate-300 text-sm line-clamp-2 mb-4">
                                                {producto.descripcion}
                                            </p>

                                            {/* Footer */}
                                            <div className="flex items-center justify-between">
                                                {/* Precio */}
                                                {producto.precio && (
                                                    <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/30 rounded-full">
                                                        <span className="text-green-400 font-bold text-lg">
                                                            {formatearPrecio(producto.precio)}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Stats */}
                                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                                    <span>❤️ {Array.isArray(producto.votos) ? producto.votos.length : 0}</span>
                                                    <span>💬 {producto.comentarios?.length || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Indicadores */}
                <div className="flex items-center justify-center gap-2 mt-8">
                    {scrollSnaps.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => scrollTo(index)}
                            className={`h-2 rounded-full transition-all duration-300 hover:scale-125 active:scale-90 ${
                                index === selectedIndex
                                    ? 'w-8 bg-blue-500'
                                    : 'w-2 bg-white/30 hover:bg-white/50'
                            }`}
                            aria-label={`Ir al proyecto ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
