'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useProductos from '@/Hooks/useProductos';
import useAutenticacion from '@/Hooks/useAutenticacion';
import ProductCard from '@/components/productos/ProductCard';
import { Producto } from '@/types';
import { FaSearch } from 'react-icons/fa';

export default function BuscarPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const { productos, loading } = useProductos('creado');
  const { usuario } = useAutenticacion();
  const [resultados, setResultados] = useState<Producto[]>([]);

  useEffect(() => {
    if (q && productos.length > 0) {
      const busqueda = q.toLowerCase();
      const filtrados = productos.filter((producto) => {
        return (
          producto.nombre.toLowerCase().includes(busqueda) ||
          producto.descripcion?.toLowerCase().includes(busqueda)
        );
      });
      setResultados(filtrados);
    } else {
      setResultados([]);
    }
  }, [q, productos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Buscando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header con término de búsqueda */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FaSearch className="text-blue-500 text-3xl" />
            <h1 className="text-4xl font-bold text-white">
              Resultados de búsqueda
            </h1>
          </div>
          {q && (
            <p className="text-gray-400 text-lg">
              Búsqueda: <span className="text-blue-400 font-semibold">"{q}"</span>
              {' - '}
              <span className="text-white font-semibold">{resultados.length}</span> resultados encontrados
            </p>
          )}
        </div>

        {/* Resultados */}
        {!q ? (
          <div className="text-center py-20">
            <FaSearch className="text-gray-600 text-6xl mx-auto mb-4" />
            <p className="text-gray-400 text-xl">
              Introduce un término de búsqueda para ver resultados
            </p>
          </div>
        ) : resultados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {resultados.map((producto) => (
              <ProductCard
                key={producto.id}
                producto={producto}
                usuarioId={usuario?.uid}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-xl mb-2">
              No se encontraron productos que coincidan con "{q}"
            </p>
            <p className="text-gray-500">
              Intenta con otros términos de búsqueda
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
