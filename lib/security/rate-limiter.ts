/**
 * Rate Limiting Module - DoS Protection
 * Implementa protección contra ataques de denegación de servicio (DoS)
 * y uso abusivo de la API mediante rate limiting con Redis
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Cliente Redis para almacenar contadores de rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Redis: Máximo de reintentos alcanzado');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis conectado para rate limiting');
});

// Inicializar conexión
redisClient.connect().catch(console.error);

/**
 * Rate Limiter General - API pública
 * Límite: 100 requests / 15 minutos por IP
 */
export const rateLimiterGeneral = rateLimit({
  store: new RedisStore({
    // @ts-ignore - Redis client v4+ es compatible
    client: redisClient,
    prefix: 'rl:general:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Por favor intenta nuevamente en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Retorna info de rate limit en headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
  skip: (req) => {
    // Bypass para IPs whitelisted (opcional)
    const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
    return whitelist.includes(req.ip || '');
  },
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit excedido - IP: ${req.ip}, Path: ${req.path}`);
    const resetTime = (req as any).rateLimit?.resetTime;
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes. Por favor intenta nuevamente en 15 minutos.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(resetTime ? (resetTime.getTime() - Date.now()) / 1000 : 900)
    });
  }
});

/**
 * Rate Limiter Estricto - Operaciones críticas de dinero
 * Límite: 10 requests / 15 minutos por IP
 * Aplica a: inversiones, transferencias, retiros
 */
export const rateLimiterEstricto = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl:strict:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 requests por ventana
  message: {
    success: false,
    error: 'Límite de operaciones financieras excedido. Intenta en 15 minutos.',
    code: 'FINANCIAL_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.error(`🚨 Rate limit estricto excedido - IP: ${req.ip}, Path: ${req.path}, User: ${req.body?.usuarioId}`);
    const resetTime = (req as any).rateLimit?.resetTime;
    res.status(429).json({
      success: false,
      error: 'Has excedido el límite de operaciones financieras. Por seguridad, intenta nuevamente en 15 minutos.',
      code: 'FINANCIAL_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(resetTime ? (resetTime.getTime() - Date.now()) / 1000 : 900)
    });
  }
});

/**
 * Rate Limiter de Autenticación - Login attempts
 * Límite: 5 intentos / 15 minutos por IP
 * Protege contra ataques de fuerza bruta
 */
export const rateLimiterAuth = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos de login
  skipSuccessfulRequests: true, // No cuenta logins exitosos
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.error(`🚨 Rate limit autenticación excedido - IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de inicio de sesión. Por seguridad, espera 15 minutos.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: 900
    });
  }
});

/**
 * Rate Limiter por Usuario - Límite individual
 * Límite: 200 requests / hora por usuario autenticado
 */
export const rateLimiterPorUsuario = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl:user:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 200, // 200 requests por hora
  keyGenerator: (req) => {
    // Usar usuarioId del token JWT o IP como fallback
    return req.body?.usuarioId || req.headers['x-user-id'] || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: 'Has excedido el límite de solicitudes por hora.',
    code: 'USER_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate Limiter para creación de proyectos
 * Límite: 3 proyectos / día por usuario
 */
export const rateLimiterCrearProyecto = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl:create-project:',
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 3, // 3 proyectos por día
  keyGenerator: (req) => {
    return req.body?.creadorId || req.headers['x-user-id'] || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: 'Has alcanzado el límite de creación de proyectos por día (3 máximo).',
    code: 'PROJECT_CREATION_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Exportar cliente Redis para uso en otros módulos
 */
export { redisClient };

/**
 * Función helper para limpiar contadores manualmente
 * Útil para testing o casos excepcionales
 */
export async function resetRateLimitForIP(ip: string, prefix: string = 'rl:general:'): Promise<boolean> {
  try {
    const key = `${prefix}${ip}`;
    await redisClient.del(key);
    console.log(`✅ Rate limit reseteado para IP: ${ip}`);
    return true;
  } catch (error) {
    console.error(`❌ Error al resetear rate limit para ${ip}:`, error);
    return false;
  }
}

/**
 * Función para obtener estadísticas de rate limiting
 */
export async function getRateLimitStats(ip: string): Promise<{
  general: number;
  strict: number;
  auth: number;
} | null> {
  try {
    const [general, strict, auth] = await Promise.all([
      redisClient.get(`rl:general:${ip}`),
      redisClient.get(`rl:strict:${ip}`),
      redisClient.get(`rl:auth:${ip}`)
    ]);

    return {
      general: parseInt(general || '0'),
      strict: parseInt(strict || '0'),
      auth: parseInt(auth || '0')
    };
  } catch (error) {
    console.error(`❌ Error al obtener stats de rate limit:`, error);
    return null;
  }
}

/**
 * Cerrar conexión Redis al terminar el proceso
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    await redisClient.quit();
    console.log('✅ Conexión Redis cerrada');
  } catch (error) {
    console.error('❌ Error al cerrar conexión Redis:', error);
  }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  await closeRedisConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeRedisConnection();
  process.exit(0);
});
