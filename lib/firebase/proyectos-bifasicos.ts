/**
 * FUNCIONES FIREBASE PARA PROYECTOS BIFÁSICOS
 * 
 * Gestión completa de proyectos con modelo Tierra → Construcción
 * Integración con Odoo Wallet para transacciones
 * 
 * @version 2.0 Enterprise
 * @date 09/02/2026
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Producto, EtapaProyecto, Inversion, Socio, Hito } from '@/types';
import { devLog } from '@/lib/utils/devLog';

// ============================================
// INTERFACES DE FORMULARIOS
// ============================================

export interface CrearProyectoBifasicoForm {
  nombre: string;
  descripcion: string;
  categoria: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
  imagenPrincipal: string;
  galeriaImagenes?: string[];

  etapaTierra: {
    montoObjetivo: number;
    numeroSocios?: number;  // Default 10
    duracionMeses: number;
    tasacionInicial: number;
  };

  etapaConstruccion: {
    montoObjetivo: number;
    numeroSocios?: number;  // Default 5
    duracionMeses: number;
    costoObraEstimado: number;
  };
}

// ============================================
// CREAR PROYECTO BIFÁSICO
// ============================================

/**
 * Crear un proyecto con modelo bifásico (Tierra + Construcción)
 */
export async function crearProyectoBifasico(
  form: CrearProyectoBifasicoForm,
  creadorId: string,
  creadorNombre: string
): Promise<string> {
  try {
    const etapaTierraObj: EtapaProyecto = {
      montoObjetivo: form.etapaTierra.montoObjetivo,
      montoRecaudado: 0,
      numeroSociosObjetivo: form.etapaTierra.numeroSocios || 10,
      numeroSociosActuales: 0,
      cubos: {
        totales: 100,
        vendidos: 0,
        disponibles: 100,
        precioPorCubo: form.etapaTierra.montoObjetivo / 100
      },
      tasacion: {
        inicial: form.etapaTierra.tasacionInicial,
        actual: form.etapaTierra.tasacionInicial,
        fechaTasacion: Date.now()
      },
      duracionMeses: form.etapaTierra.duracionMeses,
      completada: false,
      activa: true
    };

    const etapaConstruccionObj: EtapaProyecto = {
      montoObjetivo: form.etapaConstruccion.montoObjetivo,
      montoRecaudado: 0,
      numeroSociosObjetivo: form.etapaConstruccion.numeroSocios || 5,
      numeroSociosActuales: 0,
      cubos: {
        totales: 100,
        vendidos: 0,
        disponibles: 100,
        precioPorCubo: form.etapaConstruccion.montoObjetivo / 100
      },
      costoObraEstimado: form.etapaConstruccion.costoObraEstimado,
      duracionMeses: form.etapaConstruccion.duracionMeses,
      completada: false,
      activa: false  // Inicia inactiva
    };

    const docRef = await addDoc(collection(db, 'productos'), {
      // Campos básicos
      nombre: form.nombre,
      empresa: creadorNombre,
      url: form.nombre.toLowerCase().replace(/\s+/g, '-'),
      urlimagen: form.imagenPrincipal,
      descripcion: form.descripcion,
      categoria: form.categoria,

      // Ubicación
      direccion: form.direccion,
      departamento: form.departamento,
      provincia: form.provincia,
      distrito: form.distrito,
      coordenadas: form.coordenadas,

      // Creador
      creador: {
        id: creadorId,
        nombre: creadorNombre
      },

      // Estados
      modeloBifasico: true,  // ⭐ MARCADOR DE PROYECTO BIFÁSICO
      etapaActual: 'tierra',
      estadoProyecto: 'captacion',
      estado: true,  // Compatibilidad

      // Etapas
      etapas: {
        tierra: etapaTierraObj,
        construccion: etapaConstruccionObj
      },

      // Compatibilidad con código antiguo
      precio: form.etapaTierra.montoObjetivo + form.etapaConstruccion.montoObjetivo,
      monto: 0,
      inversores: [],
      votos: 0,
      haVotado: [],
      comentarios: [],
      depositoRecaudado: false,

      // Timestamps
      creado: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Crear hito inicial: Compra de Terreno
    await addDoc(collection(db, 'hitos'), {
      proyectoId: docRef.id,
      etapa: 'tierra',
      tipo: 'compra_terreno',
      titulo: 'Compra de Terreno',
      descripcion: 'Adquisición del terreno con escrituras públicas',
      orden: 1,
      estado: 'pendiente',
      progresoPorcentaje: 0,
      evidencia: {
        fotosAntes: [],
        fotosDurante: [],
        fotosDespues: [],
        documentosAdjuntos: []
      },
      creadoPor: creadorId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    devLog('✅ Proyecto bifásico creado:', docRef.id);
    return docRef.id;

  } catch (error) {
    console.error('❌ Error creando proyecto bifásico:', error);
    throw error;
  }
}

// ============================================
// REGISTRAR / APROBAR INVERSIÓN
// ============================================
//
// Removidas: `registrarInversion` y `aprobarInversion` corrían en el
// navegador con SDK cliente, confiaban en el `usuarioId` que mandaba el
// cliente, y no movían saldo de nadie (0 callers en toda la app). El
// reemplazo seguro — Admin SDK, identidad verificada por ID token,
// movimiento de saldo atómico, auto-confirmación al invertir — es
// `invertirEnEtapaAction` en app/actions/inversion-bifasica.ts.

// ============================================
// OBTENER PROYECTOS BIFÁSICOS
// ============================================

/**
 * Obtener todos los proyectos bifásicos
 */
export async function obtenerProyectosBifasicos(): Promise<Producto[]> {
  try {
    const q = query(
      collection(db, 'productos'),
      where('modeloBifasico', '==', true),
      orderBy('creado', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Producto[];

  } catch (error) {
    console.error('Error obteniendo proyectos bifásicos:', error);
    return [];
  }
}

/**
 * Obtener inversiones de un usuario
 */
export async function obtenerInversionesUsuario(usuarioId: string): Promise<Inversion[]> {
  try {
    const q = query(
      collection(db, 'inversiones'),
      where('usuarioId', '==', usuarioId),
      orderBy('fechaInversion', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Inversion[];

  } catch (error) {
    console.error('Error obteniendo inversiones:', error);
    return [];
  }
}

/**
 * Obtener socios de un proyecto
 */
export async function obtenerSociosProyecto(proyectoId: string): Promise<Socio[]> {
  try {
    const q = query(
      collection(db, 'socios'),
      where('proyectoId', '==', proyectoId),
      where('activo', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Socio[];

  } catch (error) {
    console.error('Error obteniendo socios:', error);
    return [];
  }
}

/**
 * Obtener hitos de un proyecto
 */
export async function obtenerHitosProyecto(proyectoId: string): Promise<Hito[]> {
  try {
    const q = query(
      collection(db, 'hitos'),
      where('proyectoId', '==', proyectoId),
      orderBy('orden', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Hito[];

  } catch (error) {
    console.error('Error obteniendo hitos:', error);
    return [];
  }
}
