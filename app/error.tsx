'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log del error para debugging
    console.error('Error capturado:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Algo salió mal
          </h2>
          <p className="text-gray-600 mb-6">
            {error.message || 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.'}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full btn-primary py-3 text-lg"
          >
            Intentar de nuevo
          </button>
          <Link
            href="/"
            className="block w-full btn-outline py-3 text-lg"
          >
            Volver al inicio
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && error.digest && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg text-left">
            <p className="text-xs text-gray-600 font-mono">
              Error ID: {error.digest}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
