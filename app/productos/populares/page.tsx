'use client';

import { useEffect } from 'react';
import useProductos from '@/Hooks/useProductos';
import useAutenticacion from '@/Hooks/useAutenticacion';
import ProductCard from '@/components/productos/ProductCard';

export default function PopularesPage() {
  const { productos, loading, error } = useProductos('votos');
  const { usuario } = useAutenticacion();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando productos populares...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Productos Populares
          </h1>
          <p className="text-gray-400">
            Los productos con más votos de la comunidad
          </p>
        </div>

        {/* Grid de Productos */}
        {productos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productos.map((producto) => (
              <ProductCard
                key={producto.id}
                producto={producto}
                usuarioId={usuario?.uid}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-xl">
              No hay productos disponibles en este momento
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
