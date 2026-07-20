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

import type { DistribucionSocio } from '@/types';

/**
 * Solo los campos que este motor realmente lee. Antes el parámetro era
 * `Inversion[]` completo (con una docena de campos que nunca se usan acá) —
 * eso obligaba a quien llamara a esta función a fabricar objetos falsos con
 * todos esos campos con tal de satisfacer el tipo, incluso cuando los datos
 * reales vienen de un modelo distinto (el array `producto.inversores[]`,
 * ver app/actions/distribucion.ts). `Inversion[]` real sigue siendo
 * compatible acá sin cambios, por tipado estructural.
 */
export interface InversionParaDistribucion {
  usuarioId: string;
  montoInvertido: number;
  confirmada: boolean;
}

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
  inversiones: InversionParaDistribucion[],
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

  // Reparto de céntimos por el método del mayor resto: garantiza que la suma
  // de gananciaDistribuida de todos los socios sea EXACTAMENTE poolSocios,
  // sin descuadres por redondear cada socio de forma independiente (crítico
  // en un reporte que se firma con hash SHA-256 como "auditable e inmutable").
  const poolCentavos = Math.round(poolSocios * 100);

  const partes = inversionesConfirmadas.map((inv) => {
    const montoInvertido = Number(inv.montoInvertido || 0);
    const shareExacto = poolSocios * (montoInvertido / capitalTotalSocios);
    // Redondeado a 6 decimales de céntimo para eliminar ruido de coma
    // flotante antes de separar parte entera y resto.
    const centavosExactos = Math.round(shareExacto * 100 * 1e6) / 1e6;
    const centavosBase = Math.floor(centavosExactos);
    return {
      inv,
      montoInvertido,
      participacionPorcentaje: parseFloat(((montoInvertido / capitalTotalSocios) * 100).toFixed(4)),
      centavosBase,
      resto: centavosExactos - centavosBase,
    };
  });

  const centavosAsignados = partes.reduce((sum, p) => sum + p.centavosBase, 0);
  let centavosRemanentes = poolCentavos - centavosAsignados;

  // Asigna el céntimo sobrante a quienes tienen el mayor resto (orden estable
  // ante empates), hasta agotar la diferencia entre lo asignado y el pool real.
  const ordenPorResto = [...partes].sort((a, b) => b.resto - a.resto);
  for (let i = 0; i < ordenPorResto.length && centavosRemanentes > 0; i++, centavosRemanentes--) {
    ordenPorResto[i].centavosBase += 1;
  }
  // Si el redondeo del pool dejara remanente negativo (caso extremo por
  // ruido de coma flotante), se resta desde quienes tienen el menor resto.
  for (let i = ordenPorResto.length - 1; i >= 0 && centavosRemanentes < 0; i--, centavosRemanentes++) {
    ordenPorResto[i].centavosBase -= 1;
  }

  const distribucionPorSocio: DistribucionSocio[] = partes.map((p) => ({
    usuarioId: p.inv.usuarioId,
    proyectoId,
    montoInvertido: p.montoInvertido,
    participacionPorcentaje: p.participacionPorcentaje,
    gananciaDistribuida: parseFloat((p.centavosBase / 100).toFixed(2)),
  }));

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
