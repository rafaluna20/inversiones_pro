/**
 * CUSTOM HOOK - PROYECTO BIFÁSICO
 * 
 * Hook para gestionar proyecto bifásico con real-time updates
 * Sincroniza con Firebase automáticamente
 * 
 * @version 2.0 Enterprise
 * @date 09/02/2026
 */

'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Producto } from '@/types';

export interface UseProyectoBifasicoReturn {
  proyecto: Producto | null;
  loading: boolean;
  error: string | null;

  // Helpers calculados
  esProyectoBifasico: boolean;
  etapaActual: 'tierra' | 'construccion' | 'finalizado' | null;
  porcentajeCompletadoTierra: number;
  porcentajeCompletadoConstruccion: number;
  porcentajeCompletadoTotal: number;

  // Métodos
  refresh: () => void;
}

/**
 * Hook para obtener y observar un proyecto bifásico
 * 
 * @example
 * const { proyecto, loading, porcentajeCompletadoTotal } = useProyectoBifasico('proyecto-123');
 */
export default function useProyectoBifasico(proyectoId: string): UseProyectoBifasicoReturn {
  const [proyecto, setProyecto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!proyectoId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const proyectoRef = doc(db, 'productos', proyectoId);

    // Suscripción en tiempo real
    const unsubscribe = onSnapshot(
      proyectoRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = {
            id: snapshot.id,
            ...snapshot.data()
          } as Producto;

          setProyecto(data);
        } else {
          setError('Proyecto no encontrado');
          setProyecto(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error obteniendo proyecto:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [proyectoId, refreshKey]);

  // Helpers calculados
  const esProyectoBifasico = proyecto?.modeloBifasico || false;

  const etapaActual = proyecto?.etapaActual || null;

  const porcentajeCompletadoTierra = proyecto?.etapas?.tierra
    ? (proyecto.etapas.tierra.montoRecaudado / proyecto.etapas.tierra.montoObjetivo) * 100
    : 0;

  const porcentajeCompletadoConstruccion = proyecto?.etapas?.construccion
    ? (proyecto.etapas.construccion.montoRecaudado / proyecto.etapas.construccion.montoObjetivo) * 100
    : 0;

  const porcentajeCompletadoTotal = proyecto?.etapas
    ? ((proyecto.etapas.tierra.montoRecaudado + proyecto.etapas.construccion.montoRecaudado) /
      (proyecto.etapas.tierra.montoObjetivo + proyecto.etapas.construccion.montoObjetivo)) * 100
    : 0;

  const refresh = () => setRefreshKey(prev => prev + 1);

  return {
    proyecto,
    loading,
    error,
    esProyectoBifasico,
    etapaActual,
    porcentajeCompletadoTierra: Number(porcentajeCompletadoTierra.toFixed(2)),
    porcentajeCompletadoConstruccion: Number(porcentajeCompletadoConstruccion.toFixed(2)),
    porcentajeCompletadoTotal: Number(porcentajeCompletadoTotal.toFixed(2)),
    refresh
  };
}
