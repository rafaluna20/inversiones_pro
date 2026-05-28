'use client';

import { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { FaChevronLeft, FaChevronRight, FaBuilding, FaStore, FaHome, FaCity } from 'react-icons/fa';
import Link from 'next/link';

interface Slide {
    image: string;
    alt: string;
}

interface Category {
    id: string;
    label: string;
    icon: any;
    link: string;
}

const slides: Slide[] = [
    { image: '/static/img/familia.jpg', alt: 'Familia invirtiendo en proyectos' },
    { image: '/static/img/casa.jpg', alt: 'Casas para inversión' },
    { image: '/static/img/departamento.jpg', alt: 'Departamentos modernos' },
    { image: '/static/img/recreacion.jpg', alt: 'Áreas de recreación' },
];

const categories: Category[] = [
    { id: 'departamento', label: 'Departamento', icon: FaBuilding, link: '/productos/filtro?categoria=departamento' },
    { id: 'localComercial', label: 'Local Comercial', icon: FaStore, link: '/productos/filtro?categoria=localComercial' },
    { id: 'oficina', label: 'Oficina', icon: FaCity, link: '/productos/filtro?categoria=oficina' },
    { id: 'casa', label: 'Casa', icon: FaHome, link: '/productos/filtro?categoria=casa' },
];

export default function CategorySlider() {
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true },
        [Autoplay({ delay: 3000, stopOnInteraction: false })]
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

    return (
        <section className="relative w-full bg-black">
            <div className="relative w-full h-[300px] md:h-[350px] lg:h-[400px]">
                {/* Categorías superiores */}
                <div className="absolute top-0 left-0 right-0 z-20">
                    <div className="flex items-center justify-center gap-2 md:gap-4 lg:gap-8 py-4 px-4 bg-gradient-to-b from-black/80 via-black/60 to-transparent backdrop-blur-sm">
                        {categories.map((category, index) => {
                            const Icon = category.icon;
                            return (
                                <div key={category.id}>
                                    <Link
                                        href={category.link}
                                        className="flex flex-col items-center gap-2 px-3 py-2 md:px-6 md:py-3 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl transition-all hover:scale-105 hover:-translate-y-0.5 active:scale-95 group"
                                    >
                                        <Icon className="text-white text-xl md:text-2xl group-hover:text-blue-400 transition-colors" />
                                        <span className="text-white text-xs md:text-sm font-semibold whitespace-nowrap">
                                            {category.label}
                                        </span>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Slider de imágenes */}
                <div className="overflow-hidden h-full" ref={emblaRef}>
                    <div className="flex h-full">
                        {slides.map((slide, index) => (
                            <div key={index} className="flex-[0_0_100%] min-w-0 h-full">
                                <div className="relative w-full h-full">
                                    <img
                                        src={slide.image}
                                        alt={slide.alt}
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Overlay gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/70" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Overlay con mensaje y CTA */}
                <div className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none">
                    <div className="text-center text-white max-w-4xl px-6 md:px-8">
                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 leading-tight">
                            Invierte en el <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">Futuro</span>
                        </h1>
                        <p className="text-lg md:text-xl lg:text-2xl mb-6 md:mb-10 text-slate-200 font-medium">
                            Descubre proyectos innovadores y conecta con emprendedores
                        </p>
                        <div className="pointer-events-auto">
                            <Link href="/productos/filtro">
                                <button
                                    className="px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 rounded-xl md:rounded-2xl font-bold text-base md:text-lg shadow-2xl shadow-blue-500/50 transition-all hover:scale-105 active:scale-95"
                                >
                                    Explorar Proyectos →
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Controles de navegación */}
                <button
                    onClick={scrollPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 md:p-4 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 rounded-full text-white transition-all hover:scale-110 active:scale-90"
                    aria-label="Imagen anterior"
                >
                    <FaChevronLeft size={20} />
                </button>

                <button
                    onClick={scrollNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 md:p-4 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 rounded-full text-white transition-all hover:scale-110 active:scale-90"
                    aria-label="Siguiente imagen"
                >
                    <FaChevronRight size={20} />
                </button>

                {/* Indicadores de página (dots) */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
                    {scrollSnaps.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => scrollTo(index)}
                            className={`h-2 rounded-full transition-all duration-300 hover:scale-125 active:scale-90 ${
                                index === selectedIndex
                                    ? 'w-8 bg-white'
                                    : 'w-2 bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`Ir a imagen ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
