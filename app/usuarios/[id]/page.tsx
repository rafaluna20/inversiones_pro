'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { FaHeart, FaChartLine, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
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
          
          // Obtener productos del usuario
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Usuario no encontrado</h2>
          <Link href="/usuarios" className="btn-primary px-6 py-3">
            Ver Usuarios
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/usuarios" className="text-blue-600 hover:text-blue-700">
            ← Volver a Usuarios
          </Link>
        </div>

        {/* Perfil del Usuario */}
        <div className="card mb-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Foto */}
            <div className="flex-shrink-0">
              <img
                src={usuario.photoURL || '/static/img/imagenPerfil.png'}
                alt={usuario.nombre || 'Usuario'}
                className="w-32 h-32 rounded-full object-cover border-4 border-blue-100"
              />
            </div>

            {/* Información */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {usuario.nombre || 'Usuario'}
              </h1>
              
              <div className="flex flex-wrap gap-4 text-gray-600 mb-6">
                {usuario.email && (
                  <div className="flex items-center gap-2">
                    <FaEnvelope />
                    <span>{usuario.email}</span>
                  </div>
                )}
                {usuario.departamento && (
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt />
                    <span>{usuario.distrito}, {usuario.provincia}, {usuario.departamento}</span>
                  </div>
                )}
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <FaChartLine />
                    <span className="text-sm">Inversiones</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {usuario.inversionesCompletadas || 0}
                  </p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <FaHeart />
                    <span className="text-sm">Me gusta</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {usuario.like || 0}
                  </p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Ganancias</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(usuario.ganancia || 0)}
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Proyectos</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {productos.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Proyectos del Usuario */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Proyectos de {usuario.nombre || 'este usuario'}
          </h2>

          {productos.length === 0 ? (
            <div className="text-center py-20 card">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                Sin proyectos
              </h3>
              <p className="text-gray-600">
                Este usuario aún no ha publicado proyectos
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
