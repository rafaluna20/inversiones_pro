'use client';

import { formatCurrency } from '@/lib/utils';

interface MobileInvestmentCTAProps {
    precio: number;
    precioPorCubo: number;
    cubosDisponibles: number;
    onInvertir: () => void;
    yaInvirtio: boolean;
    esCreador: boolean;
    estado: boolean;
    show: boolean;
    fechaLimite?: number;
}

export default function MobileInvestmentCTA({
    precio,
    precioPorCubo,
    cubosDisponibles,
    onInvertir,
    yaInvirtio,
    esCreador,
    estado,
    show,
    fechaLimite
}: MobileInvestmentCTAProps) {
    if (!estado && !esCreador) return null;

    const estaCompleto = cubosDisponibles === 0 && estado;
    const estaExpirado = fechaLimite ? Date.now() > fechaLimite : false;

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 z-40 lg:hidden shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] transition-transform duration-300 ${
                show ? 'translate-y-0' : 'translate-y-full'
            }`}
        >
            <div className="flex items-center gap-4 max-w-md mx-auto">
                <div className="flex-1">
                    {esCreador ? (
                        <p className="text-sm text-purple-400 font-semibold">
                            <i className="bx bx-crown mr-1"></i>
                            Tu Proyecto
                        </p>
                    ) : estaCompleto ? (
                        <p className="text-sm font-bold text-yellow-300">¡Meta Alcanzada!</p>
                    ) : estaExpirado ? (
                        <p className="text-sm font-bold text-red-300">Proyecto Expirado</p>
                    ) : (
                        <p className="text-sm text-gray-400">Inversión desde</p>
                    )}
                    
                    {!(estaCompleto || estaExpirado) || esCreador ? (
                        <p className="text-xl font-bold text-white">
                            {formatCurrency(precioPorCubo)}
                        </p>
                    ) : (
                        <p className="text-xs text-gray-400">Ya no acepta inversiones</p>
                    )}
                </div>

                {esCreador ? (
                    <div className="px-6 py-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold rounded-xl flex items-center gap-2">
                        <i className="bx bx-check-shield"></i>
                        Admin
                    </div>
                ) : estaExpirado && !estaCompleto ? (
                    <div className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl flex items-center gap-2">
                        <i className="bx bx-time-five"></i>
                        Expirado
                    </div>
                ) : estaCompleto ? (
                    <div className="px-6 py-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold rounded-xl flex items-center gap-2">
                        <i className="bx bx-lock-alt"></i>
                        Agotado
                    </div>
                ) : (
                    <button
                        onClick={onInvertir}
                        disabled={yaInvirtio}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-transform"
                    >
                        {yaInvirtio ? 'Ver Inversión' : 'Invertir Ahora'}
                    </button>
                )}
            </div>
        </div>
    );
}
