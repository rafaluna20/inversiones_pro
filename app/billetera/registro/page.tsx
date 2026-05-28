'use client';

import { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useValidacion from '@/Hooks/useValidacion';
import validarCrearUsuarioBilletera from '@/Validacion/validarCrearUsuarioBilletera';

interface FormData {
  apellido: string;
  password: string;
  telefono: string;
}

const STATE_INICIAL: FormData = {
  apellido: '',
  password: '',
  telefono: '',
};

export default function RegistroBilletera() {
  const router = useRouter();
  const { usuario } = useAutenticacion();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<FormData>(STATE_INICIAL);

  // Funciones de API movidas al Server Action para evitar CORS

  // Función principal para crear cuenta
  const crearCuenta = async () => {
    if (!usuario) {
      setError('Debes iniciar sesión primero');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = {
        names: usuario.displayName || '',
        lastname: valores.apellido,
        email: usuario.email || '',
        password: valores.password,
        phone: valores.telefono,
      };

      const { registerWalletFullAction } = await import('@/app/actions/auth');
      const result = await registerWalletFullAction(data);

      if (result.success) {
        // Redirigir al dashboard de billetera
        setTimeout(() => {
          router.push(`/billetera`);
        }, 1000);
      } else {
        setError(('message' in result ? result.message : ('error' in result ? String(result.error) : undefined)) || 'Error desconocido al crear la cuenta');
      }
    } catch (error) {
      console.error('Error al crear cuenta:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const { valores, errores, handleSubmit, handleChange, handleBlur } =
    useValidacion(datosUsuario, validarCrearUsuarioBilletera, crearCuenta);

  const { apellido, telefono, password } = valores;

  // Limpiar error después de 2 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!usuario) {
    return (
      <div className="min-h-screen bg-[#1a1c21] flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Debes iniciar sesión primero</h2>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition"
          >
            Ir a Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1c21] text-white py-10 px-4">
      <div className="max-w-md mx-auto">
        {loading && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}

        <h2 className="text-3xl font-bold text-center mb-8">
          Crea tu cuenta de Yape
        </h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Nombre (solo lectura) */}
          <div className="space-y-2">
            <label htmlFor="nombre" className="block text-sm font-medium">
              Nombre
            </label>
            {errores.nombre && (
              <p className="text-red-500 text-sm">{errores.nombre}</p>
            )}
            <input
              type="text"
              id="nombre"
              name="nombre"
              placeholder="Tu Nombre"
              value={usuario.displayName || ''}
              readOnly
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>

          {/* Apellido */}
          <div className="space-y-2">
            <label htmlFor="apellido" className="block text-sm font-medium">
              Apellido
            </label>
            {errores.apellido && (
              <p className="text-red-500 text-sm">{errores.apellido}</p>
            )}
            <input
              type="text"
              id="apellido"
              name="apellido"
              placeholder="Tu Apellido"
              value={apellido}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>

          {/* Email (solo lectura) */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Correo
            </label>
            {errores.email && (
              <p className="text-red-500 text-sm">{errores.email}</p>
            )}
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Tu Correo"
              value={usuario.email || ''}
              readOnly
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>

          {/* Teléfono */}
          <div className="space-y-2">
            <label htmlFor="telefono" className="block text-sm font-medium">
              Teléfono
            </label>
            {errores.telefono && (
              <p className="text-red-500 text-sm">{errores.telefono}</p>
            )}
            <input
              type="text"
              id="telefono"
              name="telefono"
              placeholder="Tu teléfono"
              value={telefono}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={9}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              Contraseña (6 dígitos)
            </label>
            {errores.password && (
              <p className="text-red-500 text-sm">{errores.password}</p>
            )}
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Tu Contraseña"
              value={password}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={6}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>

          {/* Error general */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
              <p className="text-red-500 text-center">{error}</p>
            </div>
          )}

          {/* Botón Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition duration-200 text-lg"
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/billetera')}
            className="text-purple-400 hover:text-purple-300 transition"
          >
            ← Volver a Billetera
          </button>
        </div>
      </div>
    </div>
  );
}
