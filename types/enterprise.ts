/**
 * INTERFACES TYPESCRIPT EMPRESARIALES - MODELO BIFÁSICO
 * 
 * Sistema de Crowdfunding Inmobiliario con Aporte de Suelo
 * Versión: 2.0 Enterprise
 * Fecha: 09/02/2026
 */

// ============================================
// ENUMS Y TIPOS BASE
// ============================================

export enum EtapaProyectoEnum {
  TIERRA = 'tierra',
  CONSTRUCCION = 'construccion',
  FINALIZADO = 'finalizado'
}

export enum EstadoProyecto {
  CAPTACION = 'captacion',
  EN_PROGRESO = 'en_progreso',
  COMPLETADO = 'completado',
  CANCELADO = 'cancelado'
}

export enum TipoAporte {
  TIERRA = 'tierra',
  CAPITAL = 'capital',
  MIXTO = 'mixto'
}

export enum TipoHito {
  COMPRA_TERRENO = 'compra_terreno',
  PERMISOS_MUNICIPALES = 'permisos_municipales',
  LICENCIA_CONSTRUCCION = 'licencia_construccion',
  EXCAVACION = 'excavacion',
  CIMENTACION = 'cimentacion',
  ESTRUCTURA = 'estructura',
  ALBANILERIA = 'albanileria',
  ACABADOS = 'acabados',
  INSTALACIONES = 'instalaciones',
  ENTREGA_FINAL = 'entrega_final',
  OTROS = 'otros'
}

export enum EstadoHito {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  COMPLETADO = 'completado',
  BLOQUEADO = 'bloqueado'
}

export enum TipoDocumento {
  CONTRATO_COMPRAVENTA = 'contrato_compraventa',
  TITULO_PROPIEDAD = 'titulo_propiedad',
  LICENCIA_CONSTRUCCION = 'licencia_construccion',
  PLANOS_ARQUITECTONICOS = 'planos_arquitectonicos',
  CONTRATO_CONSTRUCCION = 'contrato_construccion',
  FACTURA = 'factura',
  RECIBO = 'recibo',
  ESCRITURA_PUBLICA = 'escritura_publica',
  PODER_NOTARIAL = 'poder_notarial',
  ESTATUTO_SOCIAL = 'estatuto_social',
  ACTA_ASAMBLEA = 'acta_asamblea',
  INFORME_TECNICO = 'informe_tecnico',
  OTROS = 'otros'
}

export enum TipoNotificacion {
  INVERSION_CONFIRMADA = 'inversion_confirmada',
  HITO_COMPLETADO = 'hito_completado',
  DOCUMENTO_SUBIDO = 'documento_subido',
  GANANCIA_DISTRIBUIDA = 'ganancia_distribuida',
  ETAPA_COMPLETADA = 'etapa_completada',
  COMENTARIO_NUEVO = 'comentario_nuevo',
  MENSAJE_ADMIN = 'mensaje_admin',
  ALERTA_SISTEMA = 'alerta_sistema'
}

// ============================================
// INTERFACES PRINCIPALES
// ============================================

/**
 * Etapa del Proyecto (Tierra o Construcción)
 * DEFINIDA PRIMERO para poder referenciarla en ProyectoBifasico
 */
export interface EtapaDetalle {
  id: string;
  proyectoId: string;
  tipo: TipoAporte;
  
  // Financiamiento
  montoObjetivo: number;
  montoRecaudado: number;
  numeroSociosObjetivo: number; // 10 para tierra, 5 para construcción
  numeroSociosActuales: number;
  
  // Sistema de Cubos por Etapa
  cubos: {
    totales: number; // Siempre 100
    vendidos: number;
    disponibles: number;
    precioPorCubo: number;
  };
  
  // Tasaciones
  tasacion: {
    inicial: number;
    actual: number;
    fechaTasacion: string | Date;
    plusvaliaPorcentaje?: number;
    plusvaliaMonto?: number;
  };
  
  // Plazos
  duracionMeses: number;
  fechaInicio?: string | Date;
  fechaFinEstimada?: string | Date;
  fechaCompletada?: string | Date;
  
  // Estados
  estaActiva: boolean;
  completada: boolean;
  
