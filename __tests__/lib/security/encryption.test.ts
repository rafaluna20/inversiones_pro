/**
 * Unit Tests - Encryption Module
 * Tests para funciones de encriptación/desencriptación
 */

import {
  encriptar,
  desencriptar,
  encriptarObjeto,
  desencriptarObjeto,
  hash,
  hashConSalt,
  verificarHash,
  enmascararEmail,
  enmascararTelefono,
  enmascararDNI,
  enmascararMonto,
} from '@/lib/security/encryption';

describe('Encryption Module', () => {
  describe('encriptar / desencriptar', () => {
    test('debe encriptar y desencriptar correctamente', () => {
      const textoOriginal = 'Información sensible de inversión';
      
      const encriptado = encriptar(textoOriginal);
      expect(encriptado.data).toBeDefined();
      expect(encriptado.iv).toBeDefined();
      expect(encriptado.version).toBe(1);
      
      const desencriptado = desencriptar(encriptado);
      expect(desencriptado).toBe(textoOriginal);
    });

    test('debe generar diferentes IVs en cada encriptación', () => {
      const texto = 'Test';
      
      const enc1 = encriptar(texto);
      const enc2 = encriptar(texto);
      
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.data).not.toBe(enc2.data);
    });

    test('debe fallar al desencriptar con datos corruptos', () => {
      const encriptado = encriptar('Test');
      encriptado.data = 'datos-corruptos';
      
      expect(() => desencriptar(encriptado)).toThrow();
    });
  });

  describe('encriptarObjeto / desencriptarObjeto', () => {
    test('debe encriptar y desencriptar objetos complejos', () => {
      const objeto = {
        usuarioId: 'user123',
        montoInvertido: 50000,
        proyectoId: 'proj456',
        metadata: {
          fecha: new Date().toISOString(),
          tipo: 'tierra',
        },
      };
      
      const encriptado = encriptarObjeto(objeto);
      const desencriptado = desencriptarObjeto(encriptado);
      
      expect(desencriptado).toEqual(objeto);
    });

    test('debe manejar arrays correctamente', () => {
      const objeto = {
        inversiones: ['inv1', 'inv2', 'inv3'],
        montos: [10000, 20000, 30000],
      };
      
      const encriptado = encriptarObjeto(objeto);
      const desencriptado = desencriptarObjeto(encriptado);
      
      expect(desencriptado).toEqual(objeto);
    });
  });

  describe('hash functions', () => {
    test('debe generar hash consistente para mismo input', () => {
      const texto = 'mi-password-123';
      
      const hash1 = hash(texto);
      const hash2 = hash(texto);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    test('debe generar hashes diferentes para inputs diferentes', () => {
      const hash1 = hash('password1');
      const hash2 = hash('password2');
      
      expect(hash1).not.toBe(hash2);
    });

    test('hashConSalt debe generar hash diferente al simple', () => {
      const texto = 'password';
      
      const hashSimple = hash(texto);
      const hashSalted = hashConSalt(texto);
      
      expect(hashSimple).not.toBe(hashSalted);
    });

    test('verificarHash debe validar correctamente', () => {
      const password = 'mi-password-seguro';
      const hashGenerado = hash(password);
      
      expect(verificarHash(password, hashGenerado)).toBe(true);
      expect(verificarHash('password-incorrecto', hashGenerado)).toBe(false);
    });
  });

  describe('enmascaramiento de datos', () => {
    test('enmascararEmail debe ocultar parte del email', () => {
      expect(enmascararEmail('juan.perez@example.com')).toBe('j***z@e***e.com');
      expect(enmascararEmail('a@b.com')).toBe('***@***');
    });

    test('enmascararTelefono debe ocultar dígitos centrales', () => {
      expect(enmascararTelefono('987654321')).toBe('987***321');
      expect(enmascararTelefono('12345')).toBe('***');
    });

    test('enmascararDNI debe ocultar dígitos centrales', () => {
      expect(enmascararDNI('12345678')).toBe('123***78');
      expect(enmascararDNI('12345')).toBe('***');
    });

    test('enmascararMonto debe ocultar monto parcialmente', () => {
      expect(enmascararMonto(1500.50)).toBe('S/ 1**.**');
      expect(enmascararMonto(50.00)).toBe('S/ **.**');
    });
  });
});
