'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import useAutenticacion from '@/Hooks/useAutenticacion';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaHeart, FaChartLine, FaEdit, FaShieldAlt } from 'react-icons/fa';

export default function PerfilPage() {
  const { usuario, loading } = useAutenticacion();
  const [datosUsuario, setDatosUsuario] = useState<any>(null);
  const [loadingDatos, setLoadingDatos] = useState(true);

  useEffect(() => {
    if (!usuario) return;

    const fetchDatos = async () => {
      try {
        const usuarioRef = doc(db, 'usuarios', usuario.uid);
        const docSnap = await getDoc(usuarioRef);
        if (docSnap.exists()) {
          setDatosUsuario(docSnap.data());
        }
        setLoadingDatos(false);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setLoadingDatos(false);
      }
    };

    fetchDatos();
  }, [usuario]);

  // Loading State
  if (loading || loadingDatos) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin blur-[1px]"></div>
      </div>
    );
  }

  // Auth Guard
  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative">
        <div className="relative z-10 bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
            <FaUser className="text-3xl text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 font-roboto-slab">Acceso Restringido</h2>
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
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[30%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="mb-8 pl-4 border-l-4 border-blue-500">
          <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab">Mi Perfil</h1>
          <p className="text-gray-400">Información personal y estado de cuenta</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Profile Card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>

              <div className="relative z-10">
                <div className="w-32 h-32 rounded-full mx-auto mb-4 p-1 bg-gradient-to-br from-blue-500 to-purple-500 shadow-xl">
                  <img
                    src={usuario.photoURL || '/static/img/imagenPerfil.png'}
                    alt={usuario.displayName || 'Usuario'}
                    className="w-full h-full rounded-full object-cover border-4 border-slate-900 bg-slate-800"
                  />
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-slate-900" title="Verificado"></div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-1">
                  {usuario.displayName || 'Usuario'}
                </h2>
                <p className="text-gray-400 text-sm mb-6 flex items-center justify-center gap-1">
                  <FaShieldAlt className="text-blue-500" /> Inversor Verificado
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-950/30 rounded-xl p-3 border border-white/5 mx-2">
                    <p className="text-2xl font-bold text-white mb-0">{datosUsuario?.inversionesCompletadas || 0}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Inversiones</p>
                  </div>
                  <div className="bg-slate-950/30 rounded-xl p-3 border border-white/5 mx-2">
                    <p className="text-2xl font-bold text-white mb-0">{datosUsuario?.like || 0}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Likes</p>
                  </div>
                </div>

                <button className="w-full py-3 px-4 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl text-white font-medium transition flex items-center justify-center gap-2 group-hover:border-blue-500/30">
                  <FaEdit /> Editar Perfil
                </button>
              </div>
            </div>

            {/* Verification Status */}
            <div className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Estado de Cuenta</h3>
              <div className="flex items-center gap-3 text-green-400 bg-green-900/10 p-3 rounded-xl border border-green-500/20">
                <FaShieldAlt className="text-xl" />
                <span className="font-medium text-sm">Identidad Verificada</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Info Grid */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8">
              <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FaUser className="text-blue-400 text-sm" />
                </span>
                Información Personal
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="group">
                  <label className="flex items-center gap-2 text-gray-400 text-sm mb-2 uppercase tracking-wider font-semibold">
                    <FaUser className="text-blue-500" />
                    Nombre Completo
                  </label>
                  <p className="font-medium text-white text-lg border-b border-white/10 pb-2 group-hover:border-blue-500/30 transition-colors">
                    {usuario.displayName || 'No registrado'}
                  </p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-gray-400 text-sm mb-2 uppercase tracking-wider font-semibold">
                    <FaEnvelope className="text-blue-500" />
                    Email
                  </label>
                  <p className="font-medium text-white text-lg border-b border-white/10 pb-2 group-hover:border-blue-500/30 transition-colors">
                    {usuario.email}
                  </p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-gray-400 text-sm mb-2 uppercase tracking-wider font-semibold">
                    <FaPhone className="text-blue-500" />
                    Teléfono
                  </label>
                  <p className="font-medium text-white text-lg border-b border-white/10 pb-2 group-hover:border-blue-500/30 transition-colors">
                    {datosUsuario?.phone || 'No registrado'}
                  </p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-gray-400 text-sm mb-2 uppercase tracking-wider font-semibold">
                    <FaMapMarkerAlt className="text-blue-500" />
                    Ubicación
                  </label>
                  <p className="font-medium text-white text-lg border-b border-white/10 pb-2 group-hover:border-blue-500/30 transition-colors">
                    {datosUsuario?.departamento
                      ? `${datosUsuario.distrito}, ${datosUsuario.provincia}, ${datosUsuario.departamento}`
                      : 'No registrado'}
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8">
              <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <FaChartLine className="text-green-400 text-sm" />
                </span>
                Resumen Financiero
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-blue-500/20 transition-all">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <FaUser className="text-6xl text-white" />
                  </div>
                  <p className="text-gray-400 mb-1">Saldo Disponible</p>
                  <p className="text-3xl font-bold text-white">
                    {formatCurrency(datosUsuario?.saldo || 0)}
                  </p>
                  <Link href="/billetera" className="text-blue-400 text-sm mt-4 inline-block hover:underline">
                    Ir a mi billetera →
                  </Link>
                </div>

                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-green-500/20 transition-all">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <FaChartLine className="text-6xl text-green-500" />
                  </div>
                  <p className="text-gray-400 mb-1">Ganancias Totales</p>
                  <p className="text-3xl font-bold text-green-400">
                    {formatCurrency(datosUsuario?.ganancia || 0)}
                  </p>
                  <Link href="/mis-inversiones" className="text-green-400 text-sm mt-4 inline-block hover:underline">
                    Ver mis inversiones →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
