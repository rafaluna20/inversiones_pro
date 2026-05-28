/**
 * Custom Error Classes - Structured Error Handling
 * Implementa clases de error personalizadas para manejo robusto de errores
 * 
 * Beneficios:
 * - Errores tipados y estructurados
 * - Códigos de error consistentes
 * - Mejor debugging y logging
 * - Respuestas HTTP apropiadas
 */

// ========================
// BASE ERROR CLASS
// ========================

/**
 * Error base para toda la aplicación
 */
export abstract class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;
  
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;
    
    // Mantener stack trace correcto
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Serializa el error para respuesta API
   */
  toJSON() {
    return {
      success: false,
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        timestamp: this.timestamp.toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          context: this.context,
          stack: this.stack
        })
      }
    };
  }
}

// ========================
// ERRORES DE VALIDACIÓN
// ========================

/**
 * Error de validación de input (400 Bad Request)
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      true,
      context
    );
  }
  
  static fromZodError(zodError: any): ValidationError {
    const errors = zodError.errors.map((err: any) => ({
      campo: err.path.join('.'),
      mensaje: err.message
    }));
    
    return new ValidationError(
      'Error de validación en los datos proporcionados',
      { errors }
    );
  }
}

/**
 * Error de datos faltantes
 */
export class MissingDataError extends AppError {
  constructor(field: string) {
    super(
      `Campo requerido faltante: ${field}`,
      'MISSING_DATA',
      400,
      true,
      { field }
    );
  }
}

// ========================
// ERRORES DE AUTENTICACIÓN
// ========================

/**
 * Error de autenticación (401 Unauthorized)
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Credenciales inválidas',
    context?: Record<string, any>
  ) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      401,
      true,
      context
    );
  }
}

/**
 * Error de token inválido/expirado
 */
export class TokenError extends AppError {
  constructor(
    message: string = 'Token inválido o expirado',
    context?: Record<string, any>
  ) {
    super(
      message,
      'TOKEN_ERROR',
      401,
      true,
      context
    );
  }
}

// ========================
// ERRORES DE AUTORIZACIÓN
// ========================

/**
 * Error de autorización (403 Forbidden)
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'No tienes permisos para realizar esta acción',
    requiredPermission?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'AUTHORIZATION_ERROR',
      403,
      true,
      { requiredPermission, ...context }
    );
  }
}

/**
 * Error de recursos (403 Forbidden)
 */
export class ForbiddenError extends AppError {
  constructor(
    resource: string,
    context?: Record<string, any>
  ) {
    super(
      `Acceso denegado al recurso: ${resource}`,
      'FORBIDDEN',
      403,
      true,
      { resource, ...context }
    );
  }
}

// ========================
// ERRORES DE RECURSOS
// ========================

/**
 * Error de recurso no encontrado (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    id?: string,
    context?: Record<string, any>
  ) {
    super(
      id 
        ? `${resource} con ID '${id}' no encontrado`
        : `${resource} no encontrado`,
      'NOT_FOUND',
      404,
      true,
      { resource, id, ...context }
    );
  }
}

/**
 * Error de recurso ya existente (409 Conflict)
 */
export class ConflictError extends AppError {
  constructor(
    resource: string,
    field?: string,
    context?: Record<string, any>
  ) {
    super(
      field
        ? `${resource} con ${field} ya existe`
        : `${resource} ya existe`,
      'CONFLICT',
      409,
      true,
      { resource, field, ...context }
    );
  }
}

// ========================
// ERRORES DE NEGOCIO
// ========================

/**
 * Error de lógica de negocio (422 Unprocessable Entity)
 */
export class BusinessLogicError extends AppError {
  constructor(
    message: string,
    code: string = 'BUSINESS_LOGIC_ERROR',
    context?: Record<string, any>
  ) {
    super(
      message,
      code,
      422,
      true,
      context
    );
  }
}

/**
 * Error de fondos insuficientes
 */
export class InsufficientFundsError extends BusinessLogicError {
  constructor(
    required: number,
    available: number,
    context?: Record<string, any>
  ) {
    super(
      `Fondos insuficientes. Requerido: S/ ${required}, Disponible: S/ ${available}`,
      'INSUFFICIENT_FUNDS',
      { required, available, ...context }
    );
  }
}

/**
 * Error de inversión (cubos no disponibles, etc.)
 */
export class InversionError extends BusinessLogicError {
  constructor(
    message: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'INVERSION_ERROR',
      context
    );
  }
}

/**
 * Error de proyecto (etapa incorrecta, ya completado, etc.)
 */
export class ProyectoError extends BusinessLogicError {
  constructor(
    message: string,
    proyectoId: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'PROYECTO_ERROR',
      { proyectoId, ...context }
    );
  }
}

// ========================
// ERRORES DE INTEGRACIÓN
// ========================

/**
 * Error de integración con servicios externos (502 Bad Gateway)
 */
export class IntegrationError extends AppError {
  constructor(
    service: string,
    message: string,
    context?: Record<string, any>
  ) {
    super(
      `Error en integración con ${service}: ${message}`,
      'INTEGRATION_ERROR',
      502,
      true,
      { service, ...context }
    );
  }
}

/**
 * Error de Odoo API
 */
export class OdooError extends IntegrationError {
  constructor(
    message: string,
    odooCode?: string,
    context?: Record<string, any>
  ) {
    super(
      'Odoo',
      message,
      { odooCode, ...context }
    );
  }
}

/**
 * Error de Firebase
 */
