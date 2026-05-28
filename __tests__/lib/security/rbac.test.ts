/**
 * Unit Tests - RBAC Module
 * Tests para control de acceso basado en roles
 */

import {
  Rol,
  Permiso,
  tienePermiso,
  tieneRol,
  esAdmin,
  esSocio,
  obtenerPermisosUsuario,
  requierePermiso,
  requiereAdmin,
  puedeAccederRecurso,
  asignarRol,
  UsuarioRBAC,
} from '@/lib/security/rbac';

describe('RBAC Module', () => {
  const usuarioBasico: UsuarioRBAC = {
    id: 'user1',
    email: 'user@example.com',
    roles: [Rol.USUARIO],
  };

  const inversor: UsuarioRBAC = {
    id: 'inv1',
    email: 'inversor@example.com',
    roles: [Rol.INVERSOR],
  };

  const socioTierra: UsuarioRBAC = {
    id: 'socio1',
    email: 'socio@example.com',
    roles: [Rol.SOCIO_TIERRA],
  };

  const gestor: UsuarioRBAC = {
    id: 'gestor1',
    email: 'gestor@example.com',
    roles: [Rol.GESTOR],
  };

  const admin: UsuarioRBAC = {
    id: 'admin1',
    email: 'admin@example.com',
    roles: [Rol.ADMIN],
  };

  const superAdmin: UsuarioRBAC = {
    id: 'super1',
    email: 'super@example.com',
    roles: [Rol.SUPER_ADMIN],
  };

  describe('obtenerPermisosUsuario', () => {
    test('usuario básico debe tener permisos limitados', () => {
      const permisos = obtenerPermisosUsuario(usuarioBasico);
      
      expect(permisos).toContain(Permiso.VER_PROYECTO);
      expect(permisos).toContain(Permiso.INVERTIR);
      expect(permisos).not.toContain(Permiso.APROBAR_INVERSION);
      expect(permisos).not.toContain(Permiso.ELIMINAR_PROYECTO);
    });

    test('inversor debe heredar permisos de usuario', () => {
      const permisos = obtenerPermisosUsuario(inversor);
      
      expect(permisos).toContain(Permiso.VER_PROYECTO);
      expect(permisos).toContain(Permiso.INVERTIR);
      expect(permisos).toContain(Permiso.VER_HITOS);
    });

    test('admin debe tener casi todos los permisos', () => {
      const permisos = obtenerPermisosUsuario(admin);
      
      expect(permisos).toContain(Permiso.APROBAR_INVERSION);
      expect(permisos).toContain(Permiso.ELIMINAR_PROYECTO);
      expect(permisos).toContain(Permiso.VER_USUARIOS);
      expect(permisos).toContain(Permiso.MODIFICAR_CONFIGURACION);
    });

    test('super admin debe tener todos los permisos', () => {
      const permisos = obtenerPermisosUsuario(superAdmin);
      
      expect(permisos).toContain(Permiso.ASIGNAR_ROLES);
      expect(permisos.length).toBeGreaterThan(obtenerPermisosUsuario(admin).length);
    });
  });

  describe('tienePermiso', () => {
    test('usuario básico NO puede aprobar inversiones', () => {
      expect(tienePermiso(usuarioBasico, Permiso.APROBAR_INVERSION)).toBe(false);
    });

    test('usuario básico SÍ puede invertir', () => {
      expect(tienePermiso(usuarioBasico, Permiso.INVERTIR)).toBe(true);
    });

    test('gestor SÍ puede aprobar inversiones', () => {
      expect(tienePermiso(gestor, Permiso.APROBAR_INVERSION)).toBe(true);
    });

    test('admin SÍ puede aprobar inversiones', () => {
      expect(tienePermiso(admin, Permiso.APROBAR_INVERSION)).toBe(true);
    });
  });

  describe('tieneRol', () => {
    test('debe verificar correctamente el rol', () => {
      expect(tieneRol(usuarioBasico, Rol.USUARIO)).toBe(true);
      expect(tieneRol(usuarioBasico, Rol.ADMIN)).toBe(false);
      expect(tieneRol(admin, Rol.ADMIN)).toBe(true);
    });
  });

  describe('esAdmin', () => {
    test('usuario básico NO es admin', () => {
      expect(esAdmin(usuarioBasico)).toBe(false);
    });

    test('admin SÍ es admin', () => {
      expect(esAdmin(admin)).toBe(true);
    });

    test('super admin SÍ es admin', () => {
      expect(esAdmin(superAdmin)).toBe(true);
    });
  });

  describe('esSocio', () => {
    test('usuario básico NO es socio', () => {
      expect(esSocio(usuarioBasico)).toBe(false);
    });

    test('socio tierra SÍ es socio', () => {
      expect(esSocio(socioTierra)).toBe(true);
    });
  });

  describe('requierePermiso', () => {
    test('debe lanzar error si no tiene permiso', () => {
      expect(() => {
        requierePermiso(usuarioBasico, Permiso.APROBAR_INVERSION);
      }).toThrow('No tienes permiso');
    });

    test('no debe lanzar error si tiene permiso', () => {
      expect(() => {
        requierePermiso(admin, Permiso.APROBAR_INVERSION);
      }).not.toThrow();
    });
  });

  describe('requiereAdmin', () => {
    test('debe lanzar error si no es admin', () => {
      expect(() => {
        requiereAdmin(usuarioBasico);
      }).toThrow('requiere permisos de administrador');
    });

    test('no debe lanzar error si es admin', () => {
      expect(() => {
        requiereAdmin(admin);
      }).not.toThrow();
    });
  });

  describe('puedeAccederRecurso', () => {
    test('usuario puede ver sus propias inversiones', () => {
      const recurso = {
        tipo: 'inversion' as const,
        id: 'inv123',
        propietarioId: 'user1',
      };
      
      const puede = puedeAccederRecurso(
        usuarioBasico,
        recurso,
        Permiso.VER_INVERSIONES
      );
      
      expect(puede).toBe(true);
    });

    test('usuario NO puede ver inversiones de otros', () => {
      const recurso = {
        tipo: 'inversion' as const,
        id: 'inv123',
        propietarioId: 'otro-usuario',
      };
      
      const puede = puedeAccederRecurso(
        usuarioBasico,
        recurso,
        Permiso.VER_INVERSIONES
      );
      
      expect(puede).toBe(false);
    });

    test('admin SÍ puede ver inversiones de otros', () => {
      const recurso = {
        tipo: 'inversion' as const,
        id: 'inv123',
        propietarioId: 'otro-usuario',
      };
      
      const puede = puedeAccederRecurso(
        admin,
        recurso,
        Permiso.VER_INVERSIONES
      );
      
      expect(puede).toBe(true);
    });

    test('proyecto privado solo visible para admin o creador', () => {
      const recurso = {
        tipo: 'proyecto' as const,
        id: 'proj123',
        propietarioId: 'creador123',
        visibilidad: 'privado' as const,
      };
      
      expect(puedeAccederRecurso(usuarioBasico, recurso, Permiso.VER_PROYECTO)).toBe(false);
      expect(puedeAccederRecurso(admin, recurso, Permiso.VER_PROYECTO)).toBe(true);
    });
  });

  describe('asignarRol', () => {
    test('super admin puede asignar roles', () => {
      const usuario: UsuarioRBAC = {
        id: 'user2',
        email: 'user2@example.com',
        roles: [Rol.USUARIO],
      };
      
      const actualizado = asignarRol(superAdmin, usuario, Rol.GESTOR);
      
      expect(actualizado.roles).toContain(Rol.GESTOR);
    });

    test('admin NO puede asignar roles', () => {
      const usuario: UsuarioRBAC = {
        id: 'user2',
        email: 'user2@example.com',
        roles: [Rol.USUARIO],
      };
      
      expect(() => {
        asignarRol(admin, usuario, Rol.GESTOR);
      }).toThrow('Solo un Super Admin puede asignar roles');
    });

    test('super admin NO puede asignar SUPER_ADMIN a otros', () => {
      const usuario: UsuarioRBAC = {
        id: 'user2',
        email: 'user2@example.com',
        roles: [Rol.USUARIO],
      };
      
      expect(() => {
        asignarRol(superAdmin, usuario, Rol.SUPER_ADMIN);
      }).toThrow('No puedes asignar el rol de Super Admin a otros usuarios');
    });
  });

  describe('permisos adicionales y revocados', () => {
    test('permisosAdicionales deben agregarse', () => {
      const usuario: UsuarioRBAC = {
        id: 'user1',
        email: 'user@example.com',
        roles: [Rol.USUARIO],
        permisosAdicionales: [Permiso.CREAR_HITO],
      };
      
      const permisos = obtenerPermisosUsuario(usuario);
      expect(permisos).toContain(Permiso.CREAR_HITO);
    });

    test('permisosRevocados deben removerse', () => {
      const usuario: UsuarioRBAC = {
        id: 'admin1',
        email: 'admin@example.com',
        roles: [Rol.ADMIN],
        permisosRevocados: [Permiso.ELIMINAR_PROYECTO],
      };
      
      const permisos = obtenerPermisosUsuario(usuario);
      expect(permisos).not.toContain(Permiso.ELIMINAR_PROYECTO);
    });
  });
});
