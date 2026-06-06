'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { FaHeart, FaChartLine, FaEnvelope, FaMapMarkerAlt, FaCheckCircle, FaBriefcase, FaArrowLeft } from 'react-icons/fa';
import ProductCard from '@/components/productos/ProductCard';

export default function UsuarioPublicoPage() {
  const params = useParams();
  const [usuario, setUsuario] = useState<any>(null);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    const fetchUsuario = async () => {
      try {
        const usuarioRef = doc(db, 'usuarios', params.id as string);
        const docSnap = await getDoc(usuarioRef);
        
        if (docSnap.exists()) {
          setUsuario({ id: docSnap.id, ...docSnap.data() });
          
          // Obtener proyectos/productos del usuario
          const productosRef = collection(db, 'productos');
          const q = query(productosRef, where('creador.id', '==', params.id));
          const querySnapshot = await getDocs(q);
          
          const productosData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setProductos(productosData);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar usuario:', error);
        setLoading(false);
      }
    };

    fetchUsuario();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-blue-400 font-medium animate-pulse">Cargando perfil...</p>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-10 text-center max-w-md w-full">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-3xl font-bold text-white mb-4 font-roboto-slab">Perfil no encontrado</h2>
          <p className="text-slate-400 mb-8">El inversor que buscas no existe o ha sido eliminado.</p>
          <Link href="/usuarios" className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
            Volver al Directorio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/usuarios" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group bg-slate-900/50 px-4 py-2 rounded-full border border-white/5 hover:border-white/20">
            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
            <span>Volver al Directorio</span>
          </Link>
        </div>

        {/* --- HEADER PROFILE CARD --- */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl mb-12">
          {/* Cover Image */}
          <div className="h-48 md:h-64 w-full bg-slate-800 relative overflow-hidden">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-blue-600 via-slate-900 to-slate-900"></div>
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
          </div>

          <div className="px-6 md:px-12 pb-10 relative">
            <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10 -mt-20 md:-mt-24 mb-8">
              {/* Avatar */}
              <div className="relative inline-block self-start md:self-auto">
                <div className="p-1.5 bg-slate-950 rounded-full inline-block shadow-2xl">
                  <img
                    src={usuario.photoURL || '/static/img/imagenPerfil.png'}
                    alt={usuario.nombre || 'Usuario'}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-slate-800 bg-slate-900"
                  />
                </div>
                {usuario.verificado && (
                  <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-blue-500 text-white p-1.5 md:p-2 rounded-full border-4 border-slate-950 shadow-lg" title="Inversor Verificado">
                    <FaCheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="flex-1 pb-2">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-white font-roboto-slab">
                    {usuario.nombre || 'Inversor Anónimo'}
                  </h1>
                  {usuario.rol === 'gestor' && (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                      Gestor Autorizado
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-slate-400 mt-2">
                  {usuario.email && (
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5">
                      <FaEnvelope className="text-slate-500" />
                      <span className="text-sm">{usuario.email}</span>
                    </div>
                  )}
                  {usuario.departamento && (
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5">
                      <FaMapMarkerAlt className="text-blue-500/70" />
                      <span className="text-sm">
                        {[usuario.distrito, usuario.provincia, usuario.departamento].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <FaChartLine className="text-emerald-400 text-lg" />
                  </div>
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Inversiones</span>
                </div>
                <p className="text-3xl font-bold text-white pl-1">{usuario.inversionesCompletadas || 0}</p>
              </div>

              <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <FaHeart className="text-red-400 text-lg" />
                  </div>
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Reputación</span>
                </div>
                <p className="text-3xl font-bold text-white pl-1">{usuario.like || 0}</p>
              </div>

              <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <span className="text-green-400 text-lg font-bold">$</span>
                  </div>
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Ganancias</span>
                </div>
                <p className="text-2xl lg:text-3xl font-bold text-green-400 pl-1 truncate" title={formatCurrency(usuario.ganancia || 0)}>
                  {formatCurrency(usuario.ganancia || 0)}
                </p>
              </div>

              <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <FaBriefcase className="text-purple-400 text-lg" />
                  </div>
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Proyectos</span>
                </div>
                <p className="text-3xl font-bold text-white pl-1">{productos.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- PROYECTOS DEL USUARIO --- */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8 border-l-4 border-blue-500 pl-4">
            <h2 className="text-2xl font-bold text-white font-roboto-slab">
              Portafolio de Proyectos
            </h2>
            <span className="bg-slate-800 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full">
              {productos.length}
            </span>
          </div>

          {productos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-3xl text-center p-8">
              <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                <FaBriefcase className="text-4xl text-slate-600" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 font-roboto-slab">
                Sin proyectos públicos
              </h3>
              <p className="text-slate-400 max-w-md mx-auto">
                Este inversor aún no ha publicado proyectos en la plataforma o están configurados como privados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {productos.map((producto) => (
                <ProductCard key={producto.id} producto={producto} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
