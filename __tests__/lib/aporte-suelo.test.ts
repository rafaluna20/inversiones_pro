/**
 * Unit Tests - Aporte de Suelo Module
 * Tests para cálculos financieros críticos
 */

import {
  calcularAporteSuelo,
  calcularDistribucionGanancias,
  calcularROI,
} from '@/lib/aporte-suelo';

describe('Aporte de Suelo - Cálculos Financieros', () => {
  describe('calcularAporteSuelo', () => {
    test('debe calcular correctamente porcentajes 40-60', () => {
      const resultado = calcularAporteSuelo(400000, 600000);
      
      expect(resultado.valorTierra).toBe(400000);
      expect(resultado.valorConstruccion).toBe(600000);
      expect(resultado.valorTotal).toBe(1000000);
      expect(resultado.porcentajeTierra).toBe(40);
      expect(resultado.porcentajeCapital).toBe(60);
    });

    test('debe calcular correctamente con valores iguales', () => {
      const resultado = calcularAporteSuelo(500000, 500000);
      
      expect(resultado.porcentajeTierra).toBe(50);
      expect(resultado.porcentajeCapital).toBe(50);
    });

    test('debe redondear a 2 decimales', () => {
      const resultado = calcularAporteSuelo(333333, 666667);
      
      expect(resultado.porcentajeTierra).toBe(33.33);
      expect(resultado.porcentajeCapital).toBe(66.67);
    });

    test('debe sumar 100% exacto', () => {
      const resultado = calcularAporteSuelo(400000, 600000);
      
      const suma = resultado.porcentajeTierra + resultado.porcentajeCapital;
      expect(suma).toBeCloseTo(100, 2);
    });

    test('debe lanzar error con valores negativos', () => {
      expect(() => {
        calcularAporteSuelo(-100000, 600000);
      }).toThrow();
    });

    test('debe lanzar error con valor cero', () => {
      expect(() => {
        calcularAporteSuelo(0, 600000);
      }).toThrow();
    });
  });

  describe('calcularDistribucionGanancias', () => {
    test('debe distribuir ganancias correctamente según aporte de suelo', () => {
      const aporteSuelo = {
        valorTierra: 400000,
        valorConstruccion: 600000,
        valorTotal: 1000000,
        porcentajeTierra: 40,
        porcentajeCapital: 60,
      };

      const gananciaTotal = 200000; // Proyecto vendido en S/ 1.2M
      const resultado = calcularDistribucionGanancias(aporteSuelo, gananciaTotal);

      expect(resultado.gananciaTierra).toBe(80000);  // 40% de 200K
      expect(resultado.gananciaCapital).toBe(120000); // 60% de 200K
    });

    test('debe manejar pérdidas (ganancia negativa)', () => {
      const aporteSuelo = {
        valorTierra: 400000,
        valorConstruccion: 600000,
        valorTotal: 1000000,
        porcentajeTierra: 40,
        porcentajeCapital: 60,
      };

      const perdida = -100000; // Proyecto vendido en S/ 900K
      const resultado = calcularDistribucionGanancias(aporteSuelo, perdida);

      expect(resultado.gananciaTierra).toBe(-40000);  // 40% de pérdida
      expect(resultado.gananciaCapital).toBe(-60000); // 60% de pérdida
    });
  });

  describe('calcularROI', () => {
    test('debe calcular ROI correctamente', () => {
      const inversion = 50000;
      const ganancia = 15000;
      
      const roi = calcularROI(inversion, ganancia);
      
      expect(roi).toBe(30); // 15,000 / 50,000 * 100 = 30%
    });

    test('debe calcular ROI negativo (pérdida)', () => {
      const inversion = 50000;
      const perdida = -10000;
      
      const roi = calcularROI(inversion, perdida);
      
      expect(roi).toBe(-20); // -10,000 / 50,000 * 100 = -20%
    });

    test('debe retornar 0 con ganancia cero', () => {
      const roi = calcularROI(50000, 0);
      expect(roi).toBe(0);
    });

    test('debe lanzar error con inversión cero', () => {
      expect(() => {
        calcularROI(0, 15000);
      }).toThrow();
    });
  });
});
