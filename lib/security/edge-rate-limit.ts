/**
 * RATE LIMITER COMPATIBLE CON EDGE RUNTIME
 *
 * Limitador de ventana deslizante 100% en memoria y sin dependencias
 * de Node (no usa `express-rate-limit`, `redis` ni `crypto`), por lo que
 * puede ejecutarse dentro de `middleware.ts` en el Edge Runtime de Next.js.
 *
 * NOTA: el estado vive en memoria del proceso Edge y no se comparte entre
 * instancias ni sobrevive a un cold start. Es una primera línea de defensa
 * contra ráfagas de abuso, no un límite distribuido. Para límites estrictos
 * y auditables usar el limitador con Redis en el lado servidor.
 *
 * @version 1.0
 */

export interface RateLimitRule {
  /** Número máximo de solicitudes permitidas dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana en milisegundos. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Solicitudes restantes en la ventana actual. */
  remaining: number;
  /** Momento (epoch ms) en que la ventana se reinicia. */
  resetAt: number;
}

// Mapa global: clave -> lista de timestamps (ms) de solicitudes recientes.
const hits: Map<string, number[]> = new Map();

// Limpieza perezosa: evita que el mapa crezca sin límite en procesos longevos.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number, maxWindowMs: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, timestamps] of hits) {
    const vivos = timestamps.filter((t) => now - t < maxWindowMs);
    if (vivos.length === 0) hits.delete(key);
    else hits.set(key, vivos);
  }
}

/**
 * Registra un intento para `key` y determina si supera la regla.
 *
 * @param key   Identificador único del solicitante (p.ej. `ip:path`).
 * @param rule  Regla de límite a aplicar.
 */
export function checkRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now, rule.windowMs);

  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < rule.windowMs);

  if (timestamps.length >= rule.limit) {
    const resetAt = timestamps[0] + rule.windowMs;
    hits.set(key, timestamps);
    return { allowed: false, remaining: 0, resetAt };
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - timestamps.length),
    resetAt: now + rule.windowMs,
  };
}

/** Extrae la IP del cliente a partir de las cabeceras de proxy habituales. */
export function obtenerIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip') || 'desconocida';
}
