/**
 * Input Validation Module - Injection Attack Prevention
 * Implementa validación exhaustiva usando Zod para prevenir:
 * - SQL Injection
 * - NoSQL Injection
 * - XSS (Cross-Site Scripting)
 * - Path Traversal
 * - Command Injection
 */

import { z } from 'zod';

// ========================
// VALIDACIONES BASE
// ========================

/**
 * Validador de ObjectId de Firebase/MongoDB
 */
const objectIdSchema = z.string().regex(
  /^[a-zA-Z0-9]{20,28}$/,
  'ID inválido: debe ser un ObjectId válido'
);

/**
 * Validador de email
 */
const emailSchema = z.string()
  .email('Email inválido')
  .max(100, 'Email demasiado largo (máx. 100 caracteres)')
  .transform(val => val.toLowerCase().trim());

/**
 * Validador de teléfono peruano
 */
const telefonoSchema = z.string()
  .regex(/^9\d{8}$/, 'Teléfono debe ser 9 dígitos comenzando con 9')
  .length(9, 'Teléfono debe tener exactamente 9 dígitos');

/**
 * Validador de montos monetarios (positivos, máx 2 decimales)
 */
const montoSchema = z.number()
  .positive('El monto debe ser positivo')
  .max(100000000, 'Monto excede el límite máximo (S/ 100M)')
  .multipleOf(0.01, 'El monto debe tener máximo 2 decimales');

/**
 * Validador de porcentaje (0-100)
 */
const porcentajeSchema = z.number()
  .min(0, 'Porcentaje no puede ser negativo')
  .max(100, 'Porcentaje no puede exceder 100')
  .multipleOf(0.01, 'Porcentaje debe tener máximo 2 decimales');

/**
 * Validador de texto sanitizado (previene XSS)
 */
const textoSanitizadoSchema = z.string()
  .trim()
  .transform(val => {
    // Remover caracteres peligrosos para XSS
    return val.replace(/[<>\"\']/g, '');
  });

/**
 * Validador de URL segura
 */
const urlSchema = z.string()
  .url('URL inválida')
  .refine(
    (url) => {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    },
    'Solo se permiten protocolos HTTP/HTTPS'
  );

// ========================
// SCHEMAS DE AUTENTICACIÓN
// ========================

/**
 * Validación para registro de usuario
 */
export const registroUsuarioSchema = z.object({
  nombre: z.string()
    .min(2, 'Nombre debe tener mínimo 2 caracteres')
    .max(100, 'Nombre muy largo (máx. 100 caracteres)')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Nombre solo puede contener letras'),
  email: emailSchema,
  password: z.string()
    .min(8, 'Contraseña debe tener mínimo 8 caracteres')
    .max(128, 'Contraseña muy larga (máx. 128 caracteres)')
    .regex(/[A-Z]/, 'Contraseña debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Contraseña debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Contraseña debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Contraseña debe contener al menos un carácter especial'),
  telefono: telefonoSchema.optional(),
  aceptaTerminos: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones'
  })
});

/**
 * Validación para login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Contraseña requerida')
});

// ========================
// SCHEMAS DE PROYECTOS BIFÁSICOS
// ========================

/**
 * Validación para crear proyecto bifásico
 */
export const crearProyectoBifasicoSchema = z.object({
  nombre: z.string()
    .min(5, 'Nombre del proyecto debe tener mínimo 5 caracteres')
    .max(200, 'Nombre muy largo (máx. 200 caracteres)'),
  descripcion: z.string()
    .min(50, 'Descripción debe tener mínimo 50 caracteres')
    .max(5000, 'Descripción muy larga (máx. 5000 caracteres)'),
  ubicacion: z.object({
    direccion: z.string().min(10, 'Dirección muy corta').max(300),
    distrito: z.string().min(2).max(100),
    provincia: z.string().min(2).max(100),
    departamento: z.string().min(2).max(100),
    coordenadas: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180)
    }).optional()
  }),
  categoria: z.enum(['casa', 'departamento', 'local_comercial', 'terreno', 'mixto']),
  
  // Etapa Tierra
  etapaTierra: z.object({
    montoObjetivo: montoSchema,
    numeroSociosObjetivo: z.number().int().min(1).max(20, 'Máximo 20 socios en etapa tierra'),
    valorTerreno: montoSchema,
    tasacionInicial: montoSchema.optional(),
    documentosTerreno: z.array(z.string()).optional()
  }),
  
  // Etapa Construcción
  etapaConstruccion: z.object({
    montoObjetivo: montoSchema,
    numeroSociosObjetivo: z.number().int().min(1).max(10, 'Máximo 10 socios en etapa construcción'),
    valorConstruccion: montoSchema,
    duracionEstimadaMeses: z.number().int().min(1).max(60),
    hitos: z.array(z.object({
      nombre: z.string().min(5).max(200),
      descripcion: z.string().max(1000),
      porcentajeAvance: porcentajeSchema
    })).optional()
  }),
  
  // Aporte de Suelo
  aporteSuelo: z.object({
    valorTierra: montoSchema,
    valorConstruccion: montoSchema,
    porcentajeTierra: porcentajeSchema,
    porcentajeCapital: porcentajeSchema
  }).refine(
    data => Math.abs((data.porcentajeTierra + data.porcentajeCapital) - 100) < 0.01,
    'Los porcentajes de tierra y capital deben sumar 100%'
  ),
  
  imagenes: z.array(urlSchema).min(1, 'Debe incluir al menos 1 imagen').max(20),
  documentosLegales: z.array(z.string()).optional()
});

