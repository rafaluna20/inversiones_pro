import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware para manejar redirects de URLs antiguas y protección de rutas
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;

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

  // /yapear/[id] → /billetera/yapear/[id]?token=xxx&tipo=transferencia
  if (path.match(/^\/yapear\/[\w-]+$/)) {
    const id = path.split('/')[2];
    const token = searchParams.get('token') || '';
    const tipo = searchParams.get('tipo') || 'transferencia';
    
    const url = request.nextUrl.clone();
    url.pathname = `/billetera/yapear/${id}`;
    url.searchParams.set('token', token);
    url.searchParams.set('tipo', tipo);
    
    return NextResponse.redirect(url, 301);
  }

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

  // Continuar con la request normalmente
  return NextResponse.next();
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
