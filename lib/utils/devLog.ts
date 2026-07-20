/**
 * LOGGER DE DESARROLLO (ISOMÓRFICO)
 *
 * Envoltura ligera sobre `console` que SOLO emite salida cuando
 * `NODE_ENV !== 'production'`. Funciona igual en navegador, Edge y Node,
 * a diferencia del logger basado en Winston (`lib/performance/logger.ts`),
 * que es exclusivo de Node.
 *
 * Reemplaza a los `console.log` / `console.debug` / `console.info` de
 * depuración para que no contaminen la consola en producción. Los errores
 * reales deben seguir usando `console.error` / `console.warn`.
 *
 * @version 1.0
 */

const esDev = process.env.NODE_ENV !== 'production';

/** Log de depuración: se silencia en producción. */
export function devLog(...args: unknown[]): void {
  if (esDev) console.log(...args);
}

/** Info de depuración: se silencia en producción. */
export function devInfo(...args: unknown[]): void {
  if (esDev) console.info(...args);
}

/** Traza de depuración: se silencia en producción. */
export function devDebug(...args: unknown[]): void {
  if (esDev) console.debug(...args);
}

export default devLog;
