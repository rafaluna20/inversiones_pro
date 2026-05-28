'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';

export default function MapaPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productoSeleccionado, setProductoSeleccionado] = useState<any>(null);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const productosRef = collection(db, 'productos');
        const querySnapshot = await getDocs(productosRef);
        
        const productosData = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((p: any) => p.coordenadas || p.cordenadas);
        
        setProductos(productosData);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar productos:', error);
        setLoading(false);
      }
    };

    fetchProductos();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Mapa de Proyectos</h1>
          <p className="text-gray-600">Explora los proyectos en el mapa</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Proyectos */}
          <div className="lg:col-span-1 space-y-4 max-h-[600px] overflow-y-auto">
            <div className="card">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Proyectos ({productos.length})
              </h3>
              <div className="space-y-3">
                {productos.map((producto) => (
                  <div
                    key={producto.id}
                    onClick={() => setProductoSeleccionado(producto)}
                    className={`p-3 border rounded-lg cursor-pointer transition ${
                      productoSeleccionado?.id === producto.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <h4 className="font-semibold text-gray-800 mb-1">
                      {producto.nombre}
                    </h4>
                    <p className="text-sm text-gray-600">{producto.empresa}</p>
                    <Link
                      href={`/productos/${producto.id}`}
                      className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Ver detalles →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mapa */}
          <div className="lg:col-span-2">
            <div className="card h-[600px]">
              {productoSeleccionado ? (
                <div className="h-full">
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800">
                      {productoSeleccionado.nombre}
                    </h3>
                    <p className="text-gray-600">{productoSeleccionado.empresa}</p>
                  </div>
                  <div className="h-[calc(100%-100px)]">
                    {(productoSeleccionado.coordenadas || productoSeleccionado.cordenadas) && (
                      <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        className="rounded-lg"
                        src={`https://www.google.com/maps?q=${
                          (productoSeleccionado.coordenadas || productoSeleccionado.cordenadas).lat
                        },${
                          (productoSeleccionado.coordenadas || productoSeleccionado.cordenadas).lng
                        }&z=15&output=embed`}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🗺️</div>
                    <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                      Selecciona un proyecto
                    </h3>
                    <p className="text-gray-600">
                      Haz clic en un proyecto de la lista para ver su ubicación
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
