'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface Inversor {
    usuarioId: string;
    usuarioNombre: string;
    cubos: number;
    descripcion: string;
    categoria: string;
    fecha: number;
    icono?: string;
}

interface InvestorListProps {
    inversores: Inversor[];
    currentUserId?: string;
    onEdit?: (inversor: Inversor) => void;
    onDelete?: (inversor: Inversor) => void;
    totalCubos: number;
    precio: number;
}

export default function InvestorList({
    inversores,
    currentUserId,
    onEdit,
    onDelete,
    totalCubos,
    precio,
}: InvestorListProps) {
    const porcentajeVendido = (totalCubos / 100) * 100;

    return (
        <div className="space-y-6">
            {/* Progress Circular */}
            <div className="flex items-center gap-6 p-6 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl">
                <div className="w-32 h-32 flex-shrink-0">
                    <CircularProgressbar
                        value={porcentajeVendido}
                        text={`${porcentajeVendido.toFixed(0)}%`}
                        styles={buildStyles({
                            textColor: '#60a5fa',
                            pathColor: '#3b82f6',
                            trailColor: '#1e293b',
                            textSize: '20px',
                        })}
                    />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">Financiamiento</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Cubos vendidos:</span>
                            <span className="text-white font-semibold">{totalCubos} / 100</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Inversores:</span>
                            <span className="text-white font-semibold">{inversores.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Recaudado:</span>
                            <span className="text-green-400 font-semibold">
                                S/ {((totalCubos * precio) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Inversores */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <i className="bx bx-group text-blue-400"></i>
                    Inversores ({inversores.length})
                </h3>

                {inversores.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <i className="bx bx-user-x text-6xl mb-3 opacity-30"></i>
                        <p>Aún no hay inversores en este proyecto</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {inversores.map((inversor, index) => {
                            const esInversorActual = inversor.usuarioId === currentUserId;
                            const porcentaje = (inversor.cubos / 100) * 100;
                            const montoInvertido = (inversor.cubos * precio) / 100;

                            return (
                                <div
                                    key={index}
                                    className={`p-4 rounded-xl border transition-all ${esInversorActual
                                            ? 'bg-blue-500/10 border-blue-500/30'
                                            : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <img
                                            src={inversor.icono || '/static/img/imagenPerfil.png'}
                                            alt={inversor.usuarioNombre}
                                            className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/30"
                                        />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-white truncate">
                                                    {inversor.usuarioNombre}
                                                </h4>
                                                {esInversorActual && (
                                                    <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                                        Tú
                                                    </span>
                                                )}
                                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                                                    {inversor.categoria}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 mb-2 break-words">
                                                {inversor.descripcion}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <i className="bx bx-cube text-blue-400"></i>
                                                    <span className="text-white font-semibold">{inversor.cubos} cubos</span>
                                                    <span className="text-gray-500">({porcentaje.toFixed(2)}%)</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <i className="bx bx-dollar text-green-400"></i>
                                                    <span className="text-green-400 font-semibold">
                                                        S/ {montoInvertido.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <time className="text-xs text-gray-500">
                                                    Hace {formatDistanceToNow(new Date(inversor.fecha), { locale: es })}
                                                </time>
                                            </div>
                                        </div>

                                        {/* Acciones (solo para el inversor actual) */}
                                        {esInversorActual && onEdit && onDelete && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onEdit(inversor)}
                                                    className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition"
                                                    aria-label="Editar inversión"
                                                >
                                                    <i className="bx bx-edit text-xl"></i>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('¿Eliminar tu inversión? Se devolverá el monto completo.')) {
                                                            onDelete(inversor);
                                                        }
                                                    }}
                                                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                                                    aria-label="Eliminar inversión"
                                                >
                                                    <i className="bx bx-trash text-xl"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
