/**
 * Retry Logic Module - Exponential Backoff
 * Implementa reintentos automáticos con backoff exponencial para operaciones fallidas
 * 
 * Beneficios:
 * - Resiliencia ante fallos temporales
 * - Previene pérdida de dinero por timeouts
 * - Reduce carga en servicios durante fallos
 */

import { logger } from './logger';
import { AppError, IntegrationError, TimeoutError } from './errors';

// ========================
// TIPOS
// ========================

export interface RetryOptions {
  maxRetries: number;           // Número máximo de reintentos
  initialDelayMs: number;       // Delay inicial en ms
  maxDelayMs: number;           // Delay máximo en ms
  exponentialBase: number;      // Base para cálculo exponencial (default: 2)
  jitter: boolean;              // Agregar randomización para evitar thundering herd
  retryableErrors?: string[];   // Códigos de error específicos que deben reintentarse
  onRetry?: (attempt: number, error: Error) => void; // Callback en cada reintento
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// ========================
// CONFIGURACIONES PREDEFINIDAS
// ========================

/**
 * Configuración para operaciones financieras críticas (Odoo transfers)
 */
export const FINANCIAL_RETRY_CONFIG: RetryOptions = {
  maxRetries: 5,
  initialDelayMs: 1000,      // 1 segundo
  maxDelayMs: 30000,         // 30 segundos
  exponentialBase: 2,
  jitter: true,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'NETWORK_ERROR',
    'TEMPORARY_ERROR'
  ]
};

/**
 * Configuración para operaciones de lectura (Firebase queries)
 */
export const READ_RETRY_CONFIG: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 500,       // 0.5 segundos
  maxDelayMs: 5000,          // 5 segundos
  exponentialBase: 2,
  jitter: true
};

/**
 * Configuración para integraciones externas (APIs)
 */
export const API_RETRY_CONFIG: RetryOptions = {
  maxRetries: 4,
  initialDelayMs: 2000,      // 2 segundos
  maxDelayMs: 60000,         // 1 minuto
  exponentialBase: 2,
  jitter: true,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    '429',  // Too Many Requests
    '502',  // Bad Gateway
    '503',  // Service Unavailable
    '504'   // Gateway Timeout
  ]
};

// ========================
// FUNCIONES CORE
// ========================

/**
 * Calcula el delay para el siguiente reintento usando exponential backoff
 */
export function calculateBackoff(
  attempt: number,
  options: RetryOptions
): number {
  const { initialDelayMs, maxDelayMs, exponentialBase, jitter } = options;
  
  // Cálculo exponencial: delay = initialDelay * (base ^ attempt)
  let delay = initialDelayMs * Math.pow(exponentialBase, attempt);
  
  // Limitar al máximo
  delay = Math.min(delay, maxDelayMs);
  
  // Agregar jitter (randomización ±25%) para evitar thundering herd
  if (jitter) {
    const jitterRange = delay * 0.25;
    delay = delay + (Math.random() * jitterRange * 2 - jitterRange);
  }
  
  return Math.floor(delay);
}

/**
 * Verifica si un error es reintentable
 */
export function isRetryableError(
  error: Error,
  retryableErrors?: string[]
): boolean {
  // Si no hay lista específica, reintentar errores de red/integración
  if (!retryableErrors) {
    return (
      error instanceof IntegrationError ||
      error instanceof TimeoutError ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('timeout')
    );
  }
  
  // Verificar si el código/mensaje del error está en la lista
  return retryableErrors.some(code => 
    error.message.includes(code) ||
    ('code' in error && (error as any).code === code)
  );
}

