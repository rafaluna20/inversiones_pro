/**
 * RBAC - Role-Based Access Control Module
 * Implementa control de acceso basado en roles para prevenir:
 * - Escalada de privilegios
 * - Acceso no autorizado a recursos
 * - Manipulación de datos sin permisos
 */

import { z } from 'zod';

// ========================
// DEFINICIÓN DE ROLES
// ========================

/**
 * Roles del sistema (jerarquía de menor a mayor privilegio)
 */
export enum Rol {
  USUARIO = 'usuario',              // Usuario básico registrado
  INVERSOR = 'inversor',            // Usuario que ha invertido
  SOCIO_TIERRA = 'socio_tierra',    // Socio en etapa tierra
  SOCIO_CAPITAL = 'socio_capital',  // Socio en etapa construcción
  SOCIO_MIXTO = 'socio_mixto',      // Socio en ambas etapas
  GESTOR = 'gestor',                // Gestor de proyectos
  ADMIN = 'admin',                   // Administrador
  SUPER_ADMIN = 'super_admin'       // Super administrador
}

/**
 * Permisos granulares del sistema
 */
export enum Permiso {
  // Proyectos
  CREAR_PROYECTO = 'crear_proyecto',
  EDITAR_PROYECTO = 'editar_proyecto',
  ELIMINAR_PROYECTO = 'eliminar_proyecto',
  VER_PROYECTO = 'ver_proyecto',
  VER_PROYECTOS_PRIVADOS = 'ver_proyectos_privados',

  // Inversiones
  INVERTIR = 'invertir',
  APROBAR_INVERSION = 'aprobar_inversion',
  RECHAZAR_INVERSION = 'rechazar_inversion',
  VER_INVERSIONES = 'ver_inversiones',
  VER_TODAS_INVERSIONES = 'ver_todas_inversiones',

  // Socios
  VER_SOCIOS = 'ver_socios',
  MODIFICAR_SOCIO = 'modificar_socio',
  ELIMINAR_SOCIO = 'eliminar_socio',

  // Hitos de Construcción
  CREAR_HITO = 'crear_hito',
  ACTUALIZAR_HITO = 'actualizar_hito',
  ELIMINAR_HITO = 'eliminar_hito',
  VER_HITOS = 'ver_hitos',

  // Documentos
  SUBIR_DOCUMENTO = 'subir_documento',
  VER_DOCUMENTOS = 'ver_documentos',
  VER_DOCUMENTOS_CONFIDENCIALES = 'ver_documentos_confidenciales',
  ELIMINAR_DOCUMENTO = 'eliminar_documento',

  // Financiero
  DISTRIBUIR_GANANCIAS = 'distribuir_ganancias',
  VER_REPORTES_FINANCIEROS = 'ver_reportes_financieros',
  MODIFICAR_MONTOS = 'modificar_montos',

  // Usuarios
  VER_USUARIOS = 'ver_usuarios',
  MODIFICAR_USUARIO = 'modificar_usuario',
  ELIMINAR_USUARIO = 'eliminar_usuario',
  ASIGNAR_ROLES = 'asignar_roles',

  // Transacciones Wallet
  TRANSFERIR = 'transferir',
  RETIRAR = 'retirar',
  VER_TRANSACCIONES = 'ver_transacciones',
  VER_TODAS_TRANSACCIONES = 'ver_todas_transacciones',

  // Auditoría
  VER_AUDIT_LOG = 'ver_audit_log',
  EXPORTAR_DATOS = 'exportar_datos',

  // Sistema
  MODIFICAR_CONFIGURACION = 'modificar_configuracion',
  VER_METRICAS_SISTEMA = 'ver_metricas_sistema'
}

/**
 * Matriz de permisos por rol
 */
// Definición de permisos base para evitar referencias circulares
const PERMISOS_USUARIO = [
  Permiso.VER_PROYECTO,
  Permiso.INVERTIR,
  Permiso.VER_INVERSIONES,
  Permiso.VER_DOCUMENTOS,
  Permiso.VER_TRANSACCIONES,
  Permiso.TRANSFERIR
];

const PERMISOS_INVERSOR = [
  ...PERMISOS_USUARIO,
  Permiso.VER_HITOS,
  Permiso.VER_REPORTES_FINANCIEROS
];

