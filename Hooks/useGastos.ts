/**
 * Hook personalizado para gestionar gastos de proyectos
 * Maneja estado, carga, y operaciones CRUD
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GastoProyecto, CategoriaGasto } from '@/types';
import {
  agregarGasto,
  actualizarGasto,
  eliminarGasto,
  obtenerGastosProyecto,
  obtenerGastosPorCategoria,
  obtenerResumenGastosPorCategoria,
  validarPermisosGastos
} from '@/lib/firebase/gastos';
import { showToast } from '@/lib/toast';

interface UseGastosReturn {
  gastos: GastoProyecto[];
  loading: boolean;
  error: string | null;
  totalGastos: number;
  resumenPorCategoria: Record<string, number>;
  tienePermisos: boolean;
  validandoPermisos: boolean;
  
  // Operaciones
  agregar: (gasto: Omit<GastoProyecto, 'id' | 'proyectoId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  actualizar: (gastoId: string, datos: Partial<Omit<GastoProyecto, 'id' | 'proyectoId'>>) => Promise<void>;
  eliminar: (gastoId: string, motivo?: string) => Promise<void>;
  recargar: () => Promise<void>;
  filtrarPorCategoria: (categoria: CategoriaGasto | null) => GastoProyecto[];
}

/**
 * Hook para gestionar gastos de un proyecto
 * @param proyectoId ID del proyecto
 * @param usuarioId ID del usuario actual (para validar permisos)
 * @returns Objeto con gastos, loading, operaciones CRUD y utilidades
 */
export default function useGastos(
  proyectoId: string,
  usuarioId?: string
): UseGastosReturn {
  const [gastos, setGastos] = useState<GastoProyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumenPorCategoria, setResumenPorCategoria] = useState<Record<string, number>>({});
  const [tienePermisos, setTienePermisos] = useState(false);
  const [validandoPermisos, setValidandoPermisos] = useState(true);

  // Calcular total de gastos
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);

  /**
   * Cargar gastos del proyecto
   */
  const cargarGastos = useCallback(async () => {
    if (!proyectoId) return;

    try {
      setLoading(true);
      setError(null);

      const [gastosData, resumen] = await Promise.all([
        obtenerGastosProyecto(proyectoId),
        obtenerResumenGastosPorCategoria(proyectoId)
      ]);

      setGastos(gastosData);
      setResumenPorCategoria(resumen);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al cargar gastos';
      setError(mensaje);
      console.error('Error al cargar gastos:', err);
      showToast.error(mensaje);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  /**
   * Validar permisos del usuario
   */
  const validarPermisos = useCallback(async () => {
    if (!proyectoId || !usuarioId) {
      setTienePermisos(false);
      setValidandoPermisos(false);
      return;
    }

    try {
      setValidandoPermisos(true);
      const permisos = await validarPermisosGastos(proyectoId, usuarioId);
      setTienePermisos(permisos);
    } catch (err) {
      console.error('Error al validar permisos:', err);
      setTienePermisos(false);
    } finally {
      setValidandoPermisos(false);
    }
  }, [proyectoId, usuarioId]);

  /**
   * Agregar nuevo gasto
   */
  const agregar = useCallback(async (
    gasto: Omit<GastoProyecto, 'id' | 'proyectoId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!tienePermisos) {
      showToast.error('No tienes permisos para agregar gastos');
      throw new Error('Sin permisos');
    }

    try {
      setLoading(true);
      // Agregar proyectoId al objeto gasto
      await agregarGasto(proyectoId, {
        ...gasto,
        proyectoId
      });
      
      // Recargar gastos
      await cargarGastos();
      
      showToast.success('Gasto agregado exitosamente');
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al agregar gasto';
      showToast.error(mensaje);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [proyectoId, tienePermisos, cargarGastos]);

  /**
   * Actualizar un gasto existente
   */
  const actualizar = useCallback(async (
    gastoId: string,
    datos: Partial<Omit<GastoProyecto, 'id' | 'proyectoId'>>
  ) => {
    if (!tienePermisos) {
      showToast.error('No tienes permisos para actualizar gastos');
      throw new Error('Sin permisos');
    }

    try {
      setLoading(true);
      await actualizarGasto(proyectoId, gastoId, datos);
      
      // Recargar gastos
      await cargarGastos();
      
      showToast.success('Gasto actualizado exitosamente');
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al actualizar gasto';
      showToast.error(mensaje);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [proyectoId, tienePermisos, cargarGastos]);

  /**
   * Eliminar un gasto
   */
  const eliminar = useCallback(async (
    gastoId: string,
    motivo?: string
  ) => {
    if (!tienePermisos || !usuarioId) {
      showToast.error('No tienes permisos para eliminar gastos');
      throw new Error('Sin permisos');
    }

    try {
      setLoading(true);
      await eliminarGasto(proyectoId, gastoId, usuarioId, motivo);
      
      // Recargar gastos
      await cargarGastos();
      
      showToast.success('Gasto eliminado exitosamente');
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al eliminar gasto';
      showToast.error(mensaje);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [proyectoId, usuarioId, tienePermisos, cargarGastos]);

  /**
   * Recargar gastos manualmente
   */
  const recargar = useCallback(async () => {
    await cargarGastos();
  }, [cargarGastos]);

  /**
   * Filtrar gastos por categoría
   */
  const filtrarPorCategoria = useCallback((categoria: CategoriaGasto | null): GastoProyecto[] => {
    if (!categoria) return gastos;
    return gastos.filter(g => g.categoria === categoria);
  }, [gastos]);

  // Cargar gastos al montar y cuando cambie proyectoId
  useEffect(() => {
    cargarGastos();
  }, [cargarGastos]);

  // Validar permisos cuando cambie usuarioId o proyectoId
  useEffect(() => {
    validarPermisos();
  }, [validarPermisos]);

  return {
    gastos,
    loading,
    error,
    totalGastos,
    resumenPorCategoria,
    tienePermisos,
    validandoPermisos,
    agregar,
    actualizar,
    eliminar,
    recargar,
    filtrarPorCategoria
  };
}
