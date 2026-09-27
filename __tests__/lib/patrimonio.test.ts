/**
 * @jest-environment node
 */

/**
 * Cálculo del patrimonio de un inversionista para el resumen que ve la billetera. Código puro: sin Firestore, sin
 * emulador. El escenario "estándar" (2 proyectos activos + 1 liquidado) se reutiliza en varios tests.
 */
import { calcularResumenPatrimonio, type ProductoParaResumen } from '@/lib/patrimonio';

const UID = 'uid-ana';
const OTRO = 'uid-beto';

const activo1: ProductoParaResumen = {
  id: 'prod-activo-1', nombre: 'Torres del Sol', precio: 10000, estado: true,
  inversores: [{ usuarioId: UID, cubos: 20 }, { usuarioId: OTRO, cubos: 30 }],
};
const activo2: ProductoParaResumen = {
  id: 'prod-activo-2', nombre: 'Villa Marina', precio: '5000', estado: true,
  inversores: [{ usuarioId: UID, cubos: 50 }],
};
const liquidado: ProductoParaResumen = {
  id: 'prod-liquidado', nombre: 'Los Pinos', precio: 8000, estado: false, distribucionEjecutada: true,
  fechaDistribucion: new Date('2026-09-10T12:00:00Z').getTime(),
  inversores: [{ usuarioId: UID, cubos: 40, gananciaReal: 320.5 }],
};
const noInvolucrado: ProductoParaResumen = {
  id: 'prod-ajeno', nombre: 'Otro', precio: 1000, estado: true, inversores: [{ usuarioId: OTRO, cubos: 100 }],
};
const escenario = [activo1, activo2, liquidado, noInvolucrado];

describe('calcularResumenPatrimonio', () => {
  test('capital: activo cuenta como capital en curso; liquidado pasa a 0 (ya volvió como saldo)', () => {
    const r = calcularResumenPatrimonio(1000, escenario, UID, new Date('2026-09-15'));
    // activo1: 20% de 10000 = 2000; activo2: 50% de 5000 = 2500; liquidado: 0
    expect(r.capital_en_curso).toBe(4500);
    expect(r.contratos.find((c) => c.proyecto_id === 'prod-liquidado')?.capital).toBe(0);
    expect(r.contratos.some((c) => c.proyecto_id === 'prod-ajeno')).toBe(false); // no es inversor ahí
  });

  test('patrimonio = saldo libre + capital en curso (nunca cuenta dos veces la utilidad ya cobrada)', () => {
    const r = calcularResumenPatrimonio(1000, escenario, UID);
    expect(r.patrimonio).toBe(1000 + 4500);
  });

  test('utilidad_recibida y resultado_realizado: 0 mientras el proyecto sigue activo; la ganancia al liquidar', () => {
    const r = calcularResumenPatrimonio(0, escenario, UID);
    const enCurso = r.contratos.find((c) => c.proyecto_id === 'prod-activo-1')!;
    expect([enCurso.utilidad_recibida, enCurso.resultado]).toEqual([0, 0]);
    const cerrado = r.contratos.find((c) => c.proyecto_id === 'prod-liquidado')!;
    expect([cerrado.utilidad_recibida, cerrado.resultado]).toEqual([320.5, 320.5]);
    expect(r.utilidad_recibida).toBe(320.5);
    expect(r.resultado_realizado).toBe(320.5);
  });

  test('utilidad_mes: solo cuenta si la liquidación cayó en el mes de "ahora" (hora de Lima)', () => {
    expect(calcularResumenPatrimonio(0, escenario, UID, new Date('2026-09-20T12:00:00Z')).utilidad_mes).toBe(320.5);
    expect(calcularResumenPatrimonio(0, escenario, UID, new Date('2026-10-05T12:00:00Z')).utilidad_mes).toBe(0);
  });

  test('en_curso / estado / avance_pct por contrato', () => {
    const r = calcularResumenPatrimonio(0, escenario, UID);
    const activo = r.contratos.find((c) => c.proyecto_id === 'prod-activo-1')!;
    const cerrado = r.contratos.find((c) => c.proyecto_id === 'prod-liquidado')!;
    expect([activo.en_curso, activo.estado, activo.avance_pct]).toEqual([true, 'en_ejecucion', 0]);
    expect([cerrado.en_curso, cerrado.estado, cerrado.avance_pct]).toEqual([false, 'liquidado', 100]);
  });

  test('progresoConstruccion, cuando existe, reemplaza el 0/100 por defecto', () => {
    const r = calcularResumenPatrimonio(0, [{ ...activo1, progresoConstruccion: 63 }], UID);
    expect(r.contratos[0].avance_pct).toBe(63);
  });

  test('proyectos_activos cuenta los en curso; proyectos_historicos cuenta TODOS los que alguna vez tuvieron dinero (no solo los liquidados)', () => {
    const r = calcularResumenPatrimonio(0, escenario, UID);
    expect([r.proyectos_activos, r.proyectos_historicos]).toEqual([2, 3]);
  });

  test('sin proyectos propios: patrimonio es solo el saldo libre', () => {
    const r = calcularResumenPatrimonio(250, [noInvolucrado], UID);
    expect(r).toMatchObject({ patrimonio: 250, capital_en_curso: 0, contratos: [], proyectos_activos: 0, proyectos_historicos: 0 });
  });

  test('un inversor con 0 cubos (participación eliminada) no aparece', () => {
    const r = calcularResumenPatrimonio(0, [{ ...activo1, inversores: [{ usuarioId: UID, cubos: 0 }] }], UID);
    expect(r.contratos).toEqual([]);
  });

  test('precio como texto (legado) se convierte igual que precio numérico', () => {
    const conPrecioTexto: ProductoParaResumen = { ...activo1, precio: '10000' };
    expect(calcularResumenPatrimonio(0, [conPrecioTexto], UID).capital_en_curso).toBe(2000);
  });

  test('sin precio ni monto, el capital es 0 (nunca NaN)', () => {
    const sinPrecio: ProductoParaResumen = { id: 'x', estado: true, inversores: [{ usuarioId: UID, cubos: 50 }] };
    const r = calcularResumenPatrimonio(0, [sinPrecio], UID);
    expect(r.contratos[0].capital).toBe(0);
    expect(Number.isNaN(r.patrimonio)).toBe(false);
  });

  test('moneda siempre PEN; nunca se filtra el nombre ni el uid de otro inversor', () => {
    const r = calcularResumenPatrimonio(0, escenario, UID);
    expect(r.moneda).toBe('PEN');
    expect(JSON.stringify(r)).not.toContain(OTRO);
  });
});