const PERMISOS_SOCIO_TIERRA = [
  ...PERMISOS_INVERSOR,
  Permiso.VER_SOCIOS,
  Permiso.VER_DOCUMENTOS_CONFIDENCIALES,
  Permiso.CREAR_PROYECTO
];

const PERMISOS_SOCIO_CAPITAL = [
  ...PERMISOS_SOCIO_TIERRA
];

const PERMISOS_SOCIO_MIXTO = [
  ...PERMISOS_SOCIO_TIERRA,
  Permiso.ACTUALIZAR_HITO
];

const PERMISOS_GESTOR = [
  ...PERMISOS_SOCIO_MIXTO,
  Permiso.EDITAR_PROYECTO,
  Permiso.APROBAR_INVERSION,
  Permiso.RECHAZAR_INVERSION,
  Permiso.CREAR_HITO,
  Permiso.ELIMINAR_HITO,
  Permiso.SUBIR_DOCUMENTO,
  Permiso.MODIFICAR_SOCIO,
  Permiso.VER_TODAS_INVERSIONES,
  Permiso.DISTRIBUIR_GANANCIAS,
  Permiso.VER_METRICAS_SISTEMA
];

const PERMISOS_ADMIN = [
  ...PERMISOS_GESTOR,
  Permiso.ELIMINAR_PROYECTO,
  Permiso.VER_PROYECTOS_PRIVADOS,
  Permiso.VER_TODAS_INVERSIONES,
  Permiso.ELIMINAR_DOCUMENTO,
  Permiso.VER_USUARIOS,
  Permiso.MODIFICAR_USUARIO,
  Permiso.VER_TODAS_TRANSACCIONES,
  Permiso.VER_AUDIT_LOG,
  Permiso.EXPORTAR_DATOS,
  Permiso.RETIRAR
];

/**
 * Matriz de permisos por rol
 */
const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  [Rol.USUARIO]: PERMISOS_USUARIO,
  [Rol.INVERSOR]: PERMISOS_INVERSOR,
  [Rol.SOCIO_TIERRA]: PERMISOS_SOCIO_TIERRA,
  [Rol.SOCIO_CAPITAL]: PERMISOS_SOCIO_CAPITAL,
  [Rol.SOCIO_MIXTO]: PERMISOS_SOCIO_MIXTO,
  [Rol.GESTOR]: PERMISOS_GESTOR,
  [Rol.ADMIN]: PERMISOS_ADMIN,
  [Rol.SUPER_ADMIN]: Object.values(Permiso)
};

// ========================
// INTERFACES
// ========================

export interface UsuarioRBAC {
  id: string;
  email: string;
  roles: Rol[];
  permisosAdicionales?: Permiso[]; // Permisos custom asignados manualmente
  permisosRevocados?: Permiso[];   // Permisos explícitamente revocados
}

export interface ContextoRecurso {
  tipo: 'proyecto' | 'inversion' | 'documento' | 'socio' | 'hito' | 'usuario';
  id: string;
  propietarioId?: string;
  proyectoId?: string;
  visibilidad?: 'publico' | 'privado' | 'socios' | 'admin';
}

// ========================
// FUNCIONES DE AUTORIZACIÓN
// ========================

/**
 * Obtiene todos los permisos efectivos de un usuario
 * (combinación de permisos por rol + adicionales - revocados)
 */
export function obtenerPermisosUsuario(usuario: UsuarioRBAC): Permiso[] {
  const permisosBase = new Set<Permiso>();

  // Agregar permisos de todos los roles del usuario
  usuario.roles.forEach(rol => {
    const permisos = PERMISOS_POR_ROL[rol] || [];
    permisos.forEach(p => permisosBase.add(p));
  });

  // Agregar permisos adicionales
  usuario.permisosAdicionales?.forEach(p => permisosBase.add(p));

  // Remover permisos revocados
  usuario.permisosRevocados?.forEach(p => permisosBase.delete(p));

  return Array.from(permisosBase);
}

/**
 * Verifica si un usuario tiene un permiso específico
 */
export function tienePermiso(usuario: UsuarioRBAC, permiso: Permiso): boolean {
  const permisos = obtenerPermisosUsuario(usuario);
  return permisos.includes(permiso);
}

/**
 * Verifica si un usuario tiene al menos uno de varios permisos
 */
