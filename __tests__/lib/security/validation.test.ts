/**
 * Unit Tests - Validation Module (Zod)
 * Tests para validación de inputs
 */

import {
  validarDatos,
  validarDatosSafe,
  schemas,
  sanitizarTexto,
} from '@/lib/security/validation';

describe('Validation Module', () => {
  describe('registroUsuarioSchema', () => {
    test('debe validar correctamente datos válidos', () => {
      const datosValidos = {
        nombre: 'Juan Pérez',
        email: 'juan@example.com',
        password: 'SecurePass123!',
        telefono: '987654321',
        aceptaTerminos: true,
      };
      
      const resultado = validarDatos(schemas.registroUsuario, datosValidos);
      
      expect(resultado.nombre).toBe('Juan Pérez');
      expect(resultado.email).toBe('juan@example.com');
    });

    test('debe rechazar email inválido', () => {
      const datosInvalidos = {
        nombre: 'Juan',
        email: 'not-an-email',
        password: 'SecurePass123!',
        aceptaTerminos: true,
      };
      
      expect(() => {
        validarDatos(schemas.registroUsuario, datosInvalidos);
      }).toThrow('Email inválido');
    });

    test('debe rechazar contraseña débil', () => {
      const datosInvalidos = {
        nombre: 'Juan',
        email: 'juan@example.com',
        password: '12345',
        aceptaTerminos: true,
      };
      
      expect(() => {
        validarDatos(schemas.registroUsuario, datosInvalidos);
      }).toThrow();
    });

    test('debe rechazar si no acepta términos', () => {
      const datosInvalidos = {
        nombre: 'Juan',
        email: 'juan@example.com',
        password: 'SecurePass123!',
        aceptaTerminos: false,
      };
      
      expect(() => {
        validarDatos(schemas.registroUsuario, datosInvalidos);
      }).toThrow('términos y condiciones');
    });

    test('debe normalizar email a minúsculas', () => {
      const datos = {
        nombre: 'Juan',
        email: 'JUAN@EXAMPLE.COM',
        password: 'SecurePass123!',
        aceptaTerminos: true,
      };
      
      const resultado = validarDatos(schemas.registroUsuario, datos);
      expect(resultado.email).toBe('juan@example.com');
    });
  });

  describe('registrarInversionSchema', () => {
    test('debe validar inversión correctamente', () => {
      const inversion = {
        proyectoId: 'abc123xyz456789',
        usuarioId: 'user123abc456789',
        etapa: 'tierra',
        numeroCubos: 5,
        montoTotal: 50000,
        metodoPago: 'wallet_odoo',
        aceptaContrato: true,
      };
      
      const resultado = validarDatos(schemas.registrarInversion, inversion);
      expect(resultado.numeroCubos).toBe(5);
      expect(resultado.montoTotal).toBe(50000);
    });

    test('debe rechazar número de cubos inválido', () => {
      const inversion = {
        proyectoId: 'abc123xyz',
        usuarioId: 'user123',
        etapa: 'tierra',
        numeroCubos: 150, // Máximo 100
        montoTotal: 50000,
        metodoPago: 'wallet_odoo',
        aceptaContrato: true,
      };
      
      expect(() => {
        validarDatos(schemas.registrarInversion, inversion);
      }).toThrow('Máximo 100 cubos');
    });

    test('debe rechazar monto negativo', () => {
      const inversion = {
        proyectoId: 'abc123xyz',
        usuarioId: 'user123',
        etapa: 'tierra',
        numeroCubos: 5,
        montoTotal: -5000,
        metodoPago: 'wallet_odoo',
        aceptaContrato: true,
      };
      
      expect(() => {
        validarDatos(schemas.registrarInversion, inversion);
      }).toThrow('positivo');
    });
  });

  describe('validarDatosSafe', () => {
    test('debe retornar success true con datos válidos', () => {
      const datos = {
        email: 'test@example.com',
        password: 'Password123!',
      };
      
      const resultado = validarDatosSafe(schemas.login, datos);
      
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.email).toBe('test@example.com');
      }
    });

    test('debe retornar success false con datos inválidos', () => {
      const datos = {
        email: 'not-an-email',
        password: 'pass',
      };
      
      const resultado = validarDatosSafe(schemas.login, datos);
      
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error).toBeDefined();
      }
    });
  });

  describe('sanitizarTexto', () => {
    test('debe remover caracteres peligrosos XSS', () => {
      const textoMalicioso = '<script>alert("XSS")</script>';
      const sanitizado = sanitizarTexto(textoMalicioso);
      
      expect(sanitizado).not.toContain('<');
      expect(sanitizado).not.toContain('>');
    });

    test('debe remover comillas peligrosas', () => {
      const texto = 'Texto con "comillas" y \'apostrofes\'';
      const sanitizado = sanitizarTexto(texto);
      
      expect(sanitizado).not.toContain('"');
      expect(sanitizado).not.toContain("'");
    });

    test('debe mantener texto normal', () => {
      const textoNormal = 'Este es un texto normal sin peligros';
      const sanitizado = sanitizarTexto(textoNormal);
      
      expect(sanitizado).toBe(textoNormal.trim());
    });
  });
});
