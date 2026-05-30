'use client';

/**
 * CUSTOM HOOK — GESTOR DE PROYECTOS
 *
 * Carga en tiempo real todos los proyectos donde el usuario
 * actúa como gestor (gestorId == usuarioId).
 * Calcula KPIs empresariales del gestor.
 *
 * @version 1.0 Enterprise
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Producto } from '@/types';

export interface GestorKPIs {
  aumTotal: number;             // Assets Under Management
  feeTotalGanado: number;       // Suma de fees ganados en proyectos liquidados
  proyectosActivos: number;
  proyectosLiquidados: number;
  roiHistoricoPromedio: number; // ROI promedio ponderado de proyectos completados
}

export interface UseGestorProyectosReturn {
  proyectos: Producto[];
  kpis: GestorKPIs;
  loading: boolean;
  error: string | null;
}

export default function useGestorProyectos(gestorId: string): UseGestorProyectosReturn {
  const [proyectos, setProyectos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gestorId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const qGestor = query(
      collection(db, 'productos'),
      where('gestorId', '==', gestorId)
    );

    const qCreador = query(
      collection(db, 'productos'),
      where('creador.id', '==', gestorId)
    );

    let productosGestor: Producto[] = [];
    let productosCreador: Producto[] = [];
    let unsubGestor = () => {};
    let unsubCreador = () => {};

    const procesarCombina = (pGestor: Producto[], pCreador: Producto[]) => {
      const mapa = new Map<string, Producto>();
      pGestor.forEach(p => mapa.set(p.id, p));
      pCreador.forEach(p => mapa.set(p.id, p));
      const combinados = Array.from(mapa.values()).sort((a, b) => {
        const creadoA = typeof a.creado === 'number' ? a.creado : 0;
        const creadoB = typeof b.creado === 'number' ? b.creado : 0;
        return creadoB - creadoA;
      });
      setProyectos(combinados);
      setLoading(false);
    };

    try {
      unsubGestor = onSnapshot(
        qGestor,
        (snapshot) => {
          productosGestor = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Producto[];
          procesarCombina(productosGestor, productosCreador);
        },
        (err) => {
          console.error('[useGestorProyectos] Error gestor query:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      unsubCreador = onSnapshot(
        qCreador,
        (snapshot) => {
          productosCreador = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Producto[];
          procesarCombina(productosGestor, productosCreador);
        },
        (err) => {
          console.error('[useGestorProyectos] Error creador query:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    } catch (err: any) {
      console.error('[useGestorProyectos] Subscription error:', err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      unsubGestor();
      unsubCreador();
    };
  }, [gestorId]);

  // Calcular KPIs
  const kpis: GestorKPIs = (() => {
    const activos = proyectos.filter((p) => p.estado !== false);
    const liquidados = proyectos.filter((p) => p.distribucionEjecutada === true || p.estado === false);

    // AUM = suma del capital objetivo de cada proyecto (p.precio = montoObjetivo del formulario)
    const aumTotal = proyectos.reduce((sum, p) => sum + Number(p.precio || p.monto || 0), 0);

    const feeTotalGanado = liquidados.reduce((sum, p) => {
      const capital = Number(p.precio || p.monto || 0);
      const utilidad = Number(p.utilidadNeta || (capital * 0.15));
      const comision = Number(p.comisionGestor || 10);
      return sum + utilidad * (comision / 100);
    }, 0);

    const roiHistoricoPromedio =
      liquidados.length > 0
        ? liquidados.reduce((sum, p) => {
            const capital = Number(p.precio || p.monto || 0);
            const utilidad = Number(p.utilidadNeta || (capital * 0.15));
            const comision = Number(p.comisionGestor || 10);
            // ROI del pool para los socios en base a la utilidad y comisión del gestor
            const poolSocios = utilidad * (1 - comision / 100);
            return sum + (capital > 0 ? (poolSocios / capital) * 100 : 0);
          }, 0) / liquidados.length
        : 0;

    return {
      aumTotal,
      feeTotalGanado,
      proyectosActivos: activos.length,
      proyectosLiquidados: liquidados.length,
      roiHistoricoPromedio: parseFloat(roiHistoricoPromedio.toFixed(2)),
    };
  })();

  return { proyectos, kpis, loading, error };
}