export function tieneAlgunPermiso(usuario: UsuarioRBAC, permisos: Permiso[]): boolean {
  const permisosUsuario = obtenerPermisosUsuario(usuario);
  return permisos.some(p => permisosUsuario.includes(p));
}

/**
 * Verifica si un usuario tiene todos los permisos especificados
 */
export function tieneTodosPermisos(usuario: UsuarioRBAC, permisos: Permiso[]): boolean {
  const permisosUsuario = obtenerPermisosUsuario(usuario);
  return permisos.every(p => permisosUsuario.includes(p));
}

/**
 * Verifica si un usuario tiene al menos un rol específico
 */
export function tieneRol(usuario: UsuarioRBAC, rol: Rol): boolean {
  return usuario.roles.includes(rol);
}

/**
 * Verifica si un usuario es admin o super admin
 */
export function esAdmin(usuario: UsuarioRBAC): boolean {
  return usuario.roles.some(r => [Rol.ADMIN, Rol.SUPER_ADMIN].includes(r));
}

/**
 * Verifica si un usuario es socio (cualquier tipo)
 */
export function esSocio(usuario: UsuarioRBAC): boolean {
  return usuario.roles.some(r =>
    [Rol.SOCIO_TIERRA, Rol.SOCIO_CAPITAL, Rol.SOCIO_MIXTO].includes(r)
  );
}

/**
 * Verifica acceso a un recurso específico considerando propiedad y contexto
 */
export function puedeAccederRecurso(
  usuario: UsuarioRBAC,
  recurso: ContextoRecurso,
  accion: Permiso
): boolean {
  // Verificar permiso base
  if (!tienePermiso(usuario, accion)) {
    return false;
  }

  // Reglas adicionales por tipo de recurso
  switch (recurso.tipo) {
    case 'proyecto':
      // Si el proyecto es privado, solo admin o creador
      if (recurso.visibilidad === 'privado') {
        return esAdmin(usuario) || usuario.id === recurso.propietarioId;
      }
      return true;

    case 'inversion':
      // Solo puede ver sus propias inversiones o admin
      if (accion === Permiso.VER_INVERSIONES) {
        return usuario.id === recurso.propietarioId ||
          tienePermiso(usuario, Permiso.VER_TODAS_INVERSIONES);
      }
      return true;

    case 'documento':
      // Documentos confidenciales solo para socios/admin
      if (recurso.visibilidad === 'admin') {
        return esAdmin(usuario);
      }
      if (recurso.visibilidad === 'socios') {
        return esSocio(usuario) || esAdmin(usuario);
      }
      return true;

    case 'socio':
      // Solo puede modificar si es admin o gestor del proyecto
      if (accion === Permiso.MODIFICAR_SOCIO) {
        return esAdmin(usuario) || tienePermiso(usuario, Permiso.MODIFICAR_SOCIO);
      }
      return true;

    default:
      return true;
  }
}

// ========================
// DECORADORES/MIDDLEWARE
// ========================

/**
 * Error de autorización
 */
export class ErrorAutorizacion extends Error {
  constructor(
    message: string,
    public codigo: string = 'ACCESO_DENEGADO',
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'ErrorAutorizacion';
  }
}

/**
 * Requiere que el usuario tenga un permiso específico
 * @throws ErrorAutorizacion si no tiene permiso
 */
export function requierePermiso(usuario: UsuarioRBAC, permiso: Permiso): void {
  if (!tienePermiso(usuario, permiso)) {
    throw new ErrorAutorizacion(
      `No tienes permiso para realizar esta acción: ${permiso}`,
      'PERMISO_INSUFICIENTE'
    );
  }
}

/**
 * Requiere que el usuario tenga al menos uno de los permisos
 * @throws ErrorAutorizacion si no tiene ningún permiso
 */
export function requiereAlgunPermiso(usuario: UsuarioRBAC, permisos: Permiso[]): void {
  if (!tieneAlgunPermiso(usuario, permisos)) {
    throw new ErrorAutorizacion(
      `No tienes ninguno de los permisos requeridos: ${permisos.join(', ')}`,
      'PERMISO_INSUFICIENTE'
    );
  }
}

/**
 * Requiere que el usuario sea el propietario del recurso o admin
 * @throws ErrorAutorizacion si no es propietario ni admin
 */
