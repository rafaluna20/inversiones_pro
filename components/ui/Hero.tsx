'use client';

import Link from 'next/link';
import { FaRocket } from 'react-icons/fa';

export default function Hero() {
    return (
        <section className="relative overflow-hidden py-20 mb-16">
            <div className="absolute inset-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative container mx-auto px-4">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <div className="flex justify-center">
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-500/30">
                            <FaRocket className="w-16 h-16 text-blue-400" />
                        </div>
                    </div>

                    <h1 className="text-5xl lg:text-7xl font-bold">
                        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Descubre e Invierte
                        </span>
                        <br />
                        <span className="text-white">en Proyectos Innovadores</span>
                    </h1>

                    <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        Conecta con emprendedores, descubre oportunidades Ãºnicas y forma parte
                        del futuro de la innovaciÃ³n empresarial
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
                        <Link
                            href="/productos/nuevo"
                            className="px-8 py-4 rounded-xl font-semibold text-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-105"
                        >
                            Publicar Proyecto
                        </Link>
                        <Link
                            href="/populares"
                            className="px-8 py-4 rounded-xl font-semibold text-lg bg-white/5 hover:bg-white/10 text-white border border-white/20 backdrop-blur-sm transition-all duration-300"
                        >
                            Explorar Proyectos
                        </Link>
                    </div>

                    <div className="grid grid-cols-3 gap-8 pt-16 max-w-3xl mx-auto">
                        {[
                            { label: 'Proyectos Activos', value: '500+' },
                            { label: 'Inversores', value: '1,200+' },
                            { label: 'InversiÃ³n Total', value: 'S/ 2M+' },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className="p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
                            >
                                <div className="text-3xl lg:text-4xl font-bold text-blue-400 mb-2">
                                    {stat.value}
                                </div>
                                <div className="text-sm text-slate-400">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