export class FirebaseError extends IntegrationError {
  constructor(
    message: string,
    firebaseCode?: string,
    context?: Record<string, any>
  ) {
    super(
      'Firebase',
      message,
      { firebaseCode, ...context }
    );
  }
}

/**
 * Error de Redis
 */
export class RedisError extends IntegrationError {
  constructor(
    message: string,
    context?: Record<string, any>
  ) {
    super(
      'Redis',
      message,
      context
    );
  }
}

// ========================
// ERRORES DE TASA DE LÍMITE
// ========================

/**
 * Error de rate limiting (429 Too Many Requests)
 */
export class RateLimitError extends AppError {
  constructor(
    retryAfter: number,
    context?: Record<string, any>
  ) {
    super(
      `Demasiadas solicitudes. Intenta nuevamente en ${retryAfter} segundos`,
      'RATE_LIMIT_EXCEEDED',
      429,
      true,
      { retryAfter, ...context }
    );
  }
}

// ========================
// ERRORES DE SERVIDOR
// ========================

/**
 * Error interno del servidor (500 Internal Server Error)
 */
export class InternalServerError extends AppError {
  constructor(
    message: string = 'Error interno del servidor',
    context?: Record<string, any>
  ) {
    super(
      message,
      'INTERNAL_SERVER_ERROR',
      500,
      false, // No operational (bug del sistema)
      context
    );
  }
}

/**
 * Error de timeout
 */
export class TimeoutError extends AppError {
  constructor(
    operation: string,
    timeoutMs: number,
    context?: Record<string, any>
  ) {
    super(
      `Timeout en operación '${operation}' después de ${timeoutMs}ms`,
      'TIMEOUT',
      504,
      true,
      { operation, timeoutMs, ...context }
    );
  }
}

/**
 * Error de base de datos
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    query?: string,
    context?: Record<string, any>
  ) {
    super(
      `Error de base de datos: ${message}`,
      'DATABASE_ERROR',
      500,
      false,
      { query, ...context }
    );
  }
}

// ========================
// ERROR HANDLER MIDDLEWARE
// ========================

/**
 * Determina si un error es operacional (esperado) o programático (bug)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convierte errores genéricos a AppError apropiado
 */
export function normalizeError(error: unknown): AppError {
  // Si ya es AppError, retornar como está
  if (error instanceof AppError) {
    return error;
  }
  
  // Si es Error estándar
  if (error instanceof Error) {
    // Errores de Firebase
    if ('code' in error && typeof (error as any).code === 'string') {
      const firebaseCode = (error as any).code;
      if (firebaseCode.startsWith('auth/')) {
        return new AuthenticationError(error.message, { firebaseCode });
      }
      if (firebaseCode.startsWith('permission-denied')) {
        return new AuthorizationError(error.message, undefined, { firebaseCode });
      }
      return new FirebaseError(error.message, firebaseCode);
    }
    
    // Otros errores estándar
    return new InternalServerError(error.message, {
      originalError: error.name,
      stack: error.stack
    });
  }
  
  // Error desconocido
  return new InternalServerError('Error desconocido', {
    originalError: String(error)
  });
}

/**
 * Middleware de manejo de errores para Next.js API Routes
 */
export function errorHandler(error: unknown, req: any, res: any) {
  const normalizedError = normalizeError(error);
  
  // Log del error (conectar con logger)
  if (!normalizedError.isOperational) {
    console.error('🚨 ERROR NO OPERACIONAL:', normalizedError);
  } else {
    console.warn('⚠️ ERROR OPERACIONAL:', normalizedError.message);
  }
  
  // Enviar respuesta
  res.status(normalizedError.statusCode).json(normalizedError.toJSON());
}

/**
 * Wrapper para API routes con manejo de errores automático
 */
export function withErrorHandler(
  handler: (req: any, res: any) => Promise<any>
) {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error, req, res);
    }
  };
}

// ========================
// UTILIDADES
// ========================

/**
 * Lanza error si condición no se cumple (assertion)
 */
export function assert(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new InternalServerError(message);
  }
}

/**
 * Lanza NotFoundError si el recurso es null/undefined
 */
export function assertExists<T>(
  resource: T | null | undefined,
  resourceName: string,
  id?: string
): asserts resource is T {
  if (resource === null || resource === undefined) {
    throw new NotFoundError(resourceName, id);
  }
}

/**
 * Lanza AuthorizationError si no tiene permiso
 */
export function assertAuthorized(
  hasPermission: boolean,
  message?: string
): asserts hasPermission {
  if (!hasPermission) {
    throw new AuthorizationError(message);
  }
}

// ========================
// EXPORTACIONES
// ========================

export const errors = {
  // Clases base
  AppError,
  
  // Validación
  ValidationError,
  MissingDataError,
  
  // Autenticación/Autorización
  AuthenticationError,
  TokenError,
  AuthorizationError,
  ForbiddenError,
  
  // Recursos
  NotFoundError,
  ConflictError,
  
  // Negocio
  BusinessLogicError,
  InsufficientFundsError,
  InversionError,
  ProyectoError,
  
  // Integración
  IntegrationError,
  OdooError,
  FirebaseError,
  RedisError,
  
  // Rate Limit
  RateLimitError,
  
  // Servidor
  InternalServerError,
  TimeoutError,
  DatabaseError,
  
  // Utilidades
  isOperationalError,
  normalizeError,
  errorHandler,
  withErrorHandler,
  assert,
  assertExists,
  assertAuthorized
};

export default errors;
