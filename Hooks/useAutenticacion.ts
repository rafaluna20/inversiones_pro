'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

import { signOut } from 'firebase/auth';

interface UseAutenticacionReturn {
  usuario: User | null;
  loading: boolean;
  error: Error | null;
  cerrarSesion: () => Promise<void>;
}

export default function useAutenticacion(): UseAutenticacionReturn {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          setUsuario(user);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.error('Error en autenticación:', error);
          setError(error as Error);
          setLoading(false);
        }
      );

      // Cleanup function que siempre se ejecuta
      return () => {
        unsubscribe();
      };
    } catch (err) {
      console.error('Error al configurar autenticación:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, []);

  const cerrarSesion = async () => {
    try {
      const { logoutAction } = await import('@/app/actions/auth');
      await logoutAction();
    } catch (e) {
      console.error('Error al limpiar sesión de billetera', e);
    }
    await signOut(auth);
  };

  return { usuario, loading, error, cerrarSesion };
}
