/**
 * Structured Logging Module - Winston Logger
 * Implementa logging estructurado con niveles, contexto y transports
 * 
 * Beneficios:
 * - Logs estructurados y searchables
 * - Diferentes niveles (debug, info, warn, error)
 * - Rotación automática de archivos
 * - Integración con servicios externos (opcional)
 */

import winston from 'winston';
import path from 'path';

// ========================
// CONFIGURACIÓN DE NIVELES
// ========================

/**
 * Niveles de log personalizados
 */
const levels = {
  error: 0,    // Errores críticos que requieren atención inmediata
  warn: 1,     // Situaciones anormales pero manejables
  info: 2,     // Información general de operaciones
  http: 3,     // Logs de requests HTTP
  debug: 4     // Información detallada para debugging
};

/**
 * Colores para cada nivel (console output)
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// ========================
// FORMATOS
// ========================

/**
 * Formato para desarrollo (legible, con colores)
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

/**
 * Formato para producción (JSON estructurado)
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ========================
// TRANSPORTS
// ========================

/**
 * Configurar transports según el entorno
 */
const isDev = process.env.NODE_ENV !== 'production';
const logDir = path.join(process.cwd(), 'logs');

const transports: winston.transport[] = [
  // Console (siempre activo)
  new winston.transports.Console({
    format: isDev ? devFormat : prodFormat,
    level: isDev ? 'debug' : 'info'
  })
];

// En producción, agregar archivos con rotación
if (!isDev) {
  transports.push(
    // Archivo de errores
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Archivo combinado
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760,
      maxFiles: 10,
      tailable: true
    })
  );
}

// ========================
// LOGGER PRINCIPAL
// ========================

/**
 * Instancia principal del logger
 */
export const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: prodFormat,
  transports,
  exitOnError: false
});

// ========================
// LOGGERS ESPECIALIZADOS
// ========================

/**
 * Logger para operaciones financieras (auditoría)
 */
export const financeLogger = logger.child({
  service: 'finance',
  audit: true
});

/**
 * Logger para Odoo API
 */
export const odooLogger = logger.child({
  service: 'odoo-api'
});

/**
 * Logger para Firebase
 */
export const firebaseLogger = logger.child({
  service: 'firebase'
});

/**
 * Logger para autenticación
 */
export const authLogger = logger.child({
  service: 'auth'
});

/**
 * Logger para inversiones
 */
export const inversionLogger = logger.child({
  service: 'inversiones'
});

// ========================
// FUNCIONES HELPER
// ========================

/**
 * Log de operación financiera (con auditoría)
 */
export function logFinancialOperation(
  operation: string,
  usuarioId: string,
  monto: number,
  metadata?: Record<string, any>
) {
  financeLogger.info(`Operación financiera: ${operation}`, {
    operation,
    usuarioId,
    monto,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

/**
 * Log de inversión
 */
export function logInversion(
  accion: 'crear' | 'aprobar' | 'rechazar',
  inversionId: string,
  proyectoId: string,
  usuarioId: string,
  monto: number,
  metadata?: Record<string, any>
) {
  inversionLogger.info(`Inversión ${accion}`, {
    accion,
    inversionId,
    proyectoId,
    usuarioId,
    monto,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

/**
 * Log de autenticación
 */
export function logAuth(
  evento: 'login' | 'logout' | 'registro' | 'cambio_password',
  usuarioId: string,
  success: boolean,
  metadata?: Record<string, any>
) {
  authLogger.info(`Autenticación: ${evento}`, {
    evento,
    usuarioId,
    success,
    timestamp: new Date().toISOString(),
    ip: metadata?.ip,
    userAgent: metadata?.userAgent,
    ...metadata
  });
}

/**
 * Log de error de API
 */
export function logAPIError(
  endpoint: string,
  method: string,
  error: Error,
  statusCode: number,
  metadata?: Record<string, any>
) {
  logger.error('API Error', {
    endpoint,
    method,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    statusCode,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

/**
 * Log de request HTTP
 */
export function logHTTPRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, any>
) {
  logger.http('HTTP Request', {
    method,
    url,
    statusCode,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

/**
 * Log de integración externa
 */
export function logIntegration(
  service: 'odoo' | 'firebase' | 'redis',
  operacion: string,
  success: boolean,
  duration?: number,
  metadata?: Record<string, any>
) {
  const serviceLogger = service === 'odoo' ? odooLogger : 
                       service === 'firebase' ? firebaseLogger : 
                       logger;
  
  serviceLogger.info(`${service.toUpperCase()} - ${operacion}`, {
    service,
    operacion,
    success,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

/**
 * Log de performance (operaciones lentas)
 */
export function logPerformance(
  operacion: string,
  duration: number,
  threshold: number = 1000,
  metadata?: Record<string, any>
) {
  if (duration > threshold) {
    logger.warn('Operación lenta detectada', {
      operacion,
      duration,
      threshold,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  } else {
    logger.debug('Performance', {
      operacion,
      duration,
      ...metadata
    });
  }
}

/**
 * Log de cache
 */
export function logCache(
  accion: 'hit' | 'miss' | 'set' | 'delete',
  key: string,
  metadata?: Record<string, any>
) {
  logger.debug(`Cache ${accion.toUpperCase()}`, {
    accion,
    key,
    ...metadata
  });
}

// ========================
// MIDDLEWARE PARA NEXT.JS
// ========================

/**
 * Middleware de logging para API routes
 */
export function loggerMiddleware(handler: any) {
  return async (req: any, res: any) => {
    const startTime = Date.now();
    
    // Log de request
    logger.http('Request iniciado', {
      method: req.method,
      url: req.url,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    try {
      // Ejecutar handler
      await handler(req, res);
      
      // Log de respuesta exitosa
      const duration = Date.now() - startTime;
      logHTTPRequest(
        req.method,
        req.url,
        res.statusCode,
        duration,
        {
          ip: req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent']
        }
      );
    } catch (error) {
      // Log de error
      const duration = Date.now() - startTime;
      logAPIError(
        req.url,
        req.method,
        error as Error,
        res.statusCode || 500,
        {
          duration,
          ip: req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent']
        }
      );
      throw error;
    }
  };
}

// ========================
// UTILIDADES
// ========================

/**
 * Wrapper para medir duración de operaciones
 */
export async function measureDuration<T>(
  operacion: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logPerformance(operacion, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error en ${operacion}`, {
      operacion,
      duration,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    throw error;
  }
}

/**
 * Sanitiza datos sensibles antes de logear
 */
export function sanitizeForLog(data: any): any {
  const sensitive = ['password', 'token', 'secret', 'apiKey', 'pin'];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLog(sanitized[key]);
    }
  }
  
  return sanitized;
}

// ========================
// EXPORTACIONES
// ========================

export default logger;

export const log = {
  // Logger principal
  logger,
  
  // Loggers especializados
  finance: financeLogger,
  odoo: odooLogger,
  firebase: firebaseLogger,
  auth: authLogger,
  inversion: inversionLogger,
  
  // Funciones helper
  logFinancialOperation,
  logInversion,
  logAuth,
  logAPIError,
  logHTTPRequest,
  logIntegration,
  logPerformance,
  logCache,
  
  // Middleware
  loggerMiddleware,
  
  // Utilidades
  measureDuration,
  sanitizeForLog
};
