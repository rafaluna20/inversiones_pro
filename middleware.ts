import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, obtenerIp, type RateLimitRule } from '@/lib/security/edge-rate-limit';

/** Nombre de la cookie de sesión de billetera (definida en app/actions/auth.ts). */
const COOKIE_NAME = 'billetera_session';

/**
 * Rutas de movimiento de dinero que exigen sesión activa (cookie de la
 * billetera). Ya NO se acepta un `?token=...` en la URL como sustituto: bastaba
 * agregar cualquier valor (`?token=x`) para saltarse esta comprobación. El
 * flujo por enlace se eliminó de las pantallas (ver transferir/page.tsx).
 */
const RUTAS_REQUIEREN_SESION = [
  '/billetera/transferir',
  '/billetera/retirar',
  '/billetera/retirar-banco',
  '/billetera/recargar',
];

/**
 * Reglas de rate limiting por prefijo de ruta. Se aplican a mutaciones
 * (solicitudes POST de Server Actions) para frenar ráfagas de abuso.
 */
const REGLAS_RATE_LIMIT: Array<{ prefijo: string; rule: RateLimitRule }> = [
  { prefijo: '/billetera', rule: { limit: 15, windowMs: 60_000 } },
  { prefijo: '/gestor', rule: { limit: 20, windowMs: 60_000 } },
  { prefijo: '/productos/nuevo', rule: { limit: 10, windowMs: 60_000 } },
  { prefijo: '/productos/editar', rule: { limit: 20, windowMs: 60_000 } },
];

/** Aplica cabeceras de seguridad básicas a cualquier respuesta que continúe. */
function conCabecerasSeguridad(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  return response;
}

/**
 * Middleware para rate limiting, protección de rutas sensibles y redirects
 * de URLs antiguas.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;

  // ========================================
  // RATE LIMITING (mutaciones vía Server Actions)
  // ========================================
  if (request.method === 'POST') {
    const regla = REGLAS_RATE_LIMIT.find((r) => path.startsWith(r.prefijo));
    if (regla) {
      const ip = obtenerIp(request.headers);
      const resultado = checkRateLimit(`${ip}:${regla.prefijo}`, regla.rule);
      if (!resultado.allowed) {
        const retryAfter = Math.max(1, Math.ceil((resultado.resetAt - Date.now()) / 1000));
        return new NextResponse(
          JSON.stringify({
            error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfter),
            },
          }
        );
      }
    }
  }

  // ========================================
  // PROTECCIÓN DE RUTAS DE MOVIMIENTO DE DINERO
  // ========================================
  if (RUTAS_REQUIEREN_SESION.some((r) => path === r || path.startsWith(`${r}/`))) {
    const tieneSesion = Boolean(request.cookies.get(COOKIE_NAME)?.value);
    if (!tieneSesion) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', path);
      return NextResponse.redirect(url);
    }
  }

  // ========================================
  // REDIRECTS DE URLS ANTIGUAS A NUEVAS
  // ========================================

  const redirectsMap: Record<string, string> = {
    '/registroBilletera': '/billetera/registro',
    '/recargarBilletera': '/billetera/recargar',
    '/retirarBilletera': '/billetera/retirar',
    '/perfilesUsers': '/usuarios',
    '/perfilUsuario': '/perfil',
    '/misInversiones': '/mis-inversiones',
    '/nuevoProducto': '/productos/nuevo',
    '/Login': '/login',
  };

  // Redirect directo para páginas exactas
  if (redirectsMap[path]) {
    const url = request.nextUrl.clone();
    url.pathname = redirectsMap[path];
    return NextResponse.redirect(url, 301); // 301 = Permanent Redirect
  }

  // ========================================
  // REDIRECTS DE RUTAS CON PARÁMETROS
  // ========================================

  // /historial/[token] → /billetera/historial?token=xxx
  if (path.match(/^\/historial\/[\w.-]+$/)) {
    const token = path.split('/')[2];
    
    const url = request.nextUrl.clone();
    url.pathname = '/billetera/historial';
    url.searchParams.set('token', token);
    
    return NextResponse.redirect(url, 301);
  }

  // /recargar/[token] → /billetera/recargar?token=xxx
  if (path.match(/^\/recargar\/[\w.-]+$/)) {
    const token = path.split('/')[2];
    
    const url = request.nextUrl.clone();
    url.pathname = '/billetera/recargar';
    url.searchParams.set('token', token);
    
    return NextResponse.redirect(url, 301);
  }

  // /transferencia/[token] → /billetera/transferir?token=xxx
  if (path.match(/^\/transferencia\/[\w.-]+$/)) {
    const token = path.split('/')[2];
    
    const url = request.nextUrl.clone();
    url.pathname = '/billetera/transferir';
    url.searchParams.set('token', token);
    
    return NextResponse.redirect(url, 301);
  }

  // /usuarios/[token] → /billetera (si es un token JWT largo) o /usuarios/[id] (si es un ID)
  if (path.match(/^\/usuarios\/[\w.-]+$/)) {
    const param = path.split('/')[2];
    
    // Si parece un JWT (contiene puntos), redirigir a billetera
    if (param.includes('.') && param.length > 50) {
      const url = request.nextUrl.clone();
      url.pathname = '/billetera';
      url.searchParams.set('token', param);
      return NextResponse.redirect(url, 301);
    }
    // Si no, es un ID de usuario válido, dejar pasar
  }

  // /filtro?q=categoria → /productos/filtro?categoria=xxx
  if (path === '/filtro') {
    const categoria = searchParams.get('q');
    
    const url = request.nextUrl.clone();
    url.pathname = '/productos/filtro';
    if (categoria) {
      url.searchParams.delete('q');
      url.searchParams.set('categoria', categoria);
    }
    
    return NextResponse.redirect(url, 301);
  }

  // ========================================
  // NORMALIZACIÓN DE RUTAS
  // ========================================

  // Remover trailing slash excepto en home
  if (path !== '/' && path.endsWith('/')) {
    const url = request.nextUrl.clone();
    url.pathname = path.slice(0, -1);
    return NextResponse.redirect(url, 301);
  }

  // Continuar con la request normalmente (con cabeceras de seguridad)
  return conCabecerasSeguridad(NextResponse.next());
}

/**
 * Configuración del middleware
 * Define qué rutas deben pasar por el middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static (public static files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|static).*)',
  ],
};