export function requierePropietarioOAdmin(
  usuario: UsuarioRBAC,
  propietarioId: string
): void {
  if (usuario.id !== propietarioId && !esAdmin(usuario)) {
    throw new ErrorAutorizacion(
      'Solo el propietario o un administrador puede realizar esta acción',
      'NO_AUTORIZADO'
    );
  }
}

/**
 * Requiere que el usuario sea admin
 * @throws ErrorAutorizacion si no es admin
 */
export function requiereAdmin(usuario: UsuarioRBAC): void {
  if (!esAdmin(usuario)) {
    throw new ErrorAutorizacion(
      'Esta acción requiere permisos de administrador',
      'REQUIERE_ADMIN'
    );
  }
}

// ========================
// FUNCIONES DE GESTIÓN DE ROLES
// ========================

/**
 * Asigna un rol a un usuario (solo SUPER_ADMIN)
 */
export function asignarRol(
  usuarioActual: UsuarioRBAC,
  usuarioObjetivo: UsuarioRBAC,
  nuevoRol: Rol
): UsuarioRBAC {
  // Solo SUPER_ADMIN puede asignar roles
  if (!tieneRol(usuarioActual, Rol.SUPER_ADMIN)) {
    throw new ErrorAutorizacion(
      'Solo un Super Admin puede asignar roles',
      'REQUIERE_SUPER_ADMIN'
    );
  }

  // No se puede asignar SUPER_ADMIN a otros
  if (nuevoRol === Rol.SUPER_ADMIN && usuarioActual.id !== usuarioObjetivo.id) {
    throw new ErrorAutorizacion(
      'No puedes asignar el rol de Super Admin a otros usuarios',
      'OPERACION_PROHIBIDA'
    );
  }

  // Agregar rol si no lo tiene
  if (!usuarioObjetivo.roles.includes(nuevoRol)) {
    usuarioObjetivo.roles.push(nuevoRol);
  }

  return usuarioObjetivo;
}

/**
 * Remueve un rol de un usuario (solo SUPER_ADMIN)
 */
export function removerRol(
  usuarioActual: UsuarioRBAC,
  usuarioObjetivo: UsuarioRBAC,
  rol: Rol
): UsuarioRBAC {
  if (!tieneRol(usuarioActual, Rol.SUPER_ADMIN)) {
    throw new ErrorAutorizacion(
      'Solo un Super Admin puede remover roles',
      'REQUIERE_SUPER_ADMIN'
    );
  }

  // No se puede remover SUPER_ADMIN de sí mismo
  if (rol === Rol.SUPER_ADMIN && usuarioActual.id === usuarioObjetivo.id) {
    throw new ErrorAutorizacion(
      'No puedes remover tu propio rol de Super Admin',
      'OPERACION_PROHIBIDA'
    );
  }

  usuarioObjetivo.roles = usuarioObjetivo.roles.filter(r => r !== rol);

  return usuarioObjetivo;
}

/**
 * Asigna un permiso adicional a un usuario
 */
export function asignarPermisoAdicional(
  usuarioActual: UsuarioRBAC,
  usuarioObjetivo: UsuarioRBAC,
  permiso: Permiso
): UsuarioRBAC {
  requiereAdmin(usuarioActual);

  if (!usuarioObjetivo.permisosAdicionales) {
    usuarioObjetivo.permisosAdicionales = [];
  }

  if (!usuarioObjetivo.permisosAdicionales.includes(permiso)) {
    usuarioObjetivo.permisosAdicionales.push(permiso);
  }

  return usuarioObjetivo;
}

/**
 * Revoca un permiso específico de un usuario
 */
export function revocarPermiso(
  usuarioActual: UsuarioRBAC,
  usuarioObjetivo: UsuarioRBAC,
  permiso: Permiso
): UsuarioRBAC {
  requiereAdmin(usuarioActual);

  if (!usuarioObjetivo.permisosRevocados) {
    usuarioObjetivo.permisosRevocados = [];
  }

  if (!usuarioObjetivo.permisosRevocados.includes(permiso)) {
    usuarioObjetivo.permisosRevocados.push(permiso);
  }

  return usuarioObjetivo;
}

/**
 * Exporta utilidades para middleware de Next.js
 */
export const rbacMiddleware = {
  requierePermiso,
  requiereAlgunPermiso,
  requierePropietarioOAdmin,
  requiereAdmin,
  tienePermiso,
  puedeAccederRecurso
};
