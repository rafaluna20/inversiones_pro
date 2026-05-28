'use client';

import { useState } from 'react';
import { FaHome, FaBuilding, FaStore, FaTree, FaCity, FaFilter } from 'react-icons/fa';
import { CategoriaProducto } from '@/types';

interface QuickFiltersProps {
    onFilterChange: (categoria: CategoriaProducto | 'todos') => void;
    resultCount: number;
}

const categorias = [
    { id: 'todos' as const, label: 'Todos', icon: FaFilter, color: 'from-slate-500 to-slate-600' },
    { id: 'casa' as const, label: 'Casas', icon: FaHome, color: 'from-blue-500 to-blue-600' },
    { id: 'departamento' as const, label: 'Departamentos', icon: FaBuilding, color: 'from-purple-500 to-purple-600' },
    { id: 'localComercial' as const, label: 'Locales', icon: FaStore, color: 'from-green-500 to-green-600' },
    { id: 'terreno' as const, label: 'Terrenos', icon: FaTree, color: 'from-emerald-500 to-emerald-600' },
    { id: 'oficina' as const, label: 'Oficinas', icon: FaCity, color: 'from-orange-500 to-orange-600' },
];

export default function QuickFilters({ onFilterChange, resultCount }: QuickFiltersProps) {
    const [activeFilter, setActiveFilter] = useState<CategoriaProducto | 'todos'>('todos');

    const handleFilterClick = (categoria: CategoriaProducto | 'todos') => {
        setActiveFilter(categoria);
        onFilterChange(categoria);
    };

    return (
        <section className="py-8 bg-slate-900/50 backdrop-blur-sm border-y border-white/5">
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                            Filtros Rápidos
                        </h3>
                        <p className="text-sm text-slate-400">
                            {resultCount} {resultCount === 1 ? 'proyecto encontrado' : 'proyectos encontrados'}
                        </p>
                    </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap gap-3">
                    {categorias.map((categoria, index) => {
                        const Icon = categoria.icon;
                        const isActive = activeFilter === categoria.id;

                        return (
                            <button
                                key={categoria.id}
                                onClick={() => handleFilterClick(categoria.id)}
                                className={`
                                    relative px-6 py-3 rounded-xl font-semibold text-sm
                                    transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95
                                    ${isActive
                                        ? `bg-gradient-to-r ${categoria.color} text-white shadow-lg`
                                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                                    }
                                `}
                            >
                                <span className="flex items-center gap-2">
                                    <Icon size={16} />
                                    {categoria.label}
                                    {isActive && (
                                        <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                                            ✓
                                        </span>
                                    )}
                                </span>

                                {/* Efecto de brillo cuando activo */}
                                {isActive && (
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
