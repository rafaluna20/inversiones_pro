'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useTokenBilletera from '@/Hooks/useTokenBilletera';
import { formatearFecha } from '@/lib/billetera-api';
import Link from 'next/link';
import { FaArrowLeft, FaHistory, FaArrowDown, FaArrowUp, FaExchangeAlt, FaMoneyBillWave, FaCheckCircle, FaClock } from 'react-icons/fa';

// Mock Data para modo Firebase
const mockTransacciones = [
  { id: 1, tipo: 'recarga', monto: 500, fecha: '2023-10-25', estado: 'completado', detalle: 'Recarga de saldo' },
  { id: 2, tipo: 'inversion', monto: -200, fecha: '2023-10-26', estado: 'completado', detalle: 'Inversión en Proyecto Alpha' },
  { id: 3, tipo: 'retiro', monto: -100, fecha: '2023-10-28', estado: 'pendiente', detalle: 'Solicitud de retiro' },
  { id: 4, tipo: 'transferencia', monto: -50, fecha: '2023-10-29', estado: 'completado', detalle: 'Envío a Juan Perez' },
];

const getTransactionStyle = (tipo: string, monto: number) => {
  // Detectar dirección de transferencia por el monto
  const isIncoming = monto > 0;

  switch (tipo.toLowerCase()) {
    case 'deposit':
    case 'recarga':
      return {
        icon: <FaArrowDown className="text-cyan-400" />,
        color: 'border-cyan-500/20 bg-cyan-500/10',
        label: 'Depósito'
      };
    case 'transfer':
    case 'transferencia':
      if (isIncoming) {
        return {
          icon: <FaArrowDown className="text-green-400" />,
          color: 'border-green-500/20 bg-green-500/10',
          label: 'Transfer. Recibida'
        };
      } else {
        return {
          icon: <FaArrowUp className="text-red-400" />,
          color: 'border-red-500/20 bg-red-500/10',
          label: 'Transfer. Enviada'
        };
      }
    case 'withdrawal':
    case 'retiro':
      return {
        icon: <FaArrowUp className="text-orange-400" />,
        color: 'border-orange-500/20 bg-orange-500/10',
        label: 'Retiro'
      };
    case 'investment':
    case 'inversion':
      return {
        icon: <FaExchangeAlt className="text-purple-400" />,
        color: 'border-purple-500/20 bg-purple-500/10',
        label: 'Inversión'
      };
    default:
      return {
        icon: <FaHistory className="text-gray-400" />,
        color: 'border-gray-500/20 bg-gray-500/10',
        label: tipo
      };
  }
};

export default function HistorialBilleteraPage() {
  const searchParams = useSearchParams();
  const { usuario, loading } = useAutenticacion();
  const { isAuthenticated } = useTokenBilletera();
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [usandoAPI, setUsandoAPI] = useState(false);

  // Token query param support removed as it is insecure


  useEffect(() => {
    const fetchHistorial = async () => {
      setLoadingData(true);

      // Si está autenticado (cookie HttpOnly), usar Server Action
      if (isAuthenticated) {
        setUsandoAPI(true);
        try {
          // Import dynamic to avoid server-action issues in client component if checking auth first
          const { getWalletDataAction } = await import('@/app/actions/wallet');
          const response = await getWalletDataAction();

          if (response.success && response.data && response.data.transactions) {
            // Transformar datos de API a formato de la UI
            const historialTransformado = response.data.transactions.map((tx: any, index: number) => ({
              id: index + 1,
              tipo: tx.transaction_type || 'transaccion',
              monto: tx.amount || 0,
              fecha: tx.date ? formatearFecha(new Date(tx.date)) : (tx.createdAt ? formatearFecha(new Date(tx.createdAt)) : 'Fecha desconocida'),
              estado: tx.state === 'done' ? 'completado' : tx.state,
              detalle: tx.description || 'Transacción',
            }));
            setTransacciones(historialTransformado);
          } else {
            setTransacciones([]);
          }
        } catch (error) {
          console.error('Error al obtener historial:', error);
          setTransacciones([]);
        }
      } else {
        // Sin autenticación bancaria, usar mock data de Firebase o vacío
        setUsandoAPI(false);
        setTransacciones(mockTransacciones);
      }

      setLoadingData(false);
    };

    if (usuario) {
      fetchHistorial();
    }
  }, [usuario, isAuthenticated]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>;
  if (!usuario) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Acceso Restringido</div>;

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[20%] right-[30%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/billetera" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" /> Volver a Billetera
          </Link>

          {/* Indicador de fuente de datos */}
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
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <FaHistory className="text-2xl text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white font-roboto-slab">Historial de Transacciones</h1>
              <p className="text-gray-400">Registro detallado de tus movimientos</p>
            </div>
          </div>

          {loadingData ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {transacciones.length > 0 ? (
                transacciones.map((tx) => {
                  const txStyle = getTransactionStyle(tx.tipo, tx.monto);
                  return (
                    <div key={tx.id} className="bg-slate-950/40 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:border-white/20 transition-all hover:bg-slate-900/60 group">
                      <div className="flex items-center gap-4 mb-3 sm:mb-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${txStyle.color}`}>
                          {txStyle.icon}
                        </div>
                        <div>
                          <p className="font-bold text-white text-lg pointer-events-none">{txStyle.label}</p>
                          <p className="text-sm text-gray-400 pointer-events-none">{tx.detalle}</p>
                          <p className="text-xs text-gray-600 mt-1 pointer-events-none">{tx.fecha}</p>
                        </div>
                      </div>
                      <div className="text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between items-center sm:items-end">
                        <p className={`font-bold font-mono text-xl ${tx.monto > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.monto > 0 ? '+' : ''} S/ {Math.abs(tx.monto).toFixed(2)}
                        </p>
                        <span className={`text-xs px-3 py-1 rounded-full border ${tx.estado === 'completado'
                          ? 'bg-green-500/5 text-green-400 border-green-500/20'
                          : 'bg-yellow-500/5 text-yellow-400 border-yellow-500/20'
                          }`}>
                          {tx.estado}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <FaHistory className="text-3xl text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-lg font-medium">No hay transacciones registradas.</p>
                  <p className="text-gray-600 text-sm mt-1">Tus movimientos aparecerán aquí.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