/**
 * Sleep async helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================
// RETRY CON EXPONENTIAL BACKOFF
// ========================

/**
 * Ejecuta una función con reintentos automáticos y exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  operationName: string = 'Operation'
): Promise<T> {
  const config: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    exponentialBase: 2,
    jitter: true,
    ...options
  };
  
  const startTime = Date.now();
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Intentar ejecutar la función
      const result = await fn();
      
      // Si es exitoso en intento > 0, loguear recuperación
      if (attempt > 0) {
        const totalDuration = Date.now() - startTime;
        logger.info(`✅ ${operationName} exitoso después de ${attempt} reintentos`, {
          operationName,
          attempts: attempt,
          totalDuration
        });
      }
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // Si es el último intento, lanzar el error
      if (attempt === config.maxRetries) {
        const totalDuration = Date.now() - startTime;
        logger.error(`❌ ${operationName} falló después de ${config.maxRetries} reintentos`, {
          operationName,
          attempts: attempt + 1,
          totalDuration,
          error: {
            name: lastError.name,
            message: lastError.message
          }
        });
        throw lastError;
      }
      
      // Verificar si el error es reintentable
      if (!isRetryableError(lastError, config.retryableErrors)) {
        logger.warn(`⚠️ ${operationName} falló con error no reintentable`, {
          operationName,
          attempts: attempt + 1,
          error: lastError.message
        });
        throw lastError;
      }
      
      // Calcular delay para siguiente intento
      const delay = calculateBackoff(attempt, config);
      
      logger.warn(`🔄 ${operationName} falló (intento ${attempt + 1}/${config.maxRetries + 1}), reintentando en ${delay}ms`, {
        operationName,
        attempt: attempt + 1,
        maxRetries: config.maxRetries + 1,
        delay,
        error: lastError.message
      });
      
      // Ejecutar callback si existe
      if (config.onRetry) {
        config.onRetry(attempt + 1, lastError);
      }
      
      // Esperar antes del siguiente intento
      await sleep(delay);
    }
  }
  
  // Este código nunca debería ejecutarse, pero TypeScript lo requiere
  throw lastError!;
}

/**
 * Versión segura de retry que no lanza errores, retorna resultado
 */
export async function retryWithBackoffSafe<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  operationName: string = 'Operation'
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;
  
  try {
    const data = await retryWithBackoff(fn, options, operationName);
    attempts = (options.maxRetries || 3) + 1; // Éxito en algún intento
    
    return {
      success: true,
      data,
      attempts,
      totalDuration: Date.now() - startTime
    };
  } catch (error) {
    attempts = (options.maxRetries || 3) + 1; // Todos los intentos fallaron
    
    return {
      success: false,
      error: error as Error,
      attempts,
      totalDuration: Date.now() - startTime
    };
  }
}

// ========================
// FUNCIONES ESPECIALIZADAS
// ========================

/**
 * Retry para transferencias Odoo (crítico)
 */
export async function retryOdooTransfer<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  return retryWithBackoff(fn, FINANCIAL_RETRY_CONFIG, `Odoo: ${operationName}`);
}

/**
 * Retry para lecturas de Firebase
 */
export async function retryFirebaseRead<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  return retryWithBackoff(fn, READ_RETRY_CONFIG, `Firebase: ${operationName}`);
}

/**
 * Retry para APIs externas
 */
export async function retryAPICall<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  return retryWithBackoff(fn, API_RETRY_CONFIG, `API: ${operationName}`);
}

// ========================
// CIRCUIT BREAKER PATTERN
// ========================

/**
 * Estado del circuit breaker
 */
enum CircuitState {
  CLOSED = 'CLOSED',       // Normal, permite requests
  OPEN = 'OPEN',           // Fallando, bloquea requests
  HALF_OPEN = 'HALF_OPEN'  // Probando recuperación
}

export interface CircuitBreakerOptions {
  failureThreshold: number;     // Fallos consecutivos para abrir
  successThreshold: number;     // Éxitos para cerrar desde half-open
  timeout: number;              // Tiempo en OPEN antes de HALF_OPEN (ms)
  monitoringPeriod: number;     // Período de monitoreo (ms)
}