  // Metadata
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Proyecto Bifásico Completo
 * Representa un proyecto inmobiliario con dos etapas:
 * 1. Etapa Tierra (compra de terreno)
 * 2. Etapa Construcción (obra)
 */
export interface ProyectoBifasico {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  
  // Ubicación
  ubicacion: {
    direccion: string;
    departamento: string;
    provincia: string;
    distrito: string;
    coordenadas: {
      lat: number;
      lng: number;
    };
  };
  
  // Estados
  etapaActual: EtapaProyectoEnum;
  estado: EstadoProyecto;
  
  // Imágenes
  imagenPrincipal: string;
  galeriaImagenes: string[];
  
  // Etapas del Proyecto
  etapas: {
    tierra: EtapaDetalle;
    construccion: EtapaDetalle;
  };
  
  // Resumen Financiero
  resumenFinanciero: {
    totalObjetivo: number;
    totalRecaudado: number;
    porcentajeCompletado: number;
    totalInversores: number;
    inversionPromedio: number;
  };
  
  // Aporte de Suelo (Fórmula clave del negocio)
  aporteSuelo: {
    valorTierra: number;
    valorConstruccion: number;
    valorTotal: number;
    porcentajeTierra: number; // % que corresponde a socios tierra
    porcentajeCapital: number; // % que corresponde a socios capital
  };
  
  // Timeline y Progreso
  progreso: {
    progresoGeneral: number; // 0-100
    hitosCompletados: number;
    hitosTotales: number;
  };
  
  // Metadata
  creadorId: string;
  creadorNombre: string;
  fechaCreacion: string | Date;
  fechaActualizacion: string | Date;
  fechaInicioTierra?: string | Date;
  fechaInicioConstruccion?: string | Date;
  fechaFinalizacion?: string | Date;
  
  // SEO
  slug: string;
}


/**
 * Inversión Individual
 * Representa la inversión de un usuario en una etapa específica
 */
export interface Inversion {
  id: string;
  proyectoId: string;
  etapaId: string;
  
  // Usuario (Integración Odoo + Firebase)
  usuario: {
    firebaseUid: string;
    odooId?: number; // ID en Odoo wallet
    nombre: string;
    email: string;
    photoURL?: string;
  };
  
  // Detalles de Inversión
  tipoInversion: TipoAporte;
  montoInvertido: number;
  cubosComprados: number;
  porcentajeParticipacion: number; // % del proyecto total
  
  // Contrato Legal
  contrato: {
    numeroContrato: string;
    tipoContrato: string; // 'mutuo_dinerario', 'aporte_capital', etc.
    documentoUrl?: string; // Link a PDF en Supabase Storage
    fechaFirma?: string | Date;
  };
  
  // Integración con Odoo Wallet
  transaccionOdoo: {
    transaccionId?: number; // ID de wallet.transaction
    referencia?: string; // Reference code
    estado: 'pendiente' | 'procesando' | 'confirmada' | 'fallida';
  };
  
  // Rentabilidad
  rentabilidad: {
    roiProyectado: number; // % esperado
    gananciaEstimada: number;
    gananciaReal: number;
    roiReal?: number; // Calculado al finalizar
  };
  
  // Estados
  confirmada: boolean;
  fechaConfirmacion?: string | Date;
  
  // Fechas
  fechaInversion: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Socio del Proyecto
 * Representa a un inversionista en el pool de Tierra o Construcción
 */
export interface SocioProyecto {
  id: string;
  proyectoId: string;
  etapaId: string;
  usuarioFirebaseUid: string;
  
  // Tipo de Socio
  tipoSocio: TipoAporte;
  
  // Participación
  porcentajePropiedad: number;
  valorAportado: number;
  
  // Aporte de Suelo - Desglose
  valorTierraProporcional?: number; // Si es socio tierra
  valorCapitalProporcional?: number; // Si es socio capital
  
  // Derechos
  tieneDerechoVoto: boolean;
  tieneDerechoGanancia: boolean;
  
  // Metadata
  fechaIngreso: string | Date;
  fechaSalida?: string | Date;
  activo: boolean;
}

/**
 * Hito de Construcción
 * Representa un milestone en el timeline del proyecto
 */
export interface HitoProyecto {
  id: string;
  proyectoId: string;
  etapaId: string;
  
  // Información
  tipo: TipoHito;
  titulo: string;
  descripcion: string;
  orden: number; // Orden en timeline
  
  // Estados
  estado: EstadoHito;
  progresoPorcentaje: number; // 0-100
  
