/**
 * @jest-environment node
 */

/**
 * Tests unitarios (sin emulador) de las piezas puras que usan los flujos de
 * dinero: validación de montos, clasificación de las respuestas de Odoo,
 * reparto exacto de céntimos y detección de cargas atascadas.
 */

import { validarMonto, redondear2, MONTO_MAXIMO_OPERACION } from '@/lib/plataforma-saldo';
import { clasificarRespuestaMovimiento } from '@/lib/odoo-wallet';
import { repartirEnCentavos } from '@/lib/distribucion';
import { detectarCargasAtascadas, UMBRAL_RETIRO_ATASCADO_MS } from '@/lib/resilience/reconciliation-logic';

describe('validarMonto', () => {
  test('acepta montos normales y los devuelve redondeados a 2 decimales', () => {
    expect(validarMonto(10)).toEqual({ ok: true, monto: 10 });
    expect(validarMonto(0.01)).toEqual({ ok: true, monto: 0.01 });
    expect(validarMonto(19.99)).toEqual({ ok: true, monto: 19.99 });
    expect(validarMonto(0.1 + 0.2)).toEqual({ ok: true, monto: 0.3 }); // ruido de coma flotante
  });

  test.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['cero', 0],
    ['negativo', -1],
    ['más de 2 decimales', 1.005],
    ['texto', '10'],
    ['null', null],
    ['undefined', undefined],
    ['objeto', {}],
    ['sobre el máximo', MONTO_MAXIMO_OPERACION + 0.01],
  ])('rechaza %s', (_nombre, valor) => {
    expect(validarMonto(valor).ok).toBe(false);
  });

  test('respeta el mínimo y el máximo pedidos', () => {
    expect(validarMonto(9.99, 10).ok).toBe(false);
    expect(validarMonto(10, 10).ok).toBe(true);
    expect(validarMonto(101, 1, 100).ok).toBe(false);
    expect(validarMonto(100, 1, 100).ok).toBe(true);
  });
});

describe('redondear2', () => {
  test('redondea a céntimos', () => {
    expect(redondear2(1.005 * 100 / 100)).toBeCloseTo(1, 2);
    expect(redondear2(33.333333)).toBe(33.33);
    expect(redondear2(0.1 + 0.2)).toBe(0.3);
  });
});

describe('clasificarRespuestaMovimiento (qué hacer con la respuesta de Odoo)', () => {
  test('éxito con datos de la transacción → ok', () => {
    expect(
      clasificarRespuestaMovimiento({ result: { success: true, transaction_id: 'TRN-1', amount: 50, new_balance: 120 } })
    ).toEqual({ estado: 'ok', transactionId: 'TRN-1', monto: 50, nuevoSaldo: 120 });
  });

  test('success:false → rechazada (seguro dar por no aplicada)', () => {
    expect(clasificarRespuestaMovimiento({ result: { success: false, error: 'Saldo insuficiente' } })).toEqual({
      estado: 'rechazada',
      mensaje: 'Saldo insuficiente',
    });
    expect(clasificarRespuestaMovimiento({ result: { success: false } }).estado).toBe('rechazada');
  });

  test.each([
    ['error de red / timeout', { error: { message: 'Error de conexión con el servidor' } }],
    ['error JSON-RPC', { error: { message: 'Odoo Server Error', data: { message: 'boom' } } }],
    ['sin result', {}],
    ['result que no es objeto', { result: 'ok' }],
    ['éxito sin transaction_id', { result: { success: true, amount: 50 } }],
    ['éxito con monto no numérico', { result: { success: true, transaction_id: 'TRN-1', amount: 'x' } }],
    ['success ausente', { result: { foo: 'bar' } }],
  ])('%s → indeterminado (NUNCA darlo por fallido ni por exitoso)', (_nombre, respuesta) => {
    expect(clasificarRespuestaMovimiento(respuesta as never).estado).toBe('indeterminado');
  });
});

describe('repartirEnCentavos (método del mayor resto)', () => {
  const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  test('la suma es EXACTAMENTE el total, sin céntimos creados ni perdidos', () => {
    expect(repartirEnCentavos(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(suma(repartirEnCentavos(10000, [1, 1, 1]))).toBe(10000);
    expect(repartirEnCentavos(100, [60, 40])).toEqual([60, 40]);
    expect(repartirEnCentavos(1, [1, 1, 1])).toEqual([1, 0, 0]);
    expect(repartirEnCentavos(0, [3, 2])).toEqual([0, 0]);
  });

  test('propiedad: para muchos repartos aleatorios la suma siempre cuadra', () => {
    let semilla = 12345;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
      return semilla / 0x7fffffff;
    };
    for (let i = 0; i < 500; i++) {
      const n = 1 + Math.floor(azar() * 12);
      const pesos = Array.from({ length: n }, () => Math.floor(azar() * 100) + 1);
      const total = Math.floor(azar() * 5_000_000);
      const partes = repartirEnCentavos(total, pesos);
      expect(suma(partes)).toBe(total);
      partes.forEach((p) => expect(Number.isInteger(p) && p >= 0).toBe(true));
    }
  });

  test('un peso 0 no recibe nada; pesos inválidos o suma 0 lanzan error', () => {
    expect(repartirEnCentavos(100, [0, 1])).toEqual([0, 100]);
    expect(() => repartirEnCentavos(100, [0, 0])).toThrow();
    expect(() => repartirEnCentavos(100, [-1, 2])).toThrow();
    expect(() => repartirEnCentavos(100.5, [1])).toThrow();
    expect(() => repartirEnCentavos(-1, [1])).toThrow();
    expect(repartirEnCentavos(100, [])).toEqual([]);
  });
});

describe('detectarCargasAtascadas', () => {
  const ahora = Date.parse('2026-09-25T12:00:00Z');
  const carga = (fechaInicioMs: number) => ({ transactionId: 'PLAT-u1-1', firebaseUid: 'u1', amount: 80, fechaInicioMs });

  test('no reporta una carga reciente', () => {
    expect(detectarCargasAtascadas([carga(ahora - 60_000)], ahora)).toHaveLength(0);
  });

  test('reporta como crítica una carga que superó el umbral: Odoo pudo debitar sin acreditar', () => {
    const issues = detectarCargasAtascadas([carga(ahora - UMBRAL_RETIRO_ATASCADO_MS - 1)], ahora);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: 'carga_atascada', severity: 'critical', usuarioId: 'u1', transactionId: 'PLAT-u1-1' });
  });

  test('justo en el borde del umbral no se reporta (estrictamente mayor)', () => {
    expect(detectarCargasAtascadas([carga(ahora - UMBRAL_RETIRO_ATASCADO_MS)], ahora)).toHaveLength(0);
  });
});
