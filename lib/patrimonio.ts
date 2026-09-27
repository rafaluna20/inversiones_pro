/**
 * Patrimonio de un inversionista de Inversiones Pro: cuánto tiene libre y cuánto en proyectos, para mostrarlo en la
 * billetera digital (banco → esta plataforma → este cálculo). Código PURO (sin Firestore ni red) para poder probarlo
 * sin el emulador; quien lo llama (la ruta de la API) es quien lee los datos.
 *
 * Modelo de datos de Inversiones Pro (a diferencia del ledger de movimientos de akallpa_inversionistas en Odoo): cada
 * proyecto (`productos/{id}`) guarda a sus inversores en su propio array `inversores[]` (participación en "cubos",
 * 100 = 100% financiado). Al liquidar un proyecto, la ganancia de CADA inversor se escribe en su propia entrada de
 * ese array (`gananciaReal`, `roiReal`) — no existe un libro de movimientos histórico, así que no hay evolución
 * mensual que mostrar todavía (`evolucion` se deja vacío a propósito, en vez de inventar una).
 *
 * Convención (igual que el resumen de akallpa_inversionistas, para que la billetera los muestre igual):
 * - "capital": dinero AÚN invertido a costo (0 una vez liquidado: ya volvió como saldo o ganancia).
 * - "utilidad_recibida" / "resultado": ganancia (o pérdida) ya pagada; 0 mientras el proyecto sigue activo, porque
 *   esta plataforma paga todo de una vez al liquidar, no hay repartos parciales en el camino.
 * - "proyectos_historicos": el total de proyectos en los que la persona ha invertido alguna vez (no solo los
 *   liquidados): es "cuántos", no "cuántos ya terminaron".
 */

export interface InversorDeProducto {
  usuarioId: string;
  cubos: number;
  gananciaReal?: number;
}

export interface ProductoParaResumen {
  id: string;
  nombre?: string;
  precio?: number | string;
  monto?: number | string;
  /** true = activo, false = liquidado (Producto.estado en types/index.ts). */
  estado: boolean;
  distribucionEjecutada?: boolean;
  fechaDistribucion?: number;
  progresoConstruccion?: number;
  inversores?: InversorDeProducto[];
}

export interface ContratoResumen {
  proyecto_id: string;
  nombre: string;
  estado: 'en_ejecucion' | 'liquidado';
  en_curso: boolean;
  capital: number;
  aportado: number;
  utilidad_recibida: number;
  resultado: number;
  avance_pct: number;
}

export interface ResumenPatrimonio {
  moneda: 'PEN';
  patrimonio: number;
  saldo_libre: number;
  capital_en_curso: number;
  utilidad_mes: number;
  utilidad_recibida: number;
  resultado_realizado: number;
  proyectos_activos: number;
  proyectos_historicos: number;
  evolucion: never[];
  contratos: ContratoResumen[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const numero = (v: number | string | undefined) => (typeof v === 'string' ? parseFloat(v) : v) || 0;

/** "AAAA-MM" en hora de Lima, para saber si una fecha cayó "este mes". */
function mesLima(fechaMs: number): string {
  return new Date(fechaMs).toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).slice(0, 7);
}

/**
 * Arma el resumen de UN inversionista (`uid`) a partir de su saldo libre y de los proyectos en los que participa
 * (ya filtrados o no: esta función ignora los productos donde `uid` no aparece en `inversores`).
 */
export function calcularResumenPatrimonio(
  saldoLibre: number,
  productos: ProductoParaResumen[],
  uid: string,
  ahora: Date = new Date()
): ResumenPatrimonio {
  const mesActual = mesLima(ahora.getTime());
  const contratos: ContratoResumen[] = [];

  for (const producto of productos) {
    const propia = producto.inversores?.find((inv) => inv.usuarioId === uid);
    if (!propia || !(propia.cubos > 0)) continue;

    const precioTotal = numero(producto.precio) || numero(producto.monto);
    const capitalInvertido = round2((propia.cubos * precioTotal) / 100);
    const liquidado = producto.estado === false || producto.distribucionEjecutada === true;
    const ganancia = round2(numero(propia.gananciaReal));

    contratos.push({
      proyecto_id: producto.id,
      nombre: producto.nombre || 'Proyecto',
      estado: liquidado ? 'liquidado' : 'en_ejecucion',
      en_curso: !liquidado,
      capital: liquidado ? 0 : capitalInvertido,
      aportado: capitalInvertido,
      utilidad_recibida: liquidado ? ganancia : 0,
      resultado: liquidado ? ganancia : 0,
      avance_pct: typeof producto.progresoConstruccion === 'number' ? producto.progresoConstruccion : liquidado ? 100 : 0,
    });
  }

  const capitalEnCurso = round2(contratos.reduce((s, c) => s + c.capital, 0));
  const utilidadRecibida = round2(contratos.reduce((s, c) => s + c.utilidad_recibida, 0));
  const utilidadMes = round2(
    contratos.reduce((s, c, i) => {
      const producto = productos.find((p) => p.id === c.proyecto_id);
      const enEsteMes = c.estado === 'liquidado' && producto?.fechaDistribucion && mesLima(producto.fechaDistribucion) === mesActual;
      return s + (enEsteMes ? c.utilidad_recibida : 0);
    }, 0)
  );

  return {
    moneda: 'PEN',
    patrimonio: round2(saldoLibre + capitalEnCurso),
    saldo_libre: round2(saldoLibre),
    capital_en_curso: capitalEnCurso,
    utilidad_mes: utilidadMes,
    utilidad_recibida: utilidadRecibida,
    resultado_realizado: round2(contratos.reduce((s, c) => s + c.resultado, 0)),
    proyectos_activos: contratos.filter((c) => c.en_curso).length,
    proyectos_historicos: contratos.length,
    evolucion: [],
    contratos,
  };
}
