'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useTokenBilletera from '@/Hooks/useTokenBilletera';
// import { transferirDinero, obtenerDatosBilletera } from '@/lib/billetera-api'; // Deprecated
import { showToast } from '@/lib/toast';
import { rateLimiter } from '@/lib/validators';
import Link from 'next/link';
import { FaArrowLeft, FaPaperPlane, FaUserCheck, FaInfoCircle, FaCheckCircle } from 'react-icons/fa';

export default function TransferirPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { usuario, loading } = useAutenticacion();
  const { isAuthenticated } = useTokenBilletera();
  const [monto, setMonto] = useState('');
  const [destinatarioEmail, setDestinatarioEmail] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [saldoActual, setSaldoActual] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Token query param support removed
  const tokenActivo = isAuthenticated;
  const usandoAPI = isAuthenticated;

  useEffect(() => {
    if (!usuario) return;

    const fetchSaldo = async () => {
      if (tokenActivo) {
        // Obtener saldo usando Server Action
        const { getWalletDataAction } = await import('@/app/actions/wallet');
        const response = await getWalletDataAction();
        if (response.success && response.data) {
          setSaldoActual(response.data.cash);
        }
      } else {
        // Obtener saldo de Firebase
        const usuarioRef = doc(db, 'usuarios', usuario.uid);
        const docSnap = await getDoc(usuarioRef);
        if (docSnap.exists()) {
          setSaldoActual(docSnap.data().saldo || 0);
        }
      }
    };

    fetchSaldo();
  }, [usuario, tokenActivo]);

  const handleTransferir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) {
      showToast.error('Debes iniciar sesión');
      return;
    }

    if (!rateLimiter.canProceed(`transfer_${usuario.uid}`, 3, 60000)) {
      const msg = 'Has excedido el límite de transferencias. Espera un momento.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      const msg = 'Ingresa un monto válido';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (montoNum > saldoActual) {
      const msg = 'Saldo insuficiente';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!destinatarioEmail || !destinatarioEmail.includes('@')) {
      const msg = 'Ingresa un email válido del destinatario';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (destinatarioEmail.toLowerCase() === usuario.email?.toLowerCase()) {
      const msg = 'No puedes transferir a ti mismo';
      setError(msg);
      showToast.error(msg);
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');

    // Guardamos el ID del toast de carga para poder cerrarlo explícitamente
    const loadingToastId = showToast.loading('Procesando transferencia...');

    try {
      let resultado;

      if (tokenActivo) {
        // Usar API de billetera (Odoo) vía Server Action
        const { transferMoneyAction } = await import('@/app/actions/wallet');
        resultado = await transferMoneyAction(
          destinatarioEmail.toLowerCase(),
          montoNum
        );
      } else {
        // Logica Firebase (Legacy)
        const usuariosRef = collection(db, 'usuarios');
        const q = query(usuariosRef, where('email', '==', destinatarioEmail.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error('Usuario destinatario no encontrado');
        }

        const destinatarioDoc = querySnapshot.docs[0];
        const destinatarioId = destinatarioDoc.id;
        const origenRef = doc(db, 'usuarios', usuario.uid);
        const destinoRef = doc(db, 'usuarios', destinatarioId);

        await updateDoc(origenRef, { saldo: increment(-montoNum) });
        await updateDoc(destinoRef, { saldo: increment(montoNum) });

        resultado = { success: true, message: 'Transferencia exitosa' };
      }

      // Cerramos el toast de carga SIEMPRE antes de mostrar resultado
      showToast.dismiss(String(loadingToastId));

      if (resultado && resultado.success) {
        setSuccess(resultado.message || 'Transferencia exitosa');
        showToast.success(`¡Transferencia exitosa! S/ ${montoNum.toFixed(2)} enviado`);

        // Esperar brevemente antes de redirigir
        setTimeout(() => {
          router.push('/billetera');
        }, 1500);
      } else {
        const errMsg = resultado?.message || 'Error al transferir: respuesta inesperada del servidor';
        setError(errMsg);
        showToast.error(errMsg);
        setProcessing(false);
      }

    } catch (err: any) {
      showToast.dismiss(String(loadingToastId));
      const errorMsg = err.message || 'Error al transferir';
      setError(errorMsg);
      showToast.error(errorMsg);
      setProcessing(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>;
  if (!usuario) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Acceso Restringido</div>;

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[20%] right-[20%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-md mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/billetera" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <FaArrowLeft /> Volver a Billetera
          </Link>

          {/* Indicador de sistema */}
          {usandoAPI ? (
            <div className="text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              API Billetera
            </div>
          ) : (
            <div className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Modo Demo
            </div>
          )}
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
            <FaPaperPlane className="text-3xl text-blue-400" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-2 font-roboto-slab">Transferir</h1>
          <p className="text-gray-400 mb-8">Envía dinero a otros usuarios de la plataforma</p>

          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 mb-6 flex justify-between items-center">
            <span className="text-gray-400 text-sm">Saldo Disponible</span>
            <span className="text-xl font-bold text-white font-mono">S/ {saldoActual.toFixed(2)}</span>
          </div>

          <form onSubmit={handleTransferir} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-gray-300 font-medium mb-2">
                Email del Destinatario
              </label>
              <div className="relative">
                <FaUserCheck className="absolute left-4 top-4 text-gray-500" />
                <input
                  type="email"
                  id="email"
                  value={destinatarioEmail}
                  onChange={(e) => setDestinatarioEmail(e.target.value.trim())}
                  placeholder="usuario@ejemplo.com"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="monto" className="block text-gray-300 font-medium mb-2">
                Monto a Transferir (S/)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-500 font-bold">S/</span>
                <input
                  type="number"
                  id="monto"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  max={saldoActual}
                  step="0.01"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-lg font-mono"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <span>❌</span>
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <FaCheckCircle />
                {success}
              </div>
            )}

            <div className={`px-4 py-3 rounded-xl text-sm flex items-start gap-3 ${usandoAPI
              ? 'bg-green-500/10 border border-green-500/20 text-green-200'
              : 'bg-blue-500/10 border border-blue-500/20 text-blue-200'
              }`}>
              <FaInfoCircle className="text-xl shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">
                  {usandoAPI ? 'API de Billetera Activa' : 'Transferencias Instantáneas'}
                </p>
                <p className="opacity-80 text-xs">
                  {usandoAPI
                    ? 'Transacciones procesadas por la API externa de billetera.'
                    : 'El dinero se acreditará inmediatamente en la billetera del destinatario sin comisiones.'}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={processing || saldoActual <= 0}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Enviando...' : 'Confirmar Transferencia'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
