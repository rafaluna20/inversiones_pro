'use client';

import { useState, useEffect, useCallback } from 'react';
import { loginAction, logoutAction, checkSessionAction } from '@/app/actions/auth';

interface UseTokenBilleteraReturn {
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  loginBilletera: (formData: FormData) => Promise<boolean>;
  logout: () => Promise<void>;
}

export default function useTokenBilletera(): UseTokenBilleteraReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const result = await checkSessionAction();
        setIsAuthenticated(result.isAuthenticated);
      } catch (err) {
        console.error('Session check failed', err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const loginBilletera = async (formData: FormData): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginAction(formData);
      if (result.success) {
        setIsAuthenticated(true);
        return true;
      } else {
        setError(result.message || 'Login failed');
        return false;
      }
    } catch (err) {
      setError('Connection error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutAction();
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    loading,
    error,
    loginBilletera,
    logout
  };
}