  // Fechas
  fechaEstimada?: string | Date;
  fechaInicio?: string | Date;
  fechaCompletado?: string | Date;
  
  // Evidencia Visual
  evidencia: {
    fotosAntes: string[];
    fotosDurante: string[];
    fotosDespues: string[];
    documentosAdjuntos: string[];
  };
  
  // Responsable
  responsable?: {
    nombre: string;
    empresa: string;
    telefono?: string;
    email?: string;
  };
  
  // Costos
  costoEstimado?: number;
  costoReal?: number;
  
  // Metadata
  creadoPor: string; // Firebase UID
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Documento Legal (Caja Fuerte)
 */
export interface DocumentoProyecto {
  id: string;
  proyectoId: string;
  
  // Clasificación
  tipo: TipoDocumento;
  titulo: string;
  descripcion?: string;
  
  // Archivo
  archivo: {
    url: string; // Supabase Storage URL
    nombre: string;
    tamano: number; // bytes
    tipoMime: string;
    hash: string; // SHA256 para verificación
  };
  
  // Seguridad
  esConfidencial: boolean;
  requiereAutorizacion: boolean;
  usuariosAutorizados: string[]; // Firebase UIDs
  
  // Versionado
  version: number;
  esVersionActual: boolean;
  documentoPadreId?: string;
  
  // Metadata
  subidoPor: string; // Firebase UID
  fechaDocumento?: string | Date; // Fecha del documento legal
  fechaSubida: string | Date;
  fechaActualizacion: string | Date;
  tags: string[];
}

/**
 * Valuación/Tasación
 */
export interface Valuacion {
  id: string;
  proyectoId: string;
  
  // Tipo
  tipo: 'inicial' | 'actualizacion' | 'final';
  
  // Valores
  valorTierra: number;
  valorConstruccion: number;
  valorTotal: number;
  
  // Plusvalía
  plusvaliaPorcentaje?: number;
  plusvaliaMonto?: number;
  
  // Tasador
  tasador: {
    empresaTasadora: string;
    peritoNombre: string;
    peritoRegistro: string;
  };
  
  // Documentación
  informeUrl?: string;
  certificadoUrl?: string;
  
  // Metadata
  fechaTasacion: string | Date;
  vigenciaHasta?: string | Date;
  createdAt: string | Date;
}

/**
 * Notificación
 */
export interface Notificacion {
  id: string;
  usuarioFirebaseUid: string;
  
  // Contenido
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  icono?: string;
  
  // Referencias
  proyectoId?: string;
  inversionId?: string;
  
  // Estados
  leida: boolean;
  fechaLectura?: string | Date;
  
  // Metadata adicional
  metadata?: Record<string, any>;
  createdAt: string | Date;
}

/**
 * Métricas del Proyecto
 */
export interface MetricasProyecto {
  id: string;
  proyectoId: string;
  fecha: string | Date;
  
  // Métricas Financieras
  financieras: {
    totalRecaudado: number;
    numeroInversores: number;
    inversionPromedio: number;
    inversionMinima: number;
    inversionMaxima: number;
  };
  
  // Engagement
  engagement: {
    vistas: number;
    likes: number;
    compartidos: number;
    comentarios: number;
    tasa_conversion: number; // % vistas que invierten
  };
  
  // Progreso Construcción
  construccion: {
    progresoPorcentaje: number;
    hitosCompletados: number;
    hitosTotales: number;
    diasTranscurridos: number;
    diasEstimadosRestantes: number;
  };
  
  createdAt: string | Date;
}

// ============================================
// INTERFACES DE DASHBOARDS
// ============================================

/**
 * Dashboard del Socio Inversor
 */
export interface DashboardSocio {
  usuario: {
    uid: string;
    nombre: string;
    email: string;
    photoURL?: string;
  };
  
  // Resumen General
  resumen: {
    totalInvertido: number;
    numeroProyectos: number;
    proyectosActivos: number;
    proyectosCompletados: number;
    gananciaTotal: number;
    roiPromedio: number;
  };
  
  // Mis Inversiones
  misInversiones: Inversion[];
  
  // Proyectos en los que participo
  misProyectos: ProyectoBifasico[];
  
  // Notificaciones recientes
  notificacionesRecientes: Notificacion[];
  