/**
 * Validación para registrar inversión
 */
export const registrarInversionSchema = z.object({
  proyectoId: objectIdSchema,
  usuarioId: objectIdSchema,
  etapa: z.enum(['tierra', 'construccion']),
  numeroCubos: z.number()
    .int('Número de cubos debe ser entero')
    .min(1, 'Mínimo 1 cubo')
    .max(100, 'Máximo 100 cubos por transacción'),
  montoTotal: montoSchema,
  metodoPago: z.enum(['wallet_odoo', 'transferencia', 'yape']),
  
  // Datos adicionales según método de pago
  datosPago: z.object({
    // Para wallet Odoo
    walletAccountId: z.string().optional(),
    
    // Para transferencias
    bancoOrigen: z.string().max(100).optional(),
    numeroCuenta: z.string().max(50).optional(),
    numeroOperacion: z.string().max(50).optional(),
    
    // Para Yape
    numeroYape: telefonoSchema.optional(),
    
    comprobanteUrl: urlSchema.optional()
  }).optional(),
  
  aceptaContrato: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar el contrato de mutuo dinerario'
  })
});

/**
 * Validación para aprobar inversión (solo admin)
 */
export const aprobarInversionSchema = z.object({
  inversionId: objectIdSchema,
  aprobadoPor: objectIdSchema,
  comentarios: z.string().max(1000).optional(),
  transaccionOdooId: z.string().optional()
});

// ========================
// SCHEMAS DE DOCUMENTOS
// ========================

/**
 * Validación para subir documento legal
 */
export const subirDocumentoSchema = z.object({
  proyectoId: objectIdSchema,
  tipo: z.enum([
    'escritura_publica',
    'contrato_compraventa',
    'licencia_construccion',
    'planos_arquitectonicos',
    'estudio_suelos',
    'certificado_parametros',
    'memoria_descriptiva',
    'cronograma_obra',
    'presupuesto_detallado',
    'otro'
  ]),
  nombre: z.string().min(5).max(200),
  descripcion: z.string().max(1000).optional(),
  version: z.string().regex(/^\d+\.\d+$/, 'Versión debe ser formato X.Y (ej: 1.0)'),
  confidencial: z.boolean().default(false),
  visiblePara: z.enum(['todos', 'socios', 'admin']).default('socios')
});

// ========================
// SCHEMAS DE SOCIOS
// ========================

/**
 * Validación para crear/actualizar socio
 */
export const socioSchema = z.object({
  usuarioId: objectIdSchema,
  proyectoId: objectIdSchema,
  tipo: z.enum(['tierra', 'capital', 'mixto']),
  inversionesTierra: z.array(objectIdSchema).default([]),
  inversionesCapital: z.array(objectIdSchema).default([]),
  montoTotalInvertido: montoSchema,
  porcentajeParticipacion: porcentajeSchema,
  estado: z.enum(['activo', 'inactivo', 'retirado']).default('activo'),
  
  // ROI
  roiEsperado: porcentajeSchema,
  roiReal: porcentajeSchema.optional(),
  gananciaTotal: montoSchema.optional()
});

// ========================
// SCHEMAS DE HITOS
// ========================

/**
 * Validación para crear hito de construcción
 */
