/**
 * MOTOR DE DISTRIBUCIÓN DE UTILIDADES — 10/90
 *
 * Motor puro de cálculo sin efectos secundarios.
 * Totalmente testeable de forma unitaria.
 *
 * Fórmula:
 *   feeGestor    = utilidadNeta × (comisionGestor / 100)
 *   poolSocios   = utilidadNeta − feeGestor
 *   ganancia[i]  = poolSocios × (inversión[i] / capitalTotal)
 *
 * @version 1.0 Enterprise
 */

import type { Inversion, DistribucionSocio } from '@/types';

export interface ResultadoDistribucion {
  utilidadNeta: number;
  comisionGestorPorcentaje: number;
  feeGestor: number;
  poolSocios: number;
  capitalTotalSocios: number;
  distribucionPorSocio: DistribucionSocio[];
}

export interface ErrorDistribucion {
  code: 'UTILIDAD_INVALIDA' | 'SIN_SOCIOS' | 'CAPITAL_CERO' | 'COMISION_INVALIDA';
  mensaje: string;
}

export type ResultadoCalculo =
  | { ok: true; data: ResultadoDistribucion }
  | { ok: false; error: ErrorDistribucion };

/**
 * Calcula la distribución de utilidades entre el gestor y los socios.
 *
 * @param utilidadNeta - Utilidad neta total del proyecto (debe ser > 0)
 * @param comisionGestor - Porcentaje de comisión del gestor (5–20)
 * @param inversiones - Array de inversiones confirmadas del proyecto
 * @param proyectoId - ID del proyecto para incluir en cada DistribucionSocio
 */
export function calcularDistribucion(
  utilidadNeta: number,
  comisionGestor: number,
  inversiones: Inversion[],
  proyectoId: string
): ResultadoCalculo {
  // --- Validaciones ---
  if (!Number.isFinite(utilidadNeta) || utilidadNeta <= 0) {
    return {
      ok: false,
      error: { code: 'UTILIDAD_INVALIDA', mensaje: 'La utilidad neta debe ser un número positivo.' },
    };
  }

  if (comisionGestor < 5 || comisionGestor > 20 || !Number.isFinite(comisionGestor)) {
    return {
      ok: false,
      error: { code: 'COMISION_INVALIDA', mensaje: 'La comisión del gestor debe estar entre 5% y 20%.' },
    };
  }

  const inversionesConfirmadas = inversiones.filter((inv) => inv.confirmada);

  if (inversionesConfirmadas.length === 0) {
    return {
      ok: false,
      error: { code: 'SIN_SOCIOS', mensaje: 'No hay inversiones confirmadas en este proyecto.' },
    };
  }

  const capitalTotalSocios = inversionesConfirmadas.reduce(
    (sum, inv) => sum + Number(inv.montoInvertido || 0),
    0
  );

  if (capitalTotalSocios <= 0) {
    return {
      ok: false,
      error: { code: 'CAPITAL_CERO', mensaje: 'El capital total de los socios es cero.' },
    };
  }

  // --- Cálculos centrales ---
  const feeGestor = parseFloat((utilidadNeta * (comisionGestor / 100)).toFixed(2));
  const poolSocios = parseFloat((utilidadNeta - feeGestor).toFixed(2));

  const distribucionPorSocio: DistribucionSocio[] = inversionesConfirmadas.map((inv) => {
    const montoInvertido = Number(inv.montoInvertido || 0);
    const participacionPorcentaje = parseFloat(
      ((montoInvertido / capitalTotalSocios) * 100).toFixed(4)
    );
    const gananciaDistribuida = parseFloat(
      (poolSocios * (montoInvertido / capitalTotalSocios)).toFixed(2)
    );

    return {
      usuarioId: inv.usuarioId,
      proyectoId,
      montoInvertido,
      participacionPorcentaje,
      gananciaDistribuida,
    };
  });

  return {
    ok: true,
    data: {
      utilidadNeta,
      comisionGestorPorcentaje: comisionGestor,
      feeGestor,
      poolSocios,
      capitalTotalSocios,
      distribucionPorSocio,
    },
  };
}

/** Formatea moneda en soles peruanos */
export function formatearSoles(n: number): string {
  return `S/ ${Number(n || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
