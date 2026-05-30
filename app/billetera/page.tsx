'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useTokenBilletera from '@/Hooks/useTokenBilletera';
import { obtenerMovimientosPlataforma } from '@/lib/firebase/obtenerMovimientosPlataforma';
// import { obtenerDatosBilletera } from '@/lib/billetera-api'; // Deprecated
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { FaWallet, FaArrowUp, FaArrowDown, FaExchangeAlt, FaHistory, FaUniversity, FaKey, FaTimes, FaClock } from 'react-icons/fa';

export default function BilleteraPage() {
  const { usuario, loading } = useAutenticacion();
  const { isAuthenticated, loginBilletera } = useTokenBilletera();

  // Estados para validación y datos
  const [saldo, setSaldo] = useState(0);
  const [saldoPlataforma, setSaldoPlataforma] = useState(0);
  const [datosUsuario, setDatosUsuario] = useState<any>(null);
  const [usandoAPIBilletera, setUsandoAPIBilletera] = useState(false);

  // Estados para el filtrado interactivo de movimientos y cuentas
  const [filtroMovimientos, setFiltroMovimientos] = useState<'plataforma' | 'odoo'>('plataforma');
  const [movimientosPlataforma, setMovimientosPlataforma] = useState<any[]>([]);
  const [movimientosOdoo, setMovimientosOdoo] = useState<any[]>([]);

  // Estados para el Modal de Login
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Cerrar modal de login automáticamente al autenticarse de forma exitosa (evita carreras de estados)
  useEffect(() => {
    if (isAuthenticated) {
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
      setLoginError('');
    }
  }, [isAuthenticated]);

  // Función para manejar el login de la billetera
  const handleLoginBilletera = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    const formData = new FormData();
    formData.append('email', loginEmail);
    formData.append('password', loginPassword);

    try {
      const success = await loginBilletera(formData);
      if (!success) {
        setLoginError('Credenciales inválidas o error de conexión');
      }
    } catch (error) {
      console.error('Error en login billetera:', error);
      setLoginError('Ocurrió un error al intentar iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  // Suscripción al saldo de plataforma de Firebase (siempre activo)
  useEffect(() => {
    if (!usuario) return;
    
    const usuarioRef = doc(db, 'usuarios', usuario.uid);
    const unsubscribe = onSnapshot(usuarioRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDatosUsuario(data);
        setSaldoPlataforma(Number(data.saldo || 0));
      }
    });

    // Cargar movimientos de la plataforma
    const fetchMovimientos = async () => {
      try {
        const movimientos = await obtenerMovimientosPlataforma(usuario.uid);
        const formateados = movimientos.map((mv) => ({
          id: mv.id,
          tipo: mv.tipo || 'transaccion',
          monto: Number(mv.monto || 0),
          fecha: new Date(mv.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
          detalle: mv.detalle || 'Movimiento de plataforma'
        }));
        setMovimientosPlataforma(formateados);
      } catch (error) {
        console.error("Error al cargar movimientos de la plataforma:", error);
      }
    };
    fetchMovimientos();

    return () => unsubscribe();
  }, [usuario]);

  // Cargar datos según estado de la billetera externa (Odoo)
  useEffect(() => {
    if (!usuario) return;

    if (isAuthenticated) {
      setUsandoAPIBilletera(true);
      const fetchBilleteraData = async () => {
        try {
          const { getWalletDataAction } = await import('@/app/actions/wallet');
          const response = await getWalletDataAction();

          if (response.success && response.data) {
            setSaldo(Number(response.data.cash || 0));

            // Procesar transacciones de Odoo
            if (response.data.transactions && Array.isArray(response.data.transactions)) {
              const formateados = response.data.transactions.map((tx: any, index: number) => ({
                id: `odoo_${index}`,
                tipo: tx.transaction_type || 'transaccion',
                monto: Number(tx.amount || 0),
                fecha: new Date(tx.date || tx.createdAt || Date.now()).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
                detalle: tx.description || 'Movimiento'
              }));
              setMovimientosOdoo(formateados);
            }
          }
        } catch (error) {
          console.error("Error al cargar datos de billetera Odoo:", error);
        }
      };
      fetchBilleteraData();
    } else {
      setUsandoAPIBilletera(false);
      setSaldo(0);
      setMovimientosOdoo([]);
      // Si se desconecta, forzar el filtro a plataforma
      setFiltroMovimientos('plataforma');
    }
  }, [usuario, isAuthenticated]);

  // Computar valores derivados de forma ultra-segura contra crashes de render
  const saldoTotalConsolidado = Number(saldoPlataforma || 0) + (isAuthenticated ? Number(saldo || 0) : 0);
  const listaActiva = filtroMovimientos === 'plataforma' ? movimientosPlataforma : movimientosOdoo;
  const transaccionesRecientes = Array.isArray(listaActiva) ? listaActiva.slice(0, 3) : [];



  // Helper para iconos de transacción
  const getTxIcon = (tipo: string, monto: number) => {
    const isIncoming = monto > 0;
    const typeCode = tipo?.toLowerCase() || '';

    if (typeCode.includes('deposit') || typeCode.includes('recarga') || isIncoming) {
      return <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400"><FaArrowDown className="text-xs" /></div>;
    }
    return <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400"><FaArrowUp className="text-xs" /></div>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin blur-[1px]"></div>
      </div>
    );
  }

  // Auth Guard
  if (!usuario) {
    // ... (Auth guard UI remains same) ...
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
            <FaWallet className="text-3xl text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 font-roboto-slab">Acceso Restringido</h2>
          <p className="text-gray-400 mb-8">Debes iniciar sesión para acceder a tu billetera y gestionar tus fondos.</p>
          <Link
            href="/login"
            className="inline-flex w-full justify-center py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Modal de Login de Billetera (Mantener igual) */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          {/* ... (Modal content same as before) ... */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
            >
              <FaTimes className="text-2xl" />
            </button>

            <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-purple-500/20">
              <FaKey className="text-3xl text-purple-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Iniciar Sesión en Billetera
            </h2>
            <p className="text-gray-400 mb-6 text-center text-sm">
              Ingresa tus credenciales de la billetera externa
            </p>

            <form onSubmit={handleLoginBilletera} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-2">Contraseña</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
                  required
                  autoComplete="current-password"
                />
              </div>

              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {loginLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>

              <div className="text-center text-sm text-gray-400 mt-4">
                ¿No tienes cuenta de billetera?{' '}
                <Link href="/billetera/registro" className="text-purple-400 hover:text-purple-300 transition">
                  Crear cuenta
                </Link>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-950 py-8 px-4 relative overflow-x-hidden">
        {/* Background Elements */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Header Compacto */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white font-roboto-slab flex items-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Mi Billetera
              </span>
            </h1>
            <div className="flex items-center gap-2">
              {usandoAPIBilletera && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
              )}
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 overflow-hidden">
                <img src={usuario.photoURL || '/static/img/imagenPerfil.png'} alt="Perfil" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <FaKey className="text-lg text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Activa tu Billetera</h3>
                  <p className="text-gray-400 text-xs">Conecta para transacciones reales</p>
                </div>
              </div>
              <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-500 transition">
                Conectar
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Balance & Quick Actions (8 cols) */}
            <div className="lg:col-span-8 space-y-6">

              {/* 1. New Compact Balance Card - Tarjeta de Saldo Doble e Interactiva */}
              <div className="relative overflow-hidden rounded-[24px] bg-slate-900 border border-white/5 shadow-2xl group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-transparent opacity-50 group-hover:opacity-100 transition duration-700"></div>
                <div className="relative p-6 flex flex-col gap-6">
                  
                  {/* Saldo Total Consolidado (Resumen Superior) */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1 text-gray-400">
                        <FaWallet className="text-xs" />
                        <span className="text-xs font-mono uppercase tracking-widest font-semibold">Resumen de Cuenta (Saldo Consolidado)</span>
                      </div>
                      <h2 className="text-4xl font-extrabold text-white font-mono tracking-tighter">
                        {formatCurrency(saldoTotalConsolidado)}
                      </h2>
                      {!isAuthenticated && (
                        <p className="text-[10px] text-red-400/80 font-medium mt-1">
                          * Consolidado parcial (Billetera Odoo desconectada)
                        </p>
                      )}
                    </div>
                    <div className="bg-slate-950/50 px-4 py-2 rounded-xl border border-white/5 text-right">
                      <p className="text-[9px] text-gray-500 uppercase font-mono mb-0.5">Filtrando movimientos por:</p>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md uppercase ${
                        filtroMovimientos === 'plataforma' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {filtroMovimientos === 'plataforma' ? 'Plataforma Firebase' : 'Billetera Odoo'}
                      </span>
                    </div>
                  </div>

                  {/* Cuentas Modulares (Clickables) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Saldo Plataforma (Firebase) */}
                    <button
                      onClick={() => setFiltroMovimientos('plataforma')}
                      className={`text-left rounded-2xl p-4 flex flex-col justify-between border transition-all duration-300 focus:outline-none ${
                        filtroMovimientos === 'plataforma'
                          ? 'border-blue-500/40 bg-blue-950/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-[1.01]'
                          : 'border-white/5 bg-slate-950/40 opacity-70 hover:opacity-100 hover:scale-[1.005]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-blue-400">
                          <span className={`w-1.5 h-1.5 rounded-full ${filtroMovimientos === 'plataforma' ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`}></span>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Saldo en Plataforma</p>
                        </div>
                        <h3 className="text-2xl font-bold text-white font-mono tracking-tight">
                          {formatCurrency(saldoPlataforma)}
                        </h3>
                      </div>
                      <p className="text-gray-500 text-[10px] mt-4 pointer-events-none">Hacer clic para ver movimientos de inversiones y cargas</p>
                    </button>

                    {/* Saldo Billetera Digital (Odoo) */}
                    <button
                      onClick={() => {
                        if (isAuthenticated) {
                          setFiltroMovimientos('odoo');
                        } else {
                          setShowLoginModal(true);
                        }
                      }}
                      className={`text-left rounded-2xl p-4 flex flex-col justify-between border transition-all duration-300 focus:outline-none ${
                        filtroMovimientos === 'odoo'
                          ? 'border-purple-500/40 bg-purple-950/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] scale-[1.01]'
                          : 'border-white/5 bg-slate-950/40 opacity-70 hover:opacity-100 hover:scale-[1.005]'
                      }`}
                    >
                      {isAuthenticated ? (
                        <div className="h-full flex flex-col justify-between w-full">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-purple-400">
                                <span className={`w-1.5 h-1.5 rounded-full ${filtroMovimientos === 'odoo' ? 'bg-purple-400 animate-pulse' : 'bg-gray-500'}`}></span>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Billetera Externa (Odoo)</p>
                              </div>
                              <span className="text-[9px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full uppercase">Conectada</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white font-mono tracking-tight">
                              {formatCurrency(saldo)}
                            </h3>
                          </div>
                          <p className="text-gray-500 text-[10px] mt-4 pointer-events-none">Hacer clic para ver transferencias y cobros externos</p>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full justify-between w-full">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Billetera Externa (Odoo)</p>
                            </div>
                            <span className="text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase">Desconectada</span>
                          </div>
                          
                          <div className="my-2">
                            <p className="text-gray-300 text-xs font-semibold">Conecta tu cuenta para ver el saldo externo</p>
                          </div>
                          
                          <span className="inline-block text-center mt-2 w-full py-1.5 bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition-all">
                            Conectar Billetera
                          </span>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Estadísticas de Inversión */}
                  <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 bg-slate-950/20 px-3 py-1.5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-gray-500 uppercase font-mono">Ganancia Total:</span>
                      <span className="text-green-400 font-bold font-mono text-xs">+{formatCurrency(datosUsuario?.ganancia || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-950/20 px-3 py-1.5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-gray-500 uppercase font-mono">Proyectos Invertidos:</span>
                      <span className="text-white font-bold font-mono text-xs">{datosUsuario?.inversionesCompletadas || 0}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* 2. New Action Toolbar (Floating Dock Style - Contextual) */}
              {(() => {
                const accionesContextuales = filtroMovimientos === 'plataforma' 
                  ? [
                      { 
                        icon: FaArrowDown, 
                        label: "Cargar Plataforma", 
                        href: "/billetera/recargar", 
                        color: "text-blue-400", 
                        bg: "hover:bg-blue-500/10 hover:border-blue-500/20"
                      },
                      { 
                        icon: FaArrowUp, 
                        label: "Enviar a Billetera", 
                        href: "/billetera/retirar-banco", 
                        color: "text-orange-400", 
                        bg: "hover:bg-orange-500/10 hover:border-orange-500/20"
                      },
                      { 
                        icon: FaHistory, 
                        label: "Historial Plataforma", 
                        href: `/billetera/historial?filtro=plataforma`, 
                        color: "text-slate-400", 
                        bg: "hover:bg-slate-500/10 hover:border-slate-500/20"
                      },
                    ]
                  : [
                      { 
                        icon: FaArrowUp, 
                        label: "Retirar a Banco", 
                        href: "/billetera/retirar-banco", 
                        color: "text-purple-400", 
                        bg: "hover:bg-purple-500/10 hover:border-purple-500/20"
                      },
                      { 
                        icon: FaExchangeAlt, 
                        label: "Transferir a Usuario", 
                        href: "/billetera/transferir", 
                        color: "text-green-400", 
                        bg: "hover:bg-green-500/10 hover:border-green-500/20"
                      },
                      { 
                        icon: FaHistory, 
                        label: "Historial Odoo", 
                        href: `/billetera/historial?filtro=odoo`, 
                        color: "text-slate-400", 
                        bg: "hover:bg-slate-500/10 hover:border-slate-500/20"
                      },
                    ];

                return (
                  <>
                    <div className={`bg-slate-900/60 backdrop-blur-md border rounded-2xl p-2 grid gap-2 transition-all duration-300 grid-cols-3 ${
                      filtroMovimientos === 'plataforma' 
                        ? 'border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]' 
                        : 'border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.05)]'
                    }`}>
                      {accionesContextuales.map((action, idx) => (
                        <Link 
                          key={idx} 
                          href={action.href} 
                          className={`flex flex-col items-center justify-center py-3 rounded-xl border border-transparent transition-all duration-200 group ${action.bg}`}
                        >
                          <div className={`mb-1 transition-transform group-hover:scale-110 ${action.color}`}>
                            <action.icon className="text-xl" />
                          </div>
                          <span className="text-[11px] font-medium text-gray-400 group-hover:text-white transition-colors text-center">{action.label}</span>
                        </Link>
                      ))}
                    </div>

                    {/* 2.1 Context Help Banner (Micro-guía) */}
                    <div className={`rounded-xl p-3 border transition-all duration-300 ${
                      filtroMovimientos === 'plataforma'
                        ? 'bg-blue-500/5 border-blue-500/10 animate-fade-in'
                        : 'bg-purple-500/5 border-purple-500/10 animate-fade-in'
                    }`}>
                      <p className="text-[11px] leading-relaxed text-gray-400">
                        <strong className={filtroMovimientos === 'plataforma' ? 'text-blue-400' : 'text-purple-400'}>
                          {filtroMovimientos === 'plataforma' ? '📌 Saldo de Plataforma (Firebase): ' : '📌 Billetera Digital Externa (Odoo): '}
                        </strong>
                        {filtroMovimientos === 'plataforma' 
                          ? 'Monto destinado únicamente para invertir en proyectos inmobiliarios. Puedes recargar saldo desde Odoo o enviarlo de regreso a tu billetera externa.'
                          : 'Fondos externos operacionales. Puedes transferir dinero a otros inversores registrados en Odoo o retirarlo hacia tu banco local.'}
                      </p>
                    </div>
                  </>
                );
              })()}

              {/* 3. New Recent Transactions Widget */}
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FaClock className="text-gray-500" /> Movimientos Recientes
                  </h3>
                  <Link href={`/billetera/historial?filtro=${filtroMovimientos}`} className="text-xs text-blue-400 hover:text-blue-300 transition">Ver todo</Link>
                </div>

                <div className="space-y-3">
                  {transaccionesRecientes.length > 0 ? (
                    transaccionesRecientes.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/30 border border-white/5 hover:bg-slate-950/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {getTxIcon(tx.tipo, tx.monto)}
                          <div>
                            <p className="text-sm text-white font-medium capitalize">{tx.tipo === 'unknown' ? 'Transacción' : tx.tipo}</p>
                            <p className="text-[10px] text-gray-500">{tx.fecha} • {tx.detalle}</p>
                          </div>
                        </div>
                        <span className={`font-mono text-sm font-bold ${Number(tx.monto || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {Number(tx.monto || 0) > 0 ? '+' : ''}{formatCurrency(Number(Math.abs(tx.monto || 0)))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      No hay movimientos recientes
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Account Info (4 cols) - Simplified */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 sticky top-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Detalles de Cuenta</h3>
                <div className="space-y-4">
                  <div className="p-3 bg-slate-950/30 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-500 mb-1">ID Cliente</p>
                    <p className="text-white font-mono text-sm">#{usuario.uid.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="p-3 bg-slate-950/30 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-500 mb-1">Email Registrado</p>
                    <p className="text-white text-xs truncate">{usuario.email}</p>
                  </div>
                  <div className="pt-4 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-600">
                      Cuenta protegida con encriptación de extremo a extremo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
