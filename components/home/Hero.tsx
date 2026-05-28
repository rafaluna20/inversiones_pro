'use client';

import Link from 'next/link';
import { FaArrowRight, FaPlay } from 'react-icons/fa';

export default function Hero() {
    return (
        <section className="relative w-full overflow-hidden py-20 lg:py-32">
            {/* Background Gradients/Elements */}
            <div className="absolute top-0 center w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse-slow"></div>
                <div className="absolute bottom-[20%] right-[10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse-slow delay-1000"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 text-center">

                {/* Badge de Novedad */}
                <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8"
                >
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-sm text-slate-300 font-medium">Plataforma #1 en Inversiones del Perú</span>
                </div>

                {/* Titular Principal */}
                <h1
                    className="text-5xl md:text-7xl lg:text-8xl font-bold font-roboto-slab tracking-tight mb-8"
                >
                    <span className="text-white">Invierte en tu</span>
                    <br />
                    <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Futuro Inmobiliario
                    </span>
                </h1>

                {/* Subtítulo */}
                <p
                    className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 font-pt-sans leading-relaxed"
                >
                    Accede a las mejores oportunidades de inversión en bienes raíces con
                    altos retornos, seguridad jurídica y el respaldo que necesitas.
                </p>

                {/* CTAs */}
                <div
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <Link
                        href="/populares"
                        className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 rounded-xl font-bold text-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 active:scale-95"
                    >
                        Ver Proyectos
                        <FaArrowRight className="text-sm" />
                    </Link>

                    <Link
                        href="/crear-cuenta"
                        className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white border border-white/10 rounded-xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2 backdrop-blur-sm hover:scale-105 active:scale-95"
                    >
                        <FaPlay className="text-xs" />
                        Cómo Funciona
                    </Link>
                </div>

                {/* Stats Rápidos - Social Proof */}
                <div
                    className="mt-16 pt-8 border-t border-white/5 flex flex-wrap justify-center gap-8 md:gap-16"
                >
                    <div>
                        <p className="text-3xl font-bold text-white mb-1">+500</p>
                        <p className="text-xs text-slate-500 uppercase tracking-widest">Inversores</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-white mb-1">+12M</p>
                        <p className="text-xs text-slate-500 uppercase tracking-widest">Gestionados</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-white mb-1">100%</p>
                        <p className="text-xs text-slate-500 uppercase tracking-widest">Seguro</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
