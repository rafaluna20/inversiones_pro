'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '@/lib/toast';
import { FaInfoCircle, FaCoins, FaArrowRight, FaWallet, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import Link from 'next/link';

interface ProfitDistributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (gananciaTotal: number, aportarGanancia: boolean) => Promise<void>;
    numInversores: number;
    saldoCreador: number;
    precioProyecto: number;
}

export default function ProfitDistributionModal({
    isOpen,
    onClose,
    onSubmit,
    numInversores,
    saldoCreador,
    precioProyecto,
}: ProfitDistributionModalProps) {
    const [montoVentaTotal, setMontoVentaTotal] = useState('');
    const [aportarGanancia, setAportarGanancia] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (isOpen && precioProyecto) {
            setMontoVentaTotal(precioProyecto.toString());
        }
    }, [isOpen, precioProyecto]);

    const valorVenta = parseFloat(montoVentaTotal);
    const isValidMonto = !isNaN(valorVenta) && valorVenta > 0;
    const gananciaNeta = isValidMonto ? valorVenta - precioProyecto : 0;
    const roi = precioProyecto > 0 && isValidMonto ? (gananciaNeta / precioProyecto) * 100 : 0;
    
    // Si aporta ganancia, el saldo disponible sube por la ganancia neta depositada
    const saldoIntermedio = (aportarGanancia && gananciaNeta > 0) ? saldoCreador + gananciaNeta : saldoCreador;
    const saldoFinal = isValidMonto ? saldoIntermedio - valorVenta : saldoCreador;
    const isSaldoInsuficiente = isValidMonto && valorVenta > saldoIntermedio;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValidMonto) {
            showToast.error('Ingresa un monto válido');
            return;
        }

        if (valorVenta < precioProyecto) {
            showToast.error(`El monto de venta debe ser igual o mayor al capital invertido (S/ ${precioProyecto.toLocaleString('es-PE')})`);
            return;
        }

        if (valorVenta > saldoIntermedio) {
            showToast.error('Saldo insuficiente en la plataforma para realizar la liquidación');
            return;
        }

        const mensajeConfirmacion = aportarGanancia && gananciaNeta > 0
            ? `¿Confirmas la liquidación del proyecto por S/ ${valorVenta.toLocaleString('es-PE')}? Esto acreditará S/ ${gananciaNeta.toLocaleString('es-PE')} de ganancia neta física en tu billetera y luego distribuirá S/ ${valorVenta.toLocaleString('es-PE')} a los inversores. Tu saldo virtual final será de S/ ${saldoFinal.toLocaleString('es-PE')}.`
            : `¿Confirmas la liquidación del proyecto por S/ ${valorVenta.toLocaleString('es-PE')}? Esto distribuirá el dinero proporcionalmente y cerrará el proyecto.`;

        if (!confirm(mensajeConfirmacion)) {
            return;
        }

        setProcessing(true);
        try {
            await onSubmit(valorVenta, aportarGanancia);
            showToast.success('Proyecto liquidado con éxito');
            onClose();
        } catch (error) {
            console.error('Error al liquidar proyecto:', error);
            showToast.error('Error al liquidar proyecto');
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
                    className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 max-w-lg w-full relative overflow-hidden shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />

                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                            <i className="bx bx-dollar-circle text-emerald-400 text-3xl"></i>
                            Liquidar Proyecto y Retornos
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition p-1 bg-white/5 hover:bg-white/10 rounded-full"
                            aria-label="Cerrar"
                        >
                            <FaTimes className="text-xl" />
                        </button>
                    </div>

                    <div className="mb-6 p-4 bg-slate-800/60 border border-white/5 rounded-2xl text-sm">
                        <p className="text-gray-300 mb-2">
                            Como creador de este proyecto, vas a realizar la <span className="text-white font-bold">liquidación total</span>. 
                        </p>
                        <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                            <span className="text-gray-400">Capital Recaudado del Proyecto:</span>
                            <span className="font-mono text-white font-bold">S/ {precioProyecto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="montoVenta" className="block text-sm font-semibold text-gray-300 mb-2">
                                Monto Bruto Total de la Venta (Capital + Plusvalía)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold font-mono">S/</span>
                                <input
                                    id="montoVenta"
                                    type="number"
                                    value={montoVentaTotal}
                                    onChange={(e) => setMontoVentaTotal(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors text-lg font-mono"
                                    placeholder="0.00"
                                    step="0.01"
                                    min={precioProyecto}
                                    required
                                />
                            </div>
                            <div className="flex justify-between items-center mt-2 px-1 text-xs">
                                <span className="text-gray-400">Tu saldo actual en plataforma:</span>
                                <span className="font-mono text-emerald-400 font-bold">
                                    S/ {saldoCreador.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {isValidMonto && gananciaNeta > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-slate-800/40 border border-emerald-500/20 rounded-2xl flex items-start gap-3 shadow-lg shadow-emerald-950/10"
                            >
                                <input
                                    id="aportarGanancia"
                                    type="checkbox"
                                    checked={aportarGanancia}
                                    onChange={(e) => setAportarGanancia(e.target.checked)}
                                    className="w-5 h-5 rounded border-white/10 text-emerald-500 bg-slate-950 focus:ring-emerald-500 mt-1 cursor-pointer transition-all"
                                />
                                <div className="text-xs">
                                    <label htmlFor="aportarGanancia" className="font-bold text-white cursor-pointer select-none flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                        Simular Aporte de Ganancia Física (+S/ {gananciaNeta.toLocaleString('es-PE', { minimumFractionDigits: 2 })})
                                    </label>
                                </div>
                            </motion.div>
                        )}

                        {isValidMonto && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                {/* Desglose Financiero */}
                                <div className="p-4 bg-slate-800/30 border border-white/5 rounded-2xl space-y-3 text-xs">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Desglose de Distribución</h4>
                                    
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Retorno de Capital (100%):</span>
                                        <span className="font-mono text-white">
                                            S/ {precioProyecto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 font-semibold">Ganancia Neta Generada (Plusvalía):</span>
                                        {gananciaNeta >= 0 ? (
                                            <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                                                +S/ {gananciaNeta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="font-mono text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/10">
                                                S/ {gananciaNeta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-400">ROI (Rentabilidad sobre Capital):</span>
                                        <span className={`font-mono font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                                        </span>
                                    </div>

                                    <div className="border-t border-white/5 my-1.5 pt-1.5 flex justify-between text-gray-500">
                                        <span>Inversores beneficiados:</span>
                                        <span className="font-bold text-white">{numInversores} inversores</span>
                                    </div>
                                </div>

                                {/* Ecuación Contable */}
                                {!isSaldoInsuficiente && (
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2 text-xs">
                                        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                            <span>Fórmula Contable del Creador (Suma y Resta)</span>
                                        </div>
                                        <div className="font-mono text-gray-300 bg-slate-950/60 p-3.5 rounded-xl border border-white/5 text-[11px] space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span>Ahorros Iniciales de tu Cuenta:</span>
                                                <span className="text-white font-bold">S/ {(saldoCreador - precioProyecto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-blue-300">
                                                <span>+ Capital Recaudado (Depositado):</span>
                                                <span>S/ {precioProyecto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            {aportarGanancia && gananciaNeta > 0 && (
                                                <div className="flex justify-between items-center text-emerald-400 font-bold">
                                                    <span>+ Aporte de Ganancia Física (Depósito):</span>
                                                    <span>S/ {gananciaNeta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-white/5 my-1" />
                                            <div className="flex justify-between items-center font-bold text-white">
                                                <span>Subtotal Acumulado en Billetera:</span>
                                                <span>S/ {(saldoCreador + (aportarGanancia ? gananciaNeta : 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-red-400">
                                                <span>- Liquidación a Inversores (Capital + Ganancia):</span>
                                                <span>S/ {valorVenta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="border-t border-white/10 pt-1.5 flex justify-between items-center font-bold text-emerald-400 text-sm">
                                                <span>Saldo Final tras Operación:</span>
                                                <span>S/ {saldoFinal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Advertencia o Nota Contable */}
                                {isSaldoInsuficiente && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 text-xs">
                                        <FaExclamationTriangle className="text-red-400 text-lg shrink-0 mt-0.5 animate-pulse" />
                                        <div className="space-y-2">
                                            <p className="text-red-200 font-bold">Saldo Insuficiente en la Plataforma</p>
                                            <p className="text-red-200/80 leading-relaxed">
                                                Tu saldo virtual actual (S/ {saldoCreador.toLocaleString('es-PE', { minimumFractionDigits: 2 })}) es inferior al monto total de liquidación (S/ {valorVenta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}).
                                            </p>
                                            <p className="text-red-300 font-semibold">
                                                Debes recargar al menos S/ {(valorVenta - saldoCreador).toLocaleString('es-PE', { minimumFractionDigits: 2 })} para realizar esta operación sin simulación.
                                            </p>
                                            <Link 
                                                href="/billetera/recargar" 
                                                className="inline-flex items-center gap-1 text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg font-semibold transition"
                                            >
                                                <FaWallet /> Ir a Recargar Saldo
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 border border-white/5 text-white rounded-xl font-semibold transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={processing || !isValidMonto || isSaldoInsuficiente || valorVenta < precioProyecto}
                                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                                        Liquidando...
                                    </>
                                ) : (
                                    <>
                                        <FaCoins />
                                        Liquidar y Distribuir
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
