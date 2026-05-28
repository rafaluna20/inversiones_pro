'use client';

import { useState } from 'react';
import useProductos from '@/Hooks/useProductos';
import ProductCard from '@/components/productos/ProductCard';
import useAutenticacion from '@/Hooks/useAutenticacion';
import { FaFire, FaTrophy } from 'react-icons/fa';

export default function PopularesPage() {
    const { productos } = useProductos('votos');
    const { usuario } = useAutenticacion();

    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
            {/* Background Elements */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[10%] right-[10%] w-[600px] h-[600px] bg-orange-600/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[10%] left-[10%] w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-8">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <span className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20 text-orange-400">
                                <FaFire className="text-xl" />
                            </span>
                            <h1 className="text-4xl font-bold text-white font-roboto-slab">
                                Más Populares
                            </h1>
                        </div>
                        <p className="text-gray-400 text-lg">
                            Los proyectos con mayor votación de la comunidad
                        </p>
                    </div>

                    <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
                        <FaTrophy className="text-yellow-400 text-xl" />
                        <span className="text-gray-300 font-medium">Top Tendencias</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {productos.map((producto) => (
                        <ProductCard key={producto.id} producto={producto} usuarioId={usuario?.uid} />
                    ))}
                </div>

                {productos.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-gray-500 text-lg">Cargando proyectos populares...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