  // Gráficas
  graficas: {
    evolucionCartera: {
      fecha: string;
      valorTotal: number;
      ganancia: number;
    }[];
    distribucionPorTipo: {
      tipo: TipoAporte;
      cantidad: number;
      porcentaje: number;
    }[];
    roiPorProyecto: {
      proyectoNombre: string;
      roiProyectado: number;
      roiReal?: number;
    }[];
  };
}

/**
 * Dashboard del Administrador/Gestor
 */
export interface DashboardAdmin {
  // Resumen General
  resumen: {
    totalProyectos: number;
    proyectosActivos: number;
    capitalTotalRecaudado: number;
    numeroInversoresUnicos: number;
    inversionPromedio: number;
  };
  
  // Proyectos Administrados
  proyectos: ProyectoBifasico[];
  
  // Inversiones Pendientes de Validar
  inversionesPendientes: Inversion[];
  
  // Hitos Próximos
  hitosProximos: HitoProyecto[];
  
  // Documentos Recientes
  documentosRecientes: DocumentoProyecto[];
  
  // Métricas de Performance
  metricas: {
    tasaExito: number; // % proyectos completados
    tiempoPromedioRecaudacion: number; // días
    satisfaccionInversores: number; // rating promedio
  };
  
  // Alertas del Sistema
  alertas: {
    tipo: 'error' | 'warning' | 'info';
    mensaje: string;
    proyectoId?: string;
    timestamp: string | Date;
  }[];
}

// ============================================
// INTERFACES DE FORMULARIOS
// ============================================

/**
 * Form para crear Proyecto Bifásico
 */
export interface ProyectoBifasicoForm {
  // Información Básica
  nombre: string;
  descripcion: string;
  categoria: string;
  
  // Ubicación
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
  
  // Etapa Tierra
  etapaTierra: {
    montoObjetivo: number;
    numeroSocios: number; // Default 10
    duracionMeses: number;
    tasacionInicial: number;
  };
  
  // Etapa Construcción
  etapaConstruccion: {
    montoObjetivo: number;
    numeroSocios: number; // Default 5
    duracionMeses: number;
    costoObraEstimado: number;
  };
  
  // Imágenes
  imagenPrincipal: File | string;
  galeriaImagenes: (File | string)[];
  
  // Documentos iniciales
  documentosIniciales?: {
    tipo: TipoDocumento;
    archivo: File;
  }[];
}

/**
 * Form para Invertir
 */
export interface InversionForm {
  proyectoId: string;
  etapaId: string;
  tipoInversion: TipoAporte;
  
  // Monto
  cubosDeseados: number;
  montoTotal: number;
  
  // Método de Pago (Integración Odoo)
  metodoPago: 'wallet' | 'transferencia' | 'yape' | 'plin';
  
  // Aceptación Términos
  aceptaTerminos: boolean;
  aceptaContrato: boolean;
  
  // Datos adicionales
  notas?: string;
}

/**
 * Form para actualizar Hito
 */
export interface HitoForm {
  titulo: string;
  descripcion: string;
  tipo: TipoHito;
  fechaEstimada?: string | Date;
  
  // Evidencia
  fotosAntes?: File[];
  fotosDurante?: File[];
  fotosDespues?: File[];
  
  // Responsable
  responsableNombre?: string;
  responsableEmpresa?: string;
  
  // Costos
  costoEstimado?: number;
  costoReal?: number;
  
  // Estado
  estado: EstadoHito;
  progresoPorcentaje: number;
}

// ============================================
// UTILIDADES Y HELPERS
// ============================================

/**
 * Cálculo del Aporte de Suelo
 * Fórmula principal del modelo de negocio
 */
export interface CalculoAporteSuelo {
  valorTierra: number;
  valorConstruccion: number;
  valorTotal: number;
  porcentajeTierra: number;
  porcentajeCapital: number;
  
  // Distribución ejemplo para socio específico
  distribuccionSocio?: {
    montoInvertido: number;
    tipoSocio: TipoAporte;
    porcentajeProyecto: number;
    gananciaPotencial: number;
  };
}

/**
 * Estado de Sincronización con Odoo
 */
export interface EstadoSincronizacionOdoo {
  ultimaSincronizacion: string | Date;
  sincronizacionExitosa: boolean;
  transaccionesPendientes: number;
  errores?: {
    timestamp: string | Date;
    mensaje: string;
    transaccionId?: string;
  }[];
}

/**
 * Respuesta de API
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * Paginación
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// VALIDACIONES
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
}
