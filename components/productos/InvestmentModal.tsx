'use client';

import { useState } from 'react';
import { showToast } from '@/lib/toast';

interface InvestmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: InversionData) => Promise<void>;
    isEditing?: boolean;
    initialData?: InversionData;
    cubosDisponibles: number;
    precioPorCubo: number;
    saldoUsuario: number;
}

export interface InversionData {
    descripcion: string;
    cubos: number;
    categoria: string;
}

const categorias = ['Inversor', 'Socio', 'Patrocinador', 'Otro'];

export default function InvestmentModal({
    isOpen,
    onClose,
    onSubmit,
    isEditing = false,
    initialData,
    cubosDisponibles,
    precioPorCubo,
    saldoUsuario,
}: InvestmentModalProps) {
    const [formData, setFormData] = useState<InversionData>(
        initialData || {
            descripcion: '',
            cubos: 0.0001,
            categoria: 'Inversor',
        }
    );
    const [processing, setProcessing] = useState(false);

    const costoTotal = formData.cubos * precioPorCubo;
    const porcentajeParticipacion = (formData.cubos / 100) * 100;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validaciones
        if (!formData.descripcion.trim()) {
            showToast.error('Ingresa una descripción');
            return;
        }

        if (formData.cubos < 0.0001) {
            showToast.error('Debes invertir al menos 0.0001 cubos');
            return;
        }

        if (formData.cubos > cubosDisponibles) {
            showToast.error(`Solo hay ${cubosDisponibles} cubos disponibles`);
            return;
        }

        if (costoTotal > saldoUsuario && !isEditing) {
            showToast.error('Saldo insuficiente');
            return;
        }

        setProcessing(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error) {
            console.error('Error al procesar inversión:', error);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-lg w-full"
                onClick={(e) => e.stopPropagation()}
            >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                            <i className="bx bx-dollar-circle text-blue-400"></i>
                            {isEditing ? 'Editar Inversión' : 'Nueva Inversión'}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition"
                            aria-label="Cerrar"
                        >
                            <i className="bx bx-x text-3xl"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Descripción */}
                        <div>
                            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-300 mb-2">
                                Descripción
                            </label>
                            <input
                                id="descripcion"
                                type="text"
                                value={formData.descripcion}
                                onChange={(e) =>
                                    setFormData({ ...formData, descripcion: e.target.value })
                                }
                                className="input"
                                placeholder="Ej: Inversión inicial"
                                maxLength={100}
                                required
                            />
                        </div>

                        {/* Cantidad de Cubos */}
                        <div>
                            <label htmlFor="cubos" className="block text-sm font-medium text-gray-300 mb-2">
                                Cantidad de Cubos
                            </label>
                            <input
                                id="cubos"
                                type="number"
                                step="0.0001"
                                value={formData.cubos}
                                onChange={(e) => {
                                    const valor = parseFloat(e.target.value) || 0.0001;
                                    const redondeado = Math.round(valor * 10000) / 10000;
                                    setFormData({ ...formData, cubos: redondeado });
                                }}
                                className="input"
                                min={0.0001}
                                max={cubosDisponibles}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Disponibles: {cubosDisponibles.toFixed(4)} cubos | Mínimo: 0.0001 cubos
                            </p>
                        </div>

                        {/* Categoría */}
                        <div>
                            <label htmlFor="categoria" className="block text-sm font-medium text-gray-300 mb-2">
                                Categoría
                            </label>
                            <select
                                id="categoria"
                                value={formData.categoria}
                                onChange={(e) =>
                                    setFormData({ ...formData, categoria: e.target.value })
                                }
                                className="input"
                                required
                            >
                                {categorias.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Resumen */}
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Precio por cubo:</span>
                                <span className="text-white font-semibold">
                                    S/ {precioPorCubo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Cubos:</span>
                                <span className="text-blue-400 font-semibold">
                                    {formData.cubos.toFixed(4)} cubos
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Participación:</span>
                                <span className="text-blue-400 font-semibold">
                                    {porcentajeParticipacion.toFixed(4)}%
                                </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-white/10">
                                <span className="text-gray-300 font-medium">Total:</span>
                                <span className="text-xl text-white font-bold">
                                    S/ {costoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Tu saldo:</span>
                                <span className={saldoUsuario >= costoTotal ? 'text-green-400' : 'text-red-400'}>
                                    S/ {saldoUsuario.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={processing || costoTotal > saldoUsuario}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? 'Procesando...' : isEditing ? 'Actualizar' : 'Invertir'}
                            </button>
                        </div>
                    </form>
            </div>
        </div>
    );
}
