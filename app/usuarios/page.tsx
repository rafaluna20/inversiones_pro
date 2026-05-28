'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import { FaHeart, FaChartLine, FaUserTie, FaMapMarkerAlt } from 'react-icons/fa';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const usuariosRef = collection(db, 'usuarios');
        const q = query(usuariosRef, orderBy('like', 'desc'));
        const querySnapshot = await getDocs(q);

        const usuariosData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setUsuarios(usuariosData);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin blur-[1px]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-12 border-l-4 border-blue-500 pl-6">
          <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab">Comunidad de Inversores</h1>
          <p className="text-gray-400 text-lg">Conecta con otros líderes del sector inmobiliario</p>
        </div>

        {usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[32px] text-center p-8">
            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
              <FaUserTie className="text-6xl text-gray-600" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-4 font-roboto-slab">
              No hay inversores registrados
            </h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-lg">
              Sé el primero en unirte a nuestra comunidad exclusiva.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {usuarios.map((usuario) => (
              <Link
                key={usuario.id}
                href={`/usuarios/${usuario.id}`}
                className="group relative bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[24px] p-6 hover:bg-slate-800/60 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-blue-500/10"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-[24px] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="text-center relative z-10">
                  <div className="relative inline-block mb-4">
                    <img
                      src={usuario.photoURL || '/static/img/imagenPerfil.png'}
                      alt={usuario.nombre || 'Usuario'}
                      className="w-28 h-28 rounded-full object-cover border-4 border-slate-800 group-hover:border-blue-500/50 transition-colors shadow-xl"
                    />
                    {usuario.verificado && (
                      <div className="absolute bottom-1 right-1 bg-blue-500 text-white p-1.5 rounded-full border-2 border-slate-900" title="Verificado">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">
                    {usuario.nombre || 'Inversor Anónimo'}
                  </h3>

                  <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 mb-4">
                    <FaMapMarkerAlt className="text-xs" />
                    <span className="truncate max-w-[150px]">{usuario.departamento || 'Ubicación no especificada'}</span>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-white/5 mx-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5 text-red-400 font-bold">
                        <FaHeart className="text-sm" />
                        <span>{usuario.like || 0}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Likes</span>
                    </div>

                    <div className="w-px h-8 bg-white/5"></div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                        <FaChartLine className="text-sm" />
                        <span>{usuario.inversionesCompletadas || 0}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Inversiones</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
