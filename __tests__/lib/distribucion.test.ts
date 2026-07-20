/**
 * Unit Tests - Motor de Distribución de Utilidades 10/90
 * Cobertura de lib/distribucion.ts (lógica financiera crítica)
 */

import {
  calcularDistribucion,
  formatearSoles,
} from '@/lib/distribucion';
import type { Inversion } from '@/types';

/** Helper: construye una Inversion mínima válida para los tests */
function crearInversion(overrides: Partial<Inversion>): Inversion {
  return {
    id: overrides.id ?? 'inv-1',
    proyectoId: overrides.proyectoId ?? 'proj-1',
    usuarioId: overrides.usuarioId ?? 'user-1',
    tipoInversion: 'capital',
    etapa: 'construccion',
    montoInvertido: overrides.montoInvertido ?? 1000,
    cubosComprados: 1,
    porcentajeParticipacion: 0,
    contrato: { numeroContrato: 'C-1', tipoContrato: 'estandar' },
    transaccionOdoo: { estado: 'confirmada' },
    roiProyectado: 0,
    gananciaEstimada: 0,
    gananciaReal: 0,
    confirmada: overrides.confirmada ?? true,
    fechaInversion: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('Motor de Distribución 10/90 - calcularDistribucion', () => {
  const PROYECTO_ID = 'proj-1';

  describe('Cálculos correctos', () => {
    test('reparte 10/90 entre gestor y un único socio', () => {
      const inversiones = [
        crearInversion({ usuarioId: 'u1', montoInvertido: 10000 }),
      ];
      const res = calcularDistribucion(100000, 10, inversiones, PROYECTO_ID);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.feeGestor).toBe(10000); // 10% de 100k
      expect(res.data.poolSocios).toBe(90000); // 90% restante
      expect(res.data.capitalTotalSocios).toBe(10000);
      expect(res.data.distribucionPorSocio).toHaveLength(1);
      expect(res.data.distribucionPorSocio[0].gananciaDistribuida).toBe(90000);
      expect(res.data.distribucionPorSocio[0].participacionPorcentaje).toBe(100);
    });

    test('reparte proporcionalmente entre dos socios (75/25)', () => {
      const inversiones = [
        crearInversion({ id: 'a', usuarioId: 'u1', montoInvertido: 30000 }),
        crearInversion({ id: 'b', usuarioId: 'u2', montoInvertido: 10000 }),
      ];
      const res = calcularDistribucion(100000, 10, inversiones, PROYECTO_ID);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // poolSocios = 90000 sobre capital total 40000
      const [s1, s2] = res.data.distribucionPorSocio;
      expect(s1.participacionPorcentaje).toBe(75);
      expect(s2.participacionPorcentaje).toBe(25);
      expect(s1.gananciaDistribuida).toBe(67500); // 75% de 90000
      expect(s2.gananciaDistribuida).toBe(22500); // 25% de 90000
    });

    test('respeta una comisión de gestor distinta (20%)', () => {
      const inversiones = [crearInversion({ montoInvertido: 5000 })];
      const res = calcularDistribucion(50000, 20, inversiones, PROYECTO_ID);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.feeGestor).toBe(10000); // 20% de 50k
      expect(res.data.poolSocios).toBe(40000);
    });

    test('la suma de ganancias de socios cuadra EXACTAMENTE con el pool (método del mayor resto)', () => {
      const inversiones = [
        crearInversion({ id: 'a', usuarioId: 'u1', montoInvertido: 33333 }),
        crearInversion({ id: 'b', usuarioId: 'u2', montoInvertido: 33333 }),
        crearInversion({ id: 'c', usuarioId: 'u3', montoInvertido: 33334 }),
      ];
      const res = calcularDistribucion(99999, 10, inversiones, PROYECTO_ID);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const sumaSocios = res.data.distribucionPorSocio.reduce(
        (s, d) => s + d.gananciaDistribuida,
        0
      );
      // Sin tolerancia: el reparto debe cuadrar centavo a centavo, no solo
      // "aproximadamente", porque este número se firma con hash SHA-256.
      expect(Math.round(sumaSocios * 100)).toBe(Math.round(res.data.poolSocios * 100));
    });

    test('reparte el céntimo sobrante entre muchos socios sin perder ni ganar dinero', () => {
      // 7 socios con montos que no dividen limpio -> fuerza restos en el reparto
      const inversiones = Array.from({ length: 7 }, (_, i) =>
        crearInversion({ id: `s${i}`, usuarioId: `u${i}`, montoInvertido: 10000 + i })
      );
      const res = calcularDistribucion(123456.78, 13, inversiones, PROYECTO_ID);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const sumaSocios = res.data.distribucionPorSocio.reduce(
        (s, d) => s + d.gananciaDistribuida,
        0
      );
      expect(Math.round(sumaSocios * 100)).toBe(Math.round(res.data.poolSocios * 100));
      // El total distribuido (fee + socios) debe cuadrar con la utilidad neta
      expect(Math.round((sumaSocios + res.data.feeGestor) * 100)).toBe(
        Math.round(res.data.utilidadNeta * 100)
      );
    });

    test('ignora inversiones no confirmadas', () => {
      const inversiones = [
        crearInversion({ id: 'a', usuarioId: 'u1', montoInvertido: 10000, confirmada: true }),
        crearInversion({ id: 'b', usuarioId: 'u2', montoInvertido: 90000, confirmada: false }),
      ];
      const res = calcularDistribucion(100000, 10, inversiones, PROYECTO_ID);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.distribucionPorSocio).toHaveLength(1);
      expect(res.data.capitalTotalSocios).toBe(10000);
    });

    test('incluye el proyectoId en cada socio', () => {
      const res = calcularDistribucion(
        10000,
        10,
        [crearInversion({ montoInvertido: 1000 })],
        'proj-XYZ'
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.distribucionPorSocio[0].proyectoId).toBe('proj-XYZ');
    });
  });

  describe('Validaciones de error', () => {
    const inversionesOk = [crearInversion({ montoInvertido: 1000 })];

    test('rechaza utilidad neta cero o negativa', () => {
      const res = calcularDistribucion(0, 10, inversionesOk, PROYECTO_ID);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('UTILIDAD_INVALIDA');
    });

    test('rechaza utilidad no finita (NaN)', () => {
      const res = calcularDistribucion(NaN, 10, inversionesOk, PROYECTO_ID);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('UTILIDAD_INVALIDA');
    });

    test('rechaza comisión menor a 5%', () => {
      const res = calcularDistribucion(10000, 4, inversionesOk, PROYECTO_ID);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('COMISION_INVALIDA');
    });

    test('rechaza comisión mayor a 20%', () => {
      const res = calcularDistribucion(10000, 21, inversionesOk, PROYECTO_ID);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('COMISION_INVALIDA');
    });

    test('rechaza cuando no hay socios confirmados', () => {
      const res = calcularDistribucion(
        10000,
        10,
        [crearInversion({ confirmada: false })],
        PROYECTO_ID
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('SIN_SOCIOS');
    });

    test('rechaza cuando el capital total es cero', () => {
      const res = calcularDistribucion(
        10000,
        10,
        [crearInversion({ montoInvertido: 0 })],
        PROYECTO_ID
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('CAPITAL_CERO');
    });
  });
});

describe('formatearSoles', () => {
  test('formatea un número con dos decimales y prefijo S/', () => {
    expect(formatearSoles(1234.5)).toBe('S/ 1,234.50');
  });

  test('maneja cero', () => {
    expect(formatearSoles(0)).toBe('S/ 0.00');
  });

  test('maneja valores nulos/indefinidos como 0', () => {
    // @ts-expect-error prueba de robustez ante entrada inválida
    expect(formatearSoles(null)).toBe('S/ 0.00');
  });
});