export const crearHitoSchema = z.object({
  proyectoId: objectIdSchema,
  tipo: z.enum([
    'COMPRA_TERRENO',
    'EXCAVACION',
    'CIMENTACION',
    'ESTRUCTURA',
    'MUROS',
    'INSTALACIONES',
    'ACABADOS',
    'EXTERIORES',
    'ENTREGA'
  ]),
  nombre: z.string().min(5).max(200),
  descripcion: z.string().min(20).max(2000),
  fechaInicio: z.string().datetime('Fecha de inicio inválida'),
  fechaFinEstimada: z.string().datetime('Fecha fin estimada inválida'),
  porcentajeAvance: porcentajeSchema.default(0),
  montoAsignado: montoSchema,
  responsable: z.string().min(3).max(100),
  documentosAdjuntos: z.array(objectIdSchema).default([]),
  fotosProgreso: z.array(urlSchema).max(50).default([])
});

/**
 * Validación para actualizar progreso de hito
 */
export const actualizarHitoSchema = z.object({
  hitoId: objectIdSchema,
  porcentajeAvance: porcentajeSchema,
  estado: z.enum(['pendiente', 'en_progreso', 'completado', 'pausado', 'cancelado']),
  comentarios: z.string().max(2000).optional(),
  fotosNuevas: z.array(urlSchema).max(20).optional()
});

// ========================
// SCHEMAS DE TRANSACCIONES
// ========================

/**
 * Validación para transferencia entre usuarios
 */
export const transferenciaSchema = z.object({
  origenId: objectIdSchema,
  destinoId: objectIdSchema,
  monto: montoSchema.refine(val => val >= 10, {
    message: 'Monto mínimo de transferencia: S/ 10'
  }),
  concepto: z.string().min(5, 'Concepto muy corto').max(500),
  pin: z.string().regex(/^\d{4}$/, 'PIN debe ser 4 dígitos')
}).refine(
  data => data.origenId !== data.destinoId,
  'No puedes transferir a tu propia cuenta'
);

/**
 * Validación para distribución de ganancias
 */
export const distribuirGananciasSchema = z.object({
  proyectoId: objectIdSchema,
  precioVenta: montoSchema,
  gastosAdicionales: montoSchema.default(0),
  impuestos: montoSchema.default(0),
  distribuirPor: objectIdSchema, // Admin que ejecuta distribución
  notificarSocios: z.boolean().default(true)
});

// ========================
// FUNCIONES DE VALIDACIÓN HELPER
// ========================

/**
 * Valida y sanitiza datos usando un schema de Zod
 * @returns Datos validados o lanza ZodError
 */
export function validarDatos<T>(schema: z.ZodSchema<T>, datos: unknown): T {
  return schema.parse(datos);
}

/**
 * Valida datos pero retorna objeto con success/error en lugar de throw
 */
export function validarDatosSafe<T>(
  schema: z.ZodSchema<T>, 
  datos: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(datos);
  return result as any;
}

/**
 * Formatea errores de Zod para respuestas API amigables
 */
export function formatearErroresValidacion(error: z.ZodError): {
  campo: string;
  mensaje: string;
}[] {
  return error.errors.map(err => ({
    campo: err.path.join('.'),
    mensaje: err.message
  }));
}

/**
 * Sanitiza texto para prevenir XSS
 */
export function sanitizarTexto(texto: string): string {
  return texto
    .trim()
    .replace(/[<>\"\']/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

/**
 * Valida que un archivo sea seguro (nombre y tipo)
 */
export const archivoSeguroSchema = z.object({
  nombre: z.string()
    .max(255, 'Nombre de archivo muy largo')
    .refine(
      nombre => !nombre.includes('..'),
      'Nombre de archivo no puede contener ".." (path traversal)'
    )
    .refine(
      nombre => !/[<>:"|?*\x00-\x1f]/g.test(nombre),
      'Nombre de archivo contiene caracteres inválidos'
    ),
  tipo: z.enum([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
  ], {
    errorMap: () => ({ message: 'Tipo de archivo no permitido' })
  }),
  tamaño: z.number()
    .max(10 * 1024 * 1024, 'Archivo muy grande (máx. 10MB)')
});

/**
 * Exportar todos los schemas para uso externo
 */
export const schemas = {
  // Auth
  registroUsuario: registroUsuarioSchema,
  login: loginSchema,
  
  // Proyectos
  crearProyectoBifasico: crearProyectoBifasicoSchema,
  registrarInversion: registrarInversionSchema,
  aprobarInversion: aprobarInversionSchema,
  
  // Documentos
  subirDocumento: subirDocumentoSchema,
  archivoSeguro: archivoSeguroSchema,
  
  // Socios
  socio: socioSchema,
  
  // Hitos
  crearHito: crearHitoSchema,
  actualizarHito: actualizarHitoSchema,
  
  // Transacciones
  transferencia: transferenciaSchema,
  distribuirGanancias: distribuirGananciasSchema
};
