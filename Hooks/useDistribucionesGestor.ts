'use client';

/**
 * HOOK — DISTRIBUCIONES DEL GESTOR
 *
 * Carga en tiempo real todos los documentos de distribución
 * ejecutados por el gestor (colección 'distribuciones').
 * Alimenta la lista de comprobantes PDF descargables.
 *
 * @version 1.0 Enterprise
 */

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Distribucion } from '@/types';

export interface UseDistribucionesGestorReturn {
  distribuciones: Distribucion[];
  loading: boolean;
  error: string | null;
}

export default function useDistribucionesGestor(gestorId: string): UseDistribucionesGestorReturn {
  const [distribuciones, setDistribuciones] = useState<Distribucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gestorId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'distribuciones'),
      where('gestorId', '==', gestorId),
      orderBy('fechaEjecucion', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Distribucion[];
        setDistribuciones(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useDistribucionesGestor] Error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gestorId]);

  return { distribuciones, loading, error };
}
