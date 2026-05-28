/**
 * CUSTOM HOOK - MIS INVERSIONES
 * 
 * Hook para obtener las inversiones de un usuario
 * Incluye inversiones en proyectos bifásicos
 * 
 * @version 2.0 Enterprise
 * @date 09/02/2026
 */

'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Inversion } from '@/types';

export interface UseMisInversionesReturn {
  inversiones: Inversion[];
  loading: boolean;
  error: string | null;

  // Estadísticas calculadas
  totalInvertido: number;
  gananciaTotal: number;
  roiPromedio: number;
  numeroProyectos: number;
  inversionesPendientes: number;
  inversionesConfirmadas: number;

  // Métodos
  refresh: () => void;
}

/**
 * Hook para obtener inversiones de un usuario
 * 
 * @example
 * const { inversiones, totalInvertido, roiPromedio } = useMisInversiones('user-123');
 */
export default function useMisInversiones(usuarioId: string): UseMisInversionesReturn {
  const [inversiones, setInversiones] = useState<Inversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!usuarioId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'inversiones'),
      where('usuarioId', '==', usuarioId),
      orderBy('fechaInversion', 'desc')
    );

    // Suscripción en tiempo real
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Inversion[];

        setInversiones(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error obteniendo inversiones:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [usuarioId, refreshKey]);

  // Estadísticas calculadas
  const totalInvertido = inversiones
    .filter(inv => inv.confirmada)
    .reduce((sum, inv) => sum + inv.montoInvertido, 0);

  const gananciaTotal = inversiones
    .reduce((sum, inv) => sum + inv.gananciaReal, 0);

  const inversionesConfirmadas = inversiones.filter(inv => inv.confirmada);

  const roiPromedio = inversionesConfirmadas.length > 0
    ? inversionesConfirmadas.reduce((sum, inv) => {
      const roi = inv.roiReal || inv.roiProyectado;
      return sum + roi;
    }, 0) / inversionesConfirmadas.length
    : 0;

  const proyectosUnicos = new Set(inversiones.map(inv => inv.proyectoId));
  const numeroProyectos = proyectosUnicos.size;

  const inversionesPendientes = inversiones.filter(
    inv => !inv.confirmada
  ).length;

  const refresh = () => setRefreshKey(prev => prev + 1);

  return {
    inversiones,
    loading,
    error,
    totalInvertido,
    gananciaTotal,
    roiPromedio: Number(roiPromedio.toFixed(2)),
    numeroProyectos,
    inversionesPendientes,
    inversionesConfirmadas: inversionesConfirmadas.length,
    refresh
  };
}
