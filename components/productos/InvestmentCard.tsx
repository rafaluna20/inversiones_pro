'use client';

import { formatCurrency } from '@/lib/utils';

interface InvestmentCardProps {
    precio: number;
    recaudado: number;
    porcentajeVendido: number;
    cubosDisponibles: number;
    numInversores: number;
    precioPorCubo: number;
    onInvertir: () => void;
    yaInvirtio: boolean;
    esCreador: boolean;
    estado: boolean;
    fechaLimite?: number;
}

export default function InvestmentCard({
    precio,
    recaudado,
    porcentajeVendido,
    cubosDisponibles,
    numInversores,
    precioPorCubo,
    onInvertir,
    yaInvirtio,
    esCreador,
    estado,
    fechaLimite,
}: InvestmentCardProps) {
    const estaCompleto = cubosDisponibles === 0 && estado;
    const estaExpirado = fechaLimite ? Date.now() > fechaLimite : false;

    return (
        <div
            className={`rounded-2xl p-6 lg:p-8 shadow-2xl transition-all duration-500 ${
                estaCompleto
                    ? 'bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-orange-500/15 border border-yellow-500/40 shadow-yellow-500/10'
                    : 'bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-blue-600/10 border border-blue-500/30 shadow-blue-600/10'
            }`}
        >
            {/* Banner 100% Financiado */}
            {estaCompleto && (
                <div className="mb-5 p-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/40 rounded-xl flex items-center gap-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                        <p className="text-sm font-bold text-yellow-300">¡Meta Alcanzada!</p>
                        <p className="text-xs text-yellow-400/80">Este proyecto está 100% financiado</p>
                    </div>
                    <span className="ml-auto text-2xl">🏆</span>
                </div>
            )}

            {/* Banner Expirado */}
            {estaExpirado && !estaCompleto && estado && (
                <div className="mb-5 p-3 bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/40 rounded-xl flex items-center gap-3">
                    <span className="text-2xl">⏳</span>
                    <div>
                        <p className="text-sm font-bold text-red-300">Tiempo Agotado</p>
                        <p className="text-xs text-red-400/80">El plazo de recaudación ha expirado</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-xl ${estaCompleto ? 'bg-gradient-to-br from-yellow-500 to-amber-500' : 'bg-gradient-to-br from-blue-500 to-purple-500'}`}>
                    <i className={`bx text-3xl text-white ${estaCompleto ? 'bx-trophy' : 'bx-dollar-circle'}`}></i>
                </div>
                <div>
                    <h3 className="text-sm text-gray-400 uppercase tracking-wide font-semibold">
                        {estaCompleto ? 'Proyecto Financiado' : 'Oportunidad de Inversión'}
                    </h3>
                    <p className="text-xs text-gray-500">
                        {estaCompleto ? 'Recaudación completada' : 'Inversión basada en cubos'}
                    </p>
                </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
                <div className="flex justify-between items-baseline mb-3">
                    <div>
                        <p className={`text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${estaCompleto ? 'from-yellow-400 to-amber-400' : 'from-blue-400 to-purple-400'}`}>
                            {formatCurrency(recaudado)}
                        </p>
                        <p className="text-sm text-gray-500">
                            de {formatCurrency(precio)} meta
                        </p>
                    </div>
                    <div className="text-right">
                        <p className={`text-4xl lg:text-5xl font-bold ${estaCompleto ? 'text-yellow-400' : 'text-blue-400'}`}>
                            {porcentajeVendido.toFixed(0)}%
                        </p>
                        <p className="text-xs text-gray-500">financiado</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative w-full h-3 bg-slate-950/50 rounded-full overflow-hidden">
                    <div
                        style={{ width: `${Math.min(porcentajeVendido, 100)}%` }}
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${
                            estaCompleto
                                ? 'bg-gradient-to-r from-yellow-500 via-amber-400 to-orange-400'
                                : 'bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500'
                        }`}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-slate-900/50 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                        <i className={`bx bx-cube ${estaCompleto ? 'text-yellow-400' : 'text-blue-400'}`}></i>
                        <span className="text-xs text-gray-400">Cubos libres</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{cubosDisponibles}</p>
                    <p className="text-xs text-gray-500">de 100 totales</p>
                </div>

                <div className="p-3 bg-slate-900/50 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                        <i className="bx bx-group text-purple-400"></i>
                        <span className="text-xs text-gray-400">Inversores</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{numInversores}</p>
                    <p className="text-xs text-gray-500">participando</p>
                </div>
            </div>

            {/* Price per Cube — solo si no está completo */}
            {!estaCompleto && (
                <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl mb-6">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Inversión desde</span>
                        <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                            {formatCurrency(precioPorCubo)}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Precio por cubo (1% del proyecto)</p>
                </div>
            )}

            {/* === BOTONES CTA según estado === */}

            {/* Activo con cubos disponibles — inversores pueden invertir */}
            {!esCreador && estado && !estaCompleto && !estaExpirado && (
                <button
                    onClick={onInvertir}
                    disabled={yaInvirtio}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    <i className="bx bx-dollar-circle text-2xl"></i>
                    {yaInvirtio ? 'Ya Invertiste en Este Proyecto' : 'Invertir Ahora'}
                </button>
            )}

            {/* Expirado sin llegar al 100% */}
            {!esCreador && estado && !estaCompleto && estaExpirado && (
                <div className="w-full py-4 px-4 bg-gradient-to-r from-red-500/15 to-rose-500/15 border border-red-500/30 rounded-xl text-center">
                    <p className="text-red-300 font-semibold">
                        <i className="bx bx-time-five mr-2"></i>
                        Proyecto Expirado
                    </p>
                    <p className="text-xs text-red-400/70 mt-1">
                        El plazo para invertir ha finalizado
                    </p>
                </div>
            )}

            {/* 100% financiado — cupos agotados (inversores ven esto) */}
            {!esCreador && estaCompleto && (
                <div className="w-full py-4 px-4 bg-gradient-to-r from-yellow-500/15 to-amber-500/15 border border-yellow-500/30 rounded-xl text-center">
                    <p className="text-yellow-300 font-semibold">
                        <i className="bx bx-lock-alt mr-2"></i>
                        Cupos Agotados
                    </p>
                    <p className="text-xs text-yellow-400/70 mt-1">
                        Este proyecto ya no acepta nuevas inversiones
                    </p>
                </div>
            )}

            {/* Proyecto finalizado (distribuidas ganancias, estado=false) */}
            {!esCreador && !estado && (
                <div className="w-full py-4 bg-gray-700/50 text-gray-400 text-center rounded-xl border border-gray-600/30">
                    <i className="bx bx-check-circle text-xl mr-2"></i>
                    Proyecto Finalizado
                </div>
            )}

            {/* Creador */}
            {esCreador && (
                <div className={`p-4 rounded-xl text-center border ${
                    estaCompleto
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-purple-500/10 border-purple-500/20'
                }`}>
                    <i className={`bx bx-crown text-2xl mb-1 block ${estaCompleto ? 'text-yellow-400' : 'text-purple-400'}`}></i>
                    <p className={`text-sm font-semibold ${estaCompleto ? 'text-yellow-300' : 'text-purple-300'}`}>
                        {estaCompleto ? '¡Meta alcanzada! 🎉' : 'Eres el creador'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {estaCompleto
                            ? 'Ve al panel Admin → retira los fondos'
                            : 'Ve al panel de administrador'}
                    </p>
                </div>
            )}

            {/* Trust Indicators */}
            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <i className="bx bx-shield-alt-2 text-green-400"></i>
                    <span>Seguro</span>
                </div>
                <div className="flex items-center gap-1">
                    <i className="bx bx-lock-alt text-blue-400"></i>
                    <span>Encriptado</span>
                </div>
                <div className="flex items-center gap-1">
                    <i className="bx bx-check-shield text-purple-400"></i>
                    <span>Verificado</span>
                </div>
            </div>
        </div>
    );
}
