'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '@/lib/toast';

interface PriceEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (nuevoPrecio: number) => Promise<void>;
    precioActual: number;
}

export default function PriceEditModal({
    isOpen,
    onClose,
    onSubmit,
    precioActual,
}: PriceEditModalProps) {
    const [nuevoPrecio, setNuevoPrecio] = useState(precioActual.toString());
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const precio = parseFloat(nuevoPrecio);

        if (isNaN(precio) || precio <= 0) {
            showToast.error('Ingresa un precio válido');
            return;
        }

        if (precio === precioActual) {
            showToast.info('El precio no ha cambiado');
            return;
        }

        if (!confirm(`¿Cambiar el precio de S/ ${precioActual} a S/ ${precio}?`)) {
            return;
        }

        setProcessing(true);
        try {
            await onSubmit(precio);
            showToast.success('Precio actualizado exitosamente');
            onClose();
        } catch (error) {
            console.error('Error al actualizar precio:', error);
            showToast.error('Error al actualizar precio');
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                            <i className="bx bx-edit text-purple-400"></i>
                            Modificar Precio
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
                        <div>
                            <label htmlFor="precio" className="block text-sm font-medium text-gray-300 mb-2">
                                Nuevo Precio del Proyecto
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">S/</span>
                                <input
                                    id="precio"
                                    type="number"
                                    value={nuevoPrecio}
                                    onChange={(e) => setNuevoPrecio(e.target.value)}
                                    className="input pl-10"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="1"
                                    required
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Precio actual: S/ {precioActual.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        {nuevoPrecio && !isNaN(parseFloat(nuevoPrecio)) && parseFloat(nuevoPrecio) > 0 && (
                            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Precio anterior:</span>
                                    <span className="text-white font-semibold">
                                        S/ {precioActual.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Precio nuevo:</span>
                                    <span className="text-purple-400 font-semibold">
                                        S/ {parseFloat(nuevoPrecio).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                                    <span className="text-gray-400">Nuevo precio por cubo:</span>
                                    <span className="text-white font-semibold">
                                        S/ {(parseFloat(nuevoPrecio) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        )}

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
                                disabled={processing || !nuevoPrecio}
                                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? 'Actualizando...' : 'Actualizar'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
