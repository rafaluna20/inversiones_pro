'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useTokenBilletera from '@/Hooks/useTokenBilletera';
import { showToast } from '@/lib/toast';
import Link from 'next/link';
import {
  FaArrowLeft, FaMoneyBillWave, FaShieldAlt, FaCheckCircle,
  FaExchangeAlt, FaWallet, FaArrowRight, FaExclamationTriangle
} from 'react-icons/fa';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function RetirarHaciaBilleteraPage() {
  const router = useRouter();
  const { usuario, loading } = useAutenticacion();
  const { isAuthenticated } = useTokenBilletera();

  const [monto, setMonto] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saldoOdoo, setSaldoOdoo] = useState<number | null>(null);
  const [saldoFirebase, setSaldoFirebase] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(true);

  // Escuchar saldo Firebase en tiempo real
  useEffect(() => {
    if (!usuario) return;
    const ref = doc(db, 'usuarios', usuario.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSaldoFirebase(snap.data().saldo ?? 0);
    });
    return () => unsub();
  }, [usuario]);

  // Obtener saldo de Odoo
  useEffect(() => {
    if (!isAuthenticated || !usuario) {
      setLoadingBalances(false);
      return;
    }
    const fetch = async () => {
      try {
        const { getWalletDataAction } = await import('@/app/actions/wallet');
        const res = await getWalletDataAction();
        if (res.success && res.data) setSaldoOdoo(res.data.cash);
      } finally {
        setLoadingBalances(false);
      }
    };
    fetch();
  }, [isAuthenticated, usuario]);

  const handleRetirar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresa un monto válido mayor a 0');
      return;
    }
    if (montoNum > saldoFirebase) {
      setError(`Saldo insuficiente en tu plataforma. Disponible: S/ ${saldoFirebase.toFixed(2)}`);
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');
    const toastId = showToast.loading('Procesando retiro hacia billetera...');

    try {
      const { withdrawFromPlatformAction } = await import('@/app/actions/wallet');
      const result = await withdrawFromPlatformAction(montoNum, usuario.uid);

      showToast.dismiss(String(toastId));

      if (result.success) {
        setSuccess(result.message || `¡S/ ${montoNum.toFixed(2)} transferidos a tu billetera exitosamente!`);
        setMonto('');
        if (saldoOdoo !== null) setSaldoOdoo(prev => prev !== null ? prev + montoNum : null);
        showToast.success(result.message || '¡Retiro completado!');
        setTimeout(() => router.push('/billetera'), 2000);

      } else {
        setError(result.message || 'Error al retirar saldo');
        showToast.error(result.message || 'Error al retirar saldo');
        setProcessing(false);
      }
    } catch (err: any) {
      showToast.dismiss(String(toastId));
      setError(err.message || 'Error inesperado');
      showToast.error(err.message || 'Error inesperado');
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  if (!usuario) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      Acceso Restringido
    </div>
  );

  // Si no tiene billetera Odoo conectada
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4 flex flex-col items-center justify-center">
        <FaExclamationTriangle className="text-yellow-500 text-6xl mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Billetera no conectada</h2>
        <p className="text-gray-400 mb-6 text-center max-w-md">
          Para retirar fondos de la plataforma necesitas conectar tu Billetera Digital.
        </p>
        <Link href="/billetera" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition">
          Ir a Mi Billetera
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="fixed inset-0 overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] right-[5%] w-[600px] h-[600px] bg-red-600/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-lg mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <FaArrowLeft /> Volver al Inicio
          </Link>
          <div className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Billetera Conectada
          </div>
        </div>

        {/* Card Principal */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-400 via-orange-500 to-yellow-500" />

          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
            <FaExchangeAlt className="text-3xl text-red-400" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-1">Retirar a Billetera</h1>
          <p className="text-gray-400 mb-8 text-sm">
            Transfiere fondos desde tu Plataforma de Inversiones hacia tu Billetera Digital.
          </p>

          {/* Visualización del flujo (Invertido respecto a recargar) */}
          <div className="flex items-center gap-3 bg-slate-800/60 border border-white/5 rounded-2xl p-4 mb-6">
            {/* Firebase Platform */}
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                <FaMoneyBillWave className="text-emerald-400" /> Plataforma
              </p>
              <p className="text-lg font-bold text-emerald-300 font-mono">
                S/ {saldoFirebase.toFixed(2)}
              </p>
            </div>

            {/* Flecha animada */}
            <div className="flex flex-col items-center gap-1">
              <FaArrowRight className="text-red-400 text-xl animate-pulse" />
              <span className="text-[10px] text-gray-600">RETIRO</span>
            </div>

            {/* Odoo Wallet */}
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                <FaWallet className="text-blue-400" /> Billetera Odoo
              </p>
              {loadingBalances ? (
                <div className="h-6 w-24 bg-slate-700 rounded animate-pulse mx-auto" />
              ) : (
                <p className="text-lg font-bold text-blue-300 font-mono">
                  S/ {saldoOdoo?.toFixed(2) ?? '—'}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleRetirar} className="space-y-5">
            {/* Input monto */}
            <div>
              <label htmlFor="monto" className="block text-gray-300 font-medium mb-2 text-sm">
                Monto a Retirar (S/)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-500 font-bold">S/</span>
                <input
                  type="number"
                  id="monto"
                  value={monto}
                  onChange={(e) => { setMonto(e.target.value); setError(''); }}
                  placeholder="0.00"
                  min="1"
                  max={saldoFirebase}
                  step="0.01"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors text-lg font-mono"
                  required
                  disabled={processing}
                />
              </div>
            </div>

            {/* Montos rápidos */}
            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={() => { setMonto((saldoFirebase * 0.25).toFixed(2)); setError(''); }} disabled={saldoFirebase <= 0} className="py-2 px-2 bg-slate-800/60 hover:bg-red-500/20 border border-white/5 rounded-lg text-xs text-gray-300 hover:text-white transition-all disabled:opacity-30">25%</button>
              <button type="button" onClick={() => { setMonto((saldoFirebase * 0.50).toFixed(2)); setError(''); }} disabled={saldoFirebase <= 0} className="py-2 px-2 bg-slate-800/60 hover:bg-red-500/20 border border-white/5 rounded-lg text-xs text-gray-300 hover:text-white transition-all disabled:opacity-30">50%</button>
              <button type="button" onClick={() => { setMonto((saldoFirebase * 0.75).toFixed(2)); setError(''); }} disabled={saldoFirebase <= 0} className="py-2 px-2 bg-slate-800/60 hover:bg-red-500/20 border border-white/5 rounded-lg text-xs text-gray-300 hover:text-white transition-all disabled:opacity-30">75%</button>
              <button type="button" onClick={() => { setMonto(saldoFirebase.toFixed(2)); setError(''); }} disabled={saldoFirebase <= 0} className="py-2 px-2 bg-slate-800/60 hover:bg-red-500/20 border border-white/5 rounded-lg text-xs text-gray-300 hover:text-white transition-all disabled:opacity-30 font-bold">MAX</button>
            </div>

            {/* Previsualización */}
            {monto && parseFloat(monto) > 0 && (
              <div className="bg-slate-800/40 border border-white/5 rounded-xl p-3 text-sm">
                <div className="flex justify-between text-gray-400 mb-1">
                  <span>Plataforma después:</span>
                  <span className="font-mono text-emerald-300">
                    S/ {Math.max(0, saldoFirebase - parseFloat(monto)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Billetera después:</span>
                  <span className="font-mono text-blue-300">
                    S/ {((saldoOdoo ?? 0) + parseFloat(monto)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Errores */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <span>❌</span> {error}
              </div>
            )}

            {/* Éxito */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <FaCheckCircle /> {success}
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 px-4 py-3 rounded-xl text-xs flex items-start gap-3">
              <FaShieldAlt className="text-lg shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Retiro seguro y automático</p>
                <p className="opacity-70">
                  El dinero se descontará de tu Plataforma y se depositará instantáneamente en tu Billetera Digital. Si hay un error, tu dinero será devuelto.
                </p>
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={processing || loadingBalances || saldoFirebase <= 0}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <FaExchangeAlt />
                  Transferir a Billetera
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
