// Tipos de Usuario
export interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  photoURL: string | null;
  saldo: number;
  like: number;
  phone: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ganancia: number;
  inversionesCompletadas: number;
  votantes: string[];
  saldoRecaudado: number[];
  createdAt?: number;
  updatedAt?: number;
}

// Tipos de Producto
export type CategoriaProducto =
  | 'departamento'
  | 'terreno'
  | 'casa'
  | 'oficina'
  | 'localComercial'
  | 'habilitacionUrbana';

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface Creador {
  id: string;
  nombre: string;
  verified?: boolean;
}

export interface Comentario {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  mensaje: string;
  createdAt: number;
}

export interface Producto {
  id: string;
  nombre: string;
  empresa: string;
  url: string;
  urlimagen: string | string[];
  descripcion: string;
  votos: string[] | number;
  comentarios: Comentario[];
  creado: number | { toDate: () => Date };
  creador: Creador;
  haVotado: string[];
  categoria: CategoriaProducto;
  /**
   * @deprecated Use etapas.tierra.montoObjetivo para proyectos bifásicos
   */
  precio: number | string;
  /**
   * @deprecated Use `coordenadas` instead. Mantener por compatibilidad.
   */
  cordenadas?: Coordenadas;
  coordenadas?: Coordenadas;
  /**
   * @deprecated Use colección 'socios' para proyectos bifásicos
   */
  inversores: string[];
  estado: boolean;
  /**
   * @deprecated Use etapas.tierra.montoRecaudado + etapas.construccion.montoRecaudado
   */
  monto: number;
  depositoRecaudado: boolean;
  direccion?: string;
  
  // ⭐ CAMPOS NUEVOS PARA MODELO BIFÁSICO
  modeloBifasico?: boolean;  // true = proyecto bifásico, false/undefined = cubos simples
  etapaActual?: 'tierra' | 'construccion' | 'finalizado';
  estadoProyecto?: 'captacion' | 'en_progreso' | 'completado' | 'cancelado';
  
  etapas?: {
    tierra: EtapaProyecto;
    construccion: EtapaProyecto;
  };
  
  aporteSuelo?: {
    valorTierra: number;
    valorConstruccion: number;
    valorTotal: number;
    porcentajeTierra: number;
    porcentajeCapital: number;
  };
  
  progresoConstruccion?: number;  // 0-100
  fechaInicioTierra?: number;
  fechaInicioConstruccion?: number;
  fechaFinalizacion?: number;
  updatedAt?: number;
}

// Etapa del Proyecto (Tierra o Construcción)
export interface EtapaProyecto {
  montoObjetivo: number;
  montoRecaudado: number;
  numeroSociosObjetivo: number;
  numeroSociosActuales: number;
  cubos: {
    totales: number;  // Siempre 100
    vendidos: number;
    disponibles: number;
    precioPorCubo: number;
  };
  tasacion?: {
    inicial: number;
    actual: number;
    fechaTasacion: number;
    plusvaliaPorcentaje?: number;
  };
  costoObraEstimado?: number;  // Solo para construcción
  duracionMeses: number;
  fechaInicio?: number;
  fechaFinEstimada?: number;
  fechaCompletada?: number;
  completada: boolean;
  activa: boolean;
}

// Tipos de Transacción
export type TipoTransaccion =
  | 'recarga'
  | 'retiro'
  | 'inversion'
  | 'ganancia'
  | 'transferencia';

export type EstadoTransaccion =
  | 'pendiente'
  | 'completada'
  | 'fallida';

export interface Transaccion {
  id: string;
  usuarioId: string;
  tipo: TipoTransaccion;
  monto: number;
  fecha: number;
  estado: EstadoTransaccion;
  descripcion?: string;
  metadata?: Record<string, any>;
}

// Tipos de Formularios
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  department: string;
  province: string;
  district: string;
  imagen?: File | null;
}

export interface ProductoForm {
  nombre: string;
  empresa: string;
  url: string;
  descripcion: string;
  categoria: CategoriaProducto | '';
  precio: string | number;
}

