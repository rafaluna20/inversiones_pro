'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useTokenBilletera from '@/Hooks/useTokenBilletera';
import { showToast } from '@/lib/toast';
import Link from 'next/link';
import { FaArrowLeft, FaHandHoldingUsd, FaExclamationTriangle } from 'react-icons/fa';

export default function RetirarBilleteraPage() {
  const router = useRouter();
  const { usuario, loading } = useAutenticacion();
  const { isAuthenticated } = useTokenBilletera();
  const [monto, setMonto] = useState('');
  const [saldoActual, setSaldoActual] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const tokenActivo = isAuthenticated;
  const usandoAPI = isAuthenticated;

  useEffect(() => {
    if (!usuario) return;

    const fetchSaldo = async () => {
      if (tokenActivo) {
        const { getWalletDataAction } = await import('@/app/actions/wallet');
        const response = await getWalletDataAction();
        if (response.success && response.data) {
          setSaldoActual(response.data.cash);
        }
      } else {
        const usuarioRef = doc(db, 'usuarios', usuario.uid);
        const docSnap = await getDoc(usuarioRef);
        if (docSnap.exists()) {
          setSaldoActual(docSnap.data().saldo || 0);
        }
      }
    };

    fetchSaldo();
  }, [usuario, tokenActivo]);

  const handleRetirar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresa un monto válido');
      return;
    }

    if (montoNum > saldoActual) {
      setError('Saldo insuficiente');
      return;
    }

    setProcessing(true);
    setError('');

    const toastId = showToast.loading('Procesando retiro...');

    try {
      let resultado;

      if (tokenActivo) {
        const { withdrawMoneyAction } = await import('@/app/actions/wallet');
        resultado = await withdrawMoneyAction(montoNum, 'bank', { reason: 'Retiro desde web' });
      } else {
        const usuarioRef = doc(db, 'usuarios', usuario.uid);
        await updateDoc(usuarioRef, {
          saldo: increment(-montoNum),
        });
        resultado = { success: true, message: 'Retiro exitoso' };
      }

      showToast.dismiss(String(toastId));

      if (resultado.success) {
        showToast.success(resultado.message || 'Retiro exitoso');
        setTimeout(() => {
          router.push('/billetera');
        }, 1500);
      } else {
        throw new Error(resultado.message || 'Error al retirar');
      }
    } catch (err: any) {
      showToast.dismiss(String(toastId));
      setError(err.message || 'Error al retirar');
      showToast.error(err.message || 'Error al retirar');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>;
  if (!usuario) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Acceso Restringido</div>;

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-md mx-auto relative z-10">
        <Link href="/billetera" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <FaArrowLeft /> Volver a Billetera
        </Link>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-orange-500"></div>

          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
            <FaHandHoldingUsd className="text-3xl text-red-400" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-2 font-roboto-slab">Retirar Fondos</h1>
          <p className="text-gray-400 mb-8">Transfiere saldo a tu cuenta bancaria</p>

          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 mb-6 flex justify-between items-center">
            <span className="text-gray-400 text-sm">Saldo Disponible</span>
            <span className="text-xl font-bold text-white font-mono">S/ {saldoActual.toFixed(2)}</span>
          </div>

          <form onSubmit={handleRetirar} className="space-y-6">
            <div>
              <label htmlFor="monto" className="block text-gray-300 font-medium mb-2">
                Monto a Retirar (S/)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-500 font-bold">S/</span>
                <input
                  type="number"
                  id="monto"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                  min="1"
                  max={saldoActual}
                  step="0.01"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors text-lg font-mono"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
              <FaExclamationTriangle className="text-xl shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Información de Retiro</p>
                <p className="opacity-80 text-xs">Los retiros suelen procesarse en 24-48 horas hábiles. Asegúrate de que tu cuenta bancaria esté verificada.</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={processing || saldoActual <= 0}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Procesando...' : 'Solicitar Retiro'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