/**
 * Circuit Breaker para prevenir cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttemptTime: number = Date.now();
  private readonly options: CircuitBreakerOptions;
  
  constructor(
    private readonly serviceName: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minuto
      monitoringPeriod: 10000, // 10 segundos
      ...options
    };
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Si está OPEN y no ha pasado el timeout, rechazar inmediatamente
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new IntegrationError(
          this.serviceName,
          'Circuit breaker OPEN - servicio temporalmente no disponible',
          { state: this.state, nextAttemptTime: this.nextAttemptTime }
        );
      }
      // Timeout cumplido, pasar a HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info(`🔧 Circuit breaker ${this.serviceName}: OPEN → HALF_OPEN`);
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        logger.info(`✅ Circuit breaker ${this.serviceName}: HALF_OPEN → CLOSED`);
      }
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    
    if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.timeout;
      logger.error(`🚨 Circuit breaker ${this.serviceName}: CLOSED → OPEN`, {
        failureCount: this.failureCount,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
      });
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.timeout;
      logger.error(`🚨 Circuit breaker ${this.serviceName}: HALF_OPEN → OPEN`);
    }
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.state === CircuitState.OPEN 
        ? new Date(this.nextAttemptTime).toISOString() 
        : null
    };
  }
}

// ========================
// CIRCUIT BREAKERS GLOBALES
// ========================

/**
 * Circuit breaker para Odoo API
 */
export const odooCircuitBreaker = new CircuitBreaker('Odoo API', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000 // 1 minuto
});

/**
 * Circuit breaker para Firebase
 */
export const firebaseCircuitBreaker = new CircuitBreaker('Firebase', {
  failureThreshold: 10,
  successThreshold: 3,
  timeout: 30000 // 30 segundos
});

// ========================
// COMBINACIÓN: RETRY + CIRCUIT BREAKER
// ========================

/**
 * Ejecuta función con retry + circuit breaker
 */
export async function retryWithCircuitBreaker<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryOptions: Partial<RetryOptions> = {},
  operationName: string = 'Operation'
): Promise<T> {
  return retryWithBackoff(
    () => circuitBreaker.execute(fn),
    retryOptions,
    operationName
  );
}

// ========================
// EJEMPLOS DE USO
// ========================

/**
 * EJEMPLO 1: Transferencia Odoo con retry
 * 
 * async function transferirDinero(from: string, to: string, amount: number) {
 *   return retryOdooTransfer(
 *     async () => {
 *       return await odooAPI.createTransfer({ from, to, amount });
 *     },
 *     'Transferencia de dinero'
 *   );
 * }
 */

/**
 * EJEMPLO 2: Lectura Firebase con retry
 * 
 * async function obtenerProyecto(id: string) {
 *   return retryFirebaseRead(
 *     async () => {
 *       const doc = await db.collection('productos').doc(id).get();
 *       return doc.data();
 *     },
 *     'Obtener proyecto'
 *   );
 * }
 */

/**
 * EJEMPLO 3: Con circuit breaker
 * 
 * async function operacionCritica() {
 *   return retryWithCircuitBreaker(
 *     async () => await odooAPI.someOperation(),
 *     odooCircuitBreaker,
 *     FINANCIAL_RETRY_CONFIG,
 *     'Operación crítica Odoo'
 *   );
 * }
 */

// ========================
// EXPORTACIONES
// ========================

export const retry = {
  // Core
  retryWithBackoff,
  retryWithBackoffSafe,
  calculateBackoff,
  isRetryableError,
  
  // Especializadas
  retryOdooTransfer,
  retryFirebaseRead,
  retryAPICall,
  
  // Circuit Breaker
  CircuitBreaker,
  CircuitState,
  retryWithCircuitBreaker,
  odooCircuitBreaker,
  firebaseCircuitBreaker,
  
  // Configs
  FINANCIAL_RETRY_CONFIG,
  READ_RETRY_CONFIG,
  API_RETRY_CONFIG
};

export default retry;
