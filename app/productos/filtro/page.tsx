'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useProductos from '@/Hooks/useProductos';
import useAutenticacion from '@/Hooks/useAutenticacion';
import ProductCard from '@/components/productos/ProductCard';
import { Producto, CategoriaProducto } from '@/types';
import { FaFilter } from 'react-icons/fa';

const CATEGORIAS: Record<CategoriaProducto, string> = {
  departamento: 'Departamento',
  terreno: 'Terreno',
  casa: 'Casa',
  oficina: 'Oficina',
  localComercial: 'Local Comercial',
  habilitacionUrbana: 'Habilitación Urbana',
};

export default function FiltroPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const { productos, loading } = useProductos('creado');
  const { usuario } = useAutenticacion();
  const [resultados, setResultados] = useState<Producto[]>([]);

  useEffect(() => {
    if (q && productos.length > 0) {
      const categoriaFiltro = q.toLowerCase();
      const filtrados = productos.filter((producto) => {
        return producto.categoria.toLowerCase().includes(categoriaFiltro);
      });
      setResultados(filtrados);
    } else {
      setResultados([]);
    }
  }, [q, productos]);

  const categoriaNombre = q ? CATEGORIAS[q as CategoriaProducto] || q : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Filtrando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header con categoría */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FaFilter className="text-purple-500 text-3xl" />
            <h1 className="text-4xl font-bold text-white">
              Filtrar por Categoría
            </h1>
          </div>
          {q && (
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-purple-600 text-white rounded-full font-semibold">
                {categoriaNombre}
              </span>
              <p className="text-gray-400">
                <span className="text-white font-semibold">{resultados.length}</span> productos encontrados
              </p>
            </div>
          )}
        </div>

        {/* Lista de Categorías */}
        {!q && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">
              Selecciona una categoría:
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(CATEGORIAS).map(([key, nombre]) => (
                <a
                  key={key}
                  href={`/productos/filtro?q=${key}`}
                  className="bg-gray-800 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition text-center"
                >
                  {nombre}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Resultados */}
        {!q ? (
          <div className="text-center py-20">
            <FaFilter className="text-gray-600 text-6xl mx-auto mb-4" />
            <p className="text-gray-400 text-xl">
              Selecciona una categoría para ver los productos
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
              No hay productos en la categoría "{categoriaNombre}"
            </p>
            <p className="text-gray-500">
              Intenta con otra categoría
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