// ============================================
// NUEVAS INTERFACES PARA MODELO BIFÁSICO
// ============================================

// Inversión en proyecto bifásico
export interface Inversion {
  id: string;
  proyectoId: string;
  usuarioId: string;
  
  tipoInversion: 'tierra' | 'capital' | 'mixto';
  etapa: 'tierra' | 'construccion';
  
  montoInvertido: number;
  cubosComprados: number;
  porcentajeParticipacion: number;
  
  contrato: {
    numeroContrato: string;
    tipoContrato: string;
    documentoUrl?: string;
    fechaFirma?: number;
  };
  
  transaccionOdoo: {
    transaccionId?: number;
    referencia?: string;
    estado: 'pendiente' | 'procesando' | 'confirmada' | 'fallida';
  };
  
  roiProyectado: number;
  gananciaEstimada: number;
  gananciaReal: number;
  roiReal?: number;
  
  confirmada: boolean;
  fechaConfirmacion?: number;
  fechaInversion: number;
  createdAt: number;
  updatedAt: number;
}

// Socio del Proyecto
export interface Socio {
  id: string;
  proyectoId: string;
  usuarioId: string;
  
  tipoSocio: 'tierra' | 'capital' | 'mixto';
  porcentajePropiedad: number;
  valorAportado: number;
  valorTierraProporcional?: number;
  valorCapitalProporcional?: number;
  
  tieneDerechoVoto: boolean;
  tieneDerechoGanancia: boolean;
  
  fechaIngreso: number;
  fechaSalida?: number;
  activo: boolean;
  createdAt: number;
}

// Hito de Construcción
export type TipoHito =
  | 'compra_terreno'
  | 'permisos_municipales'
  | 'licencia_construccion'
  | 'excavacion'
  | 'cimentacion'
  | 'estructura'
  | 'albanileria'
  | 'acabados'
  | 'instalaciones'
  | 'entrega_final'
  | 'otros';

export type EstadoHito =
  | 'pendiente'
  | 'en_progreso'
  | 'completado'
  | 'bloqueado';

export interface Hito {
  id: string;
  proyectoId: string;
  etapa: 'tierra' | 'construccion';
  
  tipo: TipoHito;
  titulo: string;
  descripcion: string;
  orden: number;
  
  estado: EstadoHito;
  progresoPorcentaje: number;
  
  fechaEstimada?: number;
  fechaInicio?: number;
  fechaCompletado?: number;
  
  evidencia: {
    fotosAntes: string[];
    fotosDurante: string[];
    fotosDespues: string[];
    documentosAdjuntos: string[];
  };
  
  responsable?: {
    nombre: string;
    empresa: string;
  };
  
  costoEstimado?: number;
  costoReal?: number;
  
  creadoPor: string;
  createdAt: number;
  updatedAt: number;
}

// Documento Legal
export type TipoDocumento =
  | 'contrato_compraventa'
  | 'titulo_propiedad'
  | 'licencia_construccion'
  | 'planos_arquitectonicos'
  | 'contrato_construccion'
  | 'factura'
  | 'recibo'
  | 'escritura_publica'
  | 'poder_notarial'
  | 'estatuto_social'
  | 'acta_asamblea'
  | 'informe_tecnico'
  | 'otros';

export interface Documento {
  id: string;
  proyectoId: string;
  
  tipo: TipoDocumento;
  titulo: string;
  descripcion?: string;
  
  archivo: {
    url: string;
    nombre: string;
    tamano: number;
    tipoMime: string;
    hash: string;
  };
  
  esConfidencial: boolean;
  requiereAutorizacion: boolean;
  usuariosAutorizados: string[];
  
  version: number;
  esVersionActual: boolean;
  documentoPadreId?: string;
  
  subidoPor: string;
  fechaDocumento?: number;
  fechaSubida: number;
  fechaActualizacion: number;
  tags: string[];
}

// Tipo de errores de validación
export interface ValidationErrors {
  [key: string]: string;
}
