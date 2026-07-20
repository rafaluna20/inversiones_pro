/**
 * Unit Tests - Lógica pura de reconciliación Odoo-Firebase
 * Cobertura de lib/resilience/reconciliation-logic.ts
 */

import {
  detectarInversionesSinTransaccionOdoo,
  detectarDesincronizacionDeMontos,
  detectarRetirosAtascados,
  UMBRAL_RETIRO_ATASCADO_MS,
  type InversionResumen,
  type ProyectoResumen,
  type RetiroPendienteResumen,
} from '@/lib/resilience/reconciliation-logic';

function crearInversion(overrides: Partial<InversionResumen>): InversionResumen {
  return {
    id: 'inv-1',
    proyectoId: 'proj-1',
    usuarioId: 'user-1',
    confirmada: true,
    montoInvertido: 1000,
    etapa: 'tierra',
    ...overrides,
  };
}

describe('detectarInversionesSinTransaccionOdoo', () => {
  test('reporta una inversión confirmada sin transaccionOdooId', () => {
    const issues = detectarInversionesSinTransaccionOdoo([
      crearInversion({ id: 'a', transaccionOdooId: undefined }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('missing_odoo');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].inversionId).toBe('a');
  });

  test('NO reporta una inversión confirmada CON transaccionOdooId', () => {
    const issues = detectarInversionesSinTransaccionOdoo([
      crearInversion({ id: 'a', transaccionOdooId: 'TRN-001' }),
    ]);
    expect(issues).toHaveLength(0);
  });

  test('NO reporta una inversión sin confirmar aunque no tenga transacción Odoo', () => {
    const issues = detectarInversionesSinTransaccionOdoo([
      crearInversion({ id: 'a', confirmada: false, transaccionOdooId: undefined }),
    ]);
    expect(issues).toHaveLength(0);
  });

  test('procesa varias inversiones mezcladas correctamente', () => {
    const issues = detectarInversionesSinTransaccionOdoo([
      crearInversion({ id: 'a', transaccionOdooId: 'TRN-001' }),
      crearInversion({ id: 'b', transaccionOdooId: undefined }),
      crearInversion({ id: 'c', confirmada: false, transaccionOdooId: undefined }),
      crearInversion({ id: 'd', transaccionOdooId: undefined }),
    ]);
    expect(issues.map((i) => i.inversionId)).toEqual(['b', 'd']);
  });
});

describe('detectarDesincronizacionDeMontos', () => {
  const proyectoBase: ProyectoResumen = {
    id: 'proj-1',
    montoRecaudadoTierra: 10000,
    montoRecaudadoConstruccion: 0,
  };

  test('no reporta nada si los montos coinciden', () => {
    const inversiones = [crearInversion({ montoInvertido: 10000 })];
    const issues = detectarDesincronizacionDeMontos('proj-1', inversiones, proyectoBase);
    expect(issues).toHaveLength(0);
  });

  test('no reporta nada dentro de la tolerancia (S/ 100 por defecto)', () => {
    const inversiones = [crearInversion({ montoInvertido: 10050 })];
    const issues = detectarDesincronizacionDeMontos('proj-1', inversiones, proyectoBase);
    expect(issues).toHaveLength(0);
  });

  test('reporta "high" si la diferencia supera la tolerancia pero no S/ 10,000', () => {
    const inversiones = [crearInversion({ montoInvertido: 15000 })];
    const issues = detectarDesincronizacionDeMontos('proj-1', inversiones, proyectoBase);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('high');
    expect(issues[0].type).toBe('monto_mismatch');
  });

  test('reporta "critical" si la diferencia supera S/ 10,000', () => {
    const inversiones = [crearInversion({ montoInvertido: 25000 })];
    const issues = detectarDesincronizacionDeMontos('proj-1', inversiones, proyectoBase);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('critical');
  });

  test('ignora inversiones no confirmadas al sumar el monto invertido', () => {
    const inversiones = [
      crearInversion({ montoInvertido: 10000, confirmada: true }),
      crearInversion({ id: 'b', montoInvertido: 50000, confirmada: false }),
    ];
    const issues = detectarDesincronizacionDeMontos('proj-1', inversiones, proyectoBase);
    expect(issues).toHaveLength(0);
  });
});

describe('detectarRetirosAtascados', () => {
  const ahora = Date.parse('2026-07-20T12:00:00Z');

  function crearRetiro(overrides: Partial<RetiroPendienteResumen>): RetiroPendienteResumen {
    return {
      transactionId: 'WTH-1',
      firebaseUid: 'user-1',
      amount: 500,
      fechaInicioMs: ahora,
      ...overrides,
    };
  }

  test('no reporta un retiro reciente (dentro del umbral)', () => {
    const retiro = crearRetiro({ fechaInicioMs: ahora - 5 * 60 * 1000 }); // 5 min
    const issues = detectarRetirosAtascados([retiro], ahora);
    expect(issues).toHaveLength(0);
  });

  test('reporta un retiro que superó el umbral por defecto (15 min)', () => {
    const retiro = crearRetiro({ fechaInicioMs: ahora - 20 * 60 * 1000 }); // 20 min
    const issues = detectarRetirosAtascados([retiro], ahora);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('retiro_atascado');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].transactionId).toBe('WTH-1');
  });

  test('justo en el borde del umbral no se reporta (estrictamente mayor)', () => {
    const retiro = crearRetiro({ fechaInicioMs: ahora - UMBRAL_RETIRO_ATASCADO_MS });
    const issues = detectarRetirosAtascados([retiro], ahora);
    expect(issues).toHaveLength(0);
  });

  test('respeta un umbral custom', () => {
    const retiro = crearRetiro({ fechaInicioMs: ahora - 2 * 60 * 1000 }); // 2 min
    const issues = detectarRetirosAtascados([retiro], ahora, 60 * 1000); // umbral: 1 min
    expect(issues).toHaveLength(1);
  });

  test('varios retiros: solo reporta los que superan el umbral', () => {
    const retiros = [
      crearRetiro({ transactionId: 'A', fechaInicioMs: ahora - 1 * 60 * 1000 }),
      crearRetiro({ transactionId: 'B', fechaInicioMs: ahora - 30 * 60 * 1000 }),
      crearRetiro({ transactionId: 'C', fechaInicioMs: ahora - 45 * 60 * 1000 }),
    ];
    const issues = detectarRetirosAtascados(retiros, ahora);
    expect(issues.map((i) => i.transactionId)).toEqual(['B', 'C']);
  });
});
