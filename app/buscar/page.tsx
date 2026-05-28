'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useProductos from '@/Hooks/useProductos';
import ProductCard from '@/components/productos/ProductCard';
import useAutenticacion from '@/Hooks/useAutenticacion';
import { FaSearch, FaRegCompass } from 'react-icons/fa';
import Link from 'next/link';

export default function BuscarPage() {
    const searchParams = useSearchParams();
    const q = searchParams.get('q');
    const { productos } = useProductos('creado');
    const [resultado, setResultado] = useState<any[]>([]);
    const { usuario } = useAutenticacion();

    useEffect(() => {
        if (!q) {
            setResultado([]);
            return;
        }

        const busqueda = q.toLowerCase();
        const filtro = productos.filter((producto: any) => {
            return (
                producto.nombre.toLowerCase().includes(busqueda) ||
                producto.descripcion.toLowerCase().includes(busqueda) ||
                producto.empresa?.toLowerCase().includes(busqueda)
            );
        });
        setResultado(filtro);
    }, [q, productos]);

    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
            {/* Background Elements */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900/50 border border-white/10 mb-6 shadow-lg shadow-blue-500/10">
                        <FaSearch className="text-3xl text-blue-400" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab">
                        Resultados de Búsqueda
                    </h1>
                    <p className="text-gray-400 text-lg">
                        {q ? (
                            <>Resultados para: <span className="text-blue-400 font-semibold">"{q}"</span></>
                        ) : (
                            "Ingresa un término para buscar proyectos"
                        )}
                    </p>
                </div>

                {resultado.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[32px] text-center p-8 mx-auto max-w-2xl">
                        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                            <FaRegCompass className="text-5xl text-gray-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4 font-roboto-slab">
                            {q ? "No se encontraron resultados" : "Comienza tu búsqueda"}
                        </h3>
                        <p className="text-gray-400 mb-8 max-w-md mx-auto">
                            {q ? "Intenta con otros términos o explora nuestros proyectos destacados." : "Busca por nombre de proyecto, ubicación o empresa desarrolladora."}
                        </p>
                        <Link
                            href="/"
                            className="inline-flex py-3 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all"
                        >
                            Ver Todos los Proyectos
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {resultado.map((producto) => (
                            <ProductCard key={producto.id} producto={producto} usuarioId={usuario?.uid} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
