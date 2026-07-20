/**
 * Unit Tests - Schemas de Zod centralizados (lib/schemas.ts) y los
 * wrappers de Validacion/*.ts que los usan.
 */

import validarCrearCuenta from '@/Validacion/validarCrearCuenta';
import validarIniciarSesion from '@/Validacion/validarIniciarSesion';
import validarCrearUsuarioBilletera from '@/Validacion/validarCrearUsuarioBilletera';
import validarRecargarBilletera from '@/Validacion/validarRecargarBilletera';
import validarCrearProducto from '@/Validacion/validarCrearProducto';

describe('validarCrearCuenta', () => {
  const valido = {
    nombre: 'Juan Pérez',
    email: 'juan@example.com',
    password: 'secreto123',
    telefono: '987654321',
    department: 'Lima',
    province: 'Lima',
    district: 'Miraflores',
  };

  test('no reporta errores con datos válidos', () => {
    expect(validarCrearCuenta(valido)).toEqual({});
  });

  test('reporta todos los campos obligatorios vacíos', () => {
    const errores = validarCrearCuenta({});
    expect(errores.nombre).toBeTruthy();
    expect(errores.email).toBeTruthy();
    expect(errores.password).toBeTruthy();
    expect(errores.telefono).toBeTruthy();
    // Las claves de error son en español aunque el input HTML use
    // department/province/district — el mapeo se preserva.
    expect(errores.departamento).toBeTruthy();
    expect(errores.provincia).toBeTruthy();
    expect(errores.distrito).toBeTruthy();
    expect(errores.department).toBeUndefined();
  });

  test('rechaza email mal formado', () => {
    const errores = validarCrearCuenta({ ...valido, email: 'no-es-un-email' });
    expect(errores.email).toBe('Email no válido');
  });

  test('rechaza teléfono que no empieza con 9', () => {
    const errores = validarCrearCuenta({ ...valido, telefono: '812345678' });
    expect(errores.telefono).toContain('9');
  });

  test('rechaza password menor a 6 caracteres', () => {
    const errores = validarCrearCuenta({ ...valido, password: '123' });
    expect(errores.password).toBeTruthy();
  });
});

describe('validarIniciarSesion', () => {
  test('no reporta errores con datos válidos', () => {
    expect(validarIniciarSesion({ email: 'a@b.com', password: '123456' })).toEqual({});
  });

  test('reporta email y password faltantes', () => {
    const errores = validarIniciarSesion({});
    expect(errores.email).toBeTruthy();
    expect(errores.password).toBeTruthy();
  });
});

describe('validarCrearUsuarioBilletera', () => {
  test('no exige nombre/email (comportamiento original preservado)', () => {
    const errores = validarCrearUsuarioBilletera({
      apellido: 'Pérez',
      password: '123456',
      telefono: '987654321',
    });
    expect(errores).toEqual({});
  });

  test('exige apellido, password y teléfono', () => {
    const errores = validarCrearUsuarioBilletera({});
    expect(errores.apellido).toBeTruthy();
    expect(errores.password).toBeTruthy();
    expect(errores.telefono).toBeTruthy();
  });
});

describe('validarRecargarBilletera', () => {
  test('no reporta errores con monto y password válidos', () => {
    expect(validarRecargarBilletera({ monto: 100, password: '123456' })).toEqual({});
  });

  test('rechaza monto 0 (falsy, igual que el validador original)', () => {
    const errores = validarRecargarBilletera({ monto: 0, password: '123456' });
    expect(errores.monto).toBeTruthy();
  });

  test('rechaza monto faltante', () => {
    const errores = validarRecargarBilletera({ password: '123456' });
    expect(errores.monto).toBeTruthy();
  });
});

describe('validarCrearProducto', () => {
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const valido = {
    nombre: 'Proyecto X',
    empresa: 'Terra Lima',
    url: 'https://example.com/producto',
    descripcion: 'Un proyecto de inversión',
    categoria: 'inmobiliario',
    precio: 100000,
    fechaLimite: manana,
  };

  test('no reporta errores con datos válidos', () => {
    expect(validarCrearProducto(valido)).toEqual({});
  });

  test('rechaza una fechaLimite en el pasado', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const errores = validarCrearProducto({ ...valido, fechaLimite: ayer });
    expect(errores.fechaLimite).toBe('La fecha límite debe ser en el futuro');
  });

  test('rechaza una url mal formada', () => {
    const errores = validarCrearProducto({ ...valido, url: 'no-es-una-url' });
    expect(errores.url).toBeTruthy();
  });

  test('rechaza precio faltante', () => {
    const errores = validarCrearProducto({ ...valido, precio: undefined });
    expect(errores.precio).toBeTruthy();
  });
});
