'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useTokenBilletera from '@/Hooks/useTokenBilletera';
import { showToast } from '@/lib/toast';
import Link from 'next/link';
import {
  FaArrowLeft, FaMoneyBillWave, FaShieldAlt, FaCheckCircle,
  FaExchangeAlt, FaWallet, FaArrowRight, FaRedo, FaExclamationTriangle
} from 'react-icons/fa';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function RecargarBilleteraPage() {
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

  // Estado para recuperación de transacciones parciales
  const [pendingRecovery, setPendingRecovery] = useState<{
    transactionId: string;
    amount: number;
  } | null>(null);

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

  const handleCargar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum < 10) {
      setError('El monto mínimo es S/ 10.00');
      return;
    }
    if (saldoOdoo !== null && montoNum > saldoOdoo) {
      setError(`Saldo insuficiente en tu billetera. Disponible: S/ ${saldoOdoo.toFixed(2)}`);
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');
    const toastId = showToast.loading('Procesando carga...');

    try {
      const { loadPlatformBalanceAction } = await import('@/app/actions/wallet');
      const odooResult = await loadPlatformBalanceAction(montoNum, usuario.uid);

      if (!odooResult.success) {
        showToast.dismiss(String(toastId));
        setError(odooResult.message || 'Error al cargar saldo');
        showToast.error(odooResult.message || 'Error al cargar saldo');
        setProcessing(false);
        return;
      }

      // Odoo debitó exitosamente. Ahora acreditamos en Firebase desde el CLIENTE
      const transactionId = (odooResult as any).transaction_id;
      const amountDebited = (odooResult as any).amount;

      const { default: acreditarDesdeBilletera } = await import('@/Validacion/acreditarDesdeBilletera');
      const firebaseResult = await acreditarDesdeBilletera(usuario.uid, amountDebited, transactionId);

      showToast.dismiss(String(toastId));

      if (firebaseResult.success) {
        setSuccess(firebaseResult.already_applied
          ? 'Esta carga ya fue aplicada anteriormente'
          : `¡S/ ${amountDebited.toFixed(2)} cargados exitosamente!`);
        setMonto('');
        setSaldoOdoo(prev => prev !== null ? prev - amountDebited : null);
        showToast.success('¡Saldo cargado!');
        setTimeout(() => router.push('/'), 2000);
      } else {
        // Firebase falló, Odoo debitó
        setPendingRecovery({
          transactionId: transactionId,
          amount: amountDebited,
        });
        setError(firebaseResult.error || 'Error al acreditar en la plataforma');
        showToast.error('Error al acreditar. Guarda tu código de recuperación.');
        setProcessing(false);
      }

    } catch (err: any) {
      showToast.dismiss(String(toastId));
      setError(err.message || 'Error inesperado');
      showToast.error(err.message || 'Error inesperado');
      setProcessing(false);
    }
  };

  const handleRecuperacion = async () => {
    if (!pendingRecovery || !usuario) return;
    setProcessing(true);
    const toastId = showToast.loading('Recuperando crédito...');

    try {
      const { default: acreditarDesdeBilletera } = await import('@/Validacion/acreditarDesdeBilletera');
      const firebaseResult = await acreditarDesdeBilletera(
        usuario.uid,
        pendingRecovery.amount,
        pendingRecovery.transactionId
      );
      
      showToast.dismiss(String(toastId));

      if (firebaseResult.success) {
        setPendingRecovery(null);
        setError('');
        setSuccess(firebaseResult.already_applied
          ? 'Esta transacción ya estaba aplicada'
          : '¡Crédito recuperado!');
        showToast.success('¡Crédito recuperado!');
        setTimeout(() => router.push('/'), 2000);
      } else {
        showToast.error(firebaseResult.error || 'Error al recuperar');
        setProcessing(false);
      }
    } catch (err: any) {
      showToast.dismiss(String(toastId));
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

  // Si no tiene billetera Odoo conectada → mostrar modo demo (Firebase directo)
  if (!isAuthenticated) {
    return <RecargarModeDemo usuario={usuario} router={router} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="fixed inset-0 overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-[600px] h-[600px] bg-emerald-600/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-lg mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/billetera" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <FaArrowLeft /> Volver
          </Link>
          <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Billetera Conectada
          </div>
        </div>

        {/* Card Principal */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500" />

          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
            <FaExchangeAlt className="text-3xl text-emerald-400" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-1">Cargar Saldo</h1>
          <p className="text-gray-400 mb-8 text-sm">
            Transfiere fondos de tu Billetera Digital a la Plataforma de Inversiones
          </p>

          {/* Visualización del flujo */}
          <div className="flex items-center gap-3 bg-slate-800/60 border border-white/5 rounded-2xl p-4 mb-6">
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

            {/* Flecha animada */}
            <div className="flex flex-col items-center gap-1">
              <FaArrowRight className="text-emerald-400 text-xl animate-pulse" />
              <span className="text-[10px] text-gray-600">CARGA</span>
            </div>

            {/* Firebase Platform */}
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                <FaMoneyBillWave className="text-emerald-400" /> Plataforma
              </p>
              <p className="text-lg font-bold text-emerald-300 font-mono">
                S/ {saldoFirebase.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Alerta de recuperación pendiente */}
          {pendingRecovery && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <FaExclamationTriangle className="text-yellow-400 text-xl shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-yellow-200 font-semibold text-sm mb-1">
                    Transacción pendiente de acreditar
                  </p>
                  <p className="text-yellow-200/70 text-xs mb-1">
                    Tu billetera fue debitada correctamente. Haz clic para acreditar el saldo.
                  </p>
                  <p className="text-yellow-400 text-xs font-mono bg-yellow-500/10 rounded px-2 py-1 inline-block">
                    Código: {pendingRecovery.transactionId}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRecuperacion}
                disabled={processing}
                className="mt-3 w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FaRedo className={processing ? 'animate-spin' : ''} />
                Reintentar acreditación
              </button>
            </div>
          )}

          <form onSubmit={handleCargar} className="space-y-5">
            {/* Input monto */}
            <div>
              <label htmlFor="monto" className="block text-gray-300 font-medium mb-2 text-sm">
                Monto a Cargar (S/)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-500 font-bold">S/</span>
                <input
                  type="number"
                  id="monto"
                  value={monto}
                  onChange={(e) => { setMonto(e.target.value); setError(''); }}
                  placeholder="0.00"
                  min="10"
                  max={saldoOdoo ?? undefined}
                  step="0.01"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors text-lg font-mono"
                  required
                  disabled={processing}
                />
              </div>
            </div>

            {/* Montos rápidos */}
            <div className="grid grid-cols-4 gap-2">
              {[100, 250, 500, 1000].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setMonto(c.toString()); setError(''); }}
                  disabled={saldoOdoo !== null && c > saldoOdoo}
                  className="py-2 px-2 bg-slate-800/60 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-500/30 rounded-lg text-xs text-gray-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  S/ {c}
                </button>
              ))}
            </div>

            {/* Previsualización */}
            {monto && parseFloat(monto) >= 10 && (
              <div className="bg-slate-800/40 border border-white/5 rounded-xl p-3 text-sm">
                <div className="flex justify-between text-gray-400 mb-1">
                  <span>Billetera después:</span>
                  <span className="font-mono text-blue-300">
                    S/ {Math.max(0, (saldoOdoo ?? 0) - parseFloat(monto)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Plataforma después:</span>
                  <span className="font-mono text-emerald-300">
                    S/ {(saldoFirebase + parseFloat(monto)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Errores */}
            {error && !pendingRecovery && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <span>❌</span> {error}
              </div>
            )}

            {/* Éxito */}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <FaCheckCircle /> {success}
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 px-4 py-3 rounded-xl text-xs flex items-start gap-3">
              <FaShieldAlt className="text-lg shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Transacción segura con idempotencia</p>
                <p className="opacity-70">
                  El débito en tu billetera y el crédito en la plataforma están protegidos contra duplicados. El saldo mínimo de carga es S/ 10.00.
                </p>
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={processing || loadingBalances || saldoOdoo === 0}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <FaExchangeAlt />
                  Cargar a Plataforma
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Modo Demo sin Odoo ───────────────────────────────────────────────────────
function RecargarModeDemo({ usuario, router }: { usuario: any; router: any }) {
  const [monto, setMonto] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    const { doc, updateDoc, increment } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase/config');
    const ref = doc(db, 'usuarios', usuario.uid);
    await updateDoc(ref, { saldo: increment(parseFloat(monto)) });
    showToast.success('Saldo Demo añadido');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Link href="/billetera" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <FaArrowLeft /> Volver
        </Link>
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-purple-500 rounded-t-[28px]" />
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
            <FaMoneyBillWave className="text-3xl text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Recargar Saldo</h1>
          <p className="text-gray-400 mb-6 text-sm">Modo Demo — Conecta tu Billetera Digital para cargar saldo real.</p>

          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 px-4 py-3 rounded-xl text-xs mb-6 flex items-start gap-2">
            <FaShieldAlt className="text-lg shrink-0" />
            <p>Para cargar saldo real desde tu Billetera, primero conéctala en <Link href="/billetera" className="underline font-semibold">Mi Billetera</Link>.</p>
          </div>

          <form onSubmit={handleDemo} className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-500 font-bold">S/</span>
              <input
                type="number" value={monto} onChange={e => setMonto(e.target.value)}
                placeholder="0.00" min="1" step="0.01"
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-lg font-mono"
                required
              />
            </div>
            <button
              type="submit" disabled={processing}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {processing ? 'Procesando...' : 'Añadir Saldo Demo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
