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
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Producto, EtapaProyecto, Inversion, Socio, Hito } from '@/types';
import { devLog } from '@/lib/utils/devLog';
// import { crearTransaccionOdoo, confirmarTransaccionOdoo } from '@/lib/billetera-api';

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

export interface RegistrarInversionForm {
  proyectoId: string;
  usuarioId: string;
  tipoInversion: 'tierra' | 'capital';
  cubosDeseados: number;
  montoTotal: number;
  metodoPago: 'wallet' | 'transferencia';
}

/**
 * `RegistrarInversionForm.tipoInversion` usa el vocabulario 'tierra'/'capital'
 * (igual que `Inversion.tipoInversion` y `Socio.tipoSocio` en types/index.ts),
 * pero `Producto.etapas` y el campo `Inversion.etapa` usan 'tierra'/
 * 'construccion' (igual que lib/distribucion.ts, aprobarInversion() más
 * abajo, y lib/resilience/reconciliation-logic.ts). Son la misma fase del
 * proyecto con dos nombres distintos en dos partes del modelo de datos —
 * sin este mapeo, indexar `etapas[tipoInversion]` con 'capital' devuelve
 * `undefined` y revienta en tiempo de ejecución (esto es justo lo que
 * `strict: true` de TypeScript detectó).
 */
const ETAPA_POR_TIPO_INVERSION: Record<RegistrarInversionForm['tipoInversion'], 'tierra' | 'construccion'> = {
  tierra: 'tierra',
  capital: 'construccion',
};

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
// REGISTRAR INVERSIÓN
// ============================================

/**
 * Registrar una inversión en un proyecto bifásico
 * Crea transacción en Odoo Wallet
 */
export async function registrarInversion(
  form: RegistrarInversionForm
): Promise<string> {
  try {
    // 1. Obtener proyecto
    const proyectoRef = doc(db, 'productos', form.proyectoId);
    const proyectoSnap = await getDoc(proyectoRef);

    if (!proyectoSnap.exists()) {
      throw new Error('Proyecto no encontrado');
    }

    const proyecto = proyectoSnap.data() as Producto;

    // 2. Verificar que es proyecto bifásico
    if (!proyecto.modeloBifasico) {
      throw new Error('Este proyecto no es bifásico');
    }

    // 3. Verificar disponibilidad de cubos
    const etapaKey = ETAPA_POR_TIPO_INVERSION[form.tipoInversion];
    const etapa = proyecto.etapas![etapaKey];
    if (etapa.cubos.disponibles < form.cubosDeseados) {
      throw new Error(`Solo hay ${etapa.cubos.disponibles} cubos disponibles`);
    }

    // 4. Crear transacción en Odoo Wallet
    let transaccionOdoo: { id?: string; reference?: string } | undefined;
    /*
    NOTA: el pago de la inversión se realiza vía saldo de plataforma en Firebase
    (restarSaldo en app/productos/[id]/page.tsx), no vía Odoo. No se requiere transacción Odoo aquí.
    Confirmar el endpoint Odoo (ENDPOINT_PAGO_INVERSION) antes de activar el débito en producción.
    try {
      transaccionOdoo = await crearTransaccionOdoo({
        usuario_id: form.usuarioId,  // Se debe mapear Firebase UID → Odoo ID
        tipo: 'inversion',
        monto: form.montoTotal,
        referencia: `INV-${form.proyectoId.substring(0, 8)}-${form.tipoInversion.toUpperCase()}`,
        metadata: {
          proyecto_id: form.proyectoId,
          proyecto_nombre: proyecto.nombre,
          etapa: form.tipoInversion,
          cubos: form.cubosDeseados
        }
      });
    } catch (odooError) {
      console.error('Error creando transacción Odoo:', odooError);
      throw new Error('Error al procesar pago con Odoo Wallet');
    }
    */

    // 5. Registrar inversión en Firebase
    const inversionRef = await addDoc(collection(db, 'inversiones'), {
      proyectoId: form.proyectoId,
      usuarioId: form.usuarioId,
      tipoInversion: form.tipoInversion,
      etapa: etapaKey,
      montoInvertido: form.montoTotal,
      cubosComprados: form.cubosDeseados,
      porcentajeParticipacion: form.cubosDeseados,
      contrato: {
        numeroContrato: `CONT-${Date.now()}`,
        tipoContrato: 'mutuo_dinerario'
      },
      transaccionOdoo: {
        transaccionId: transaccionOdoo?.id,
        referencia: transaccionOdoo?.reference,
        estado: 'pendiente'
      },
      roiProyectado: 25,  // Calcular basado en proyección
      gananciaEstimada: form.montoTotal * 0.25,
      gananciaReal: 0,
      confirmada: false,
      fechaInversion: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    devLog('✅ Inversión registrada:', inversionRef.id);
    devLog('   Monto:', form.montoTotal);
    devLog('   Cubos:', form.cubosDeseados);
    devLog('   Odoo TX:', transaccionOdoo?.reference);

    return inversionRef.id;

  } catch (error) {
    console.error('❌ Error registrando inversión:', error);
    throw error;
  }
}

// ============================================
// APROBAR INVERSIÓN
// ============================================

/**
 * Aprobar inversión (Admin)
 * Confirma transacción Odoo y actualiza proyecto
 */
export async function aprobarInversion(inversionId: string): Promise<void> {
  try {
    // 1. Obtener inversión
    const inversionRef = doc(db, 'inversiones', inversionId);
    const inversionSnap = await getDoc(inversionRef);

    if (!inversionSnap.exists()) {
      throw new Error('Inversión no encontrada');
    }

    const inversion = inversionSnap.data() as Inversion;

    // 2. Confirmar transacción en Odoo
    /*
    if (inversion.transaccionOdoo.transaccionId) {
      await confirmarTransaccionOdoo(inversion.transaccionOdoo.transaccionId);
    }
    */

    // 3. Actualizar inversión
    await updateDoc(inversionRef, {
      'transaccionOdoo.estado': 'confirmada',
      confirmada: true,
      fechaConfirmacion: Date.now(),
      updatedAt: Date.now()
    });

    // 4. Actualizar proyecto (incrementar montos)
    const proyectoRef = doc(db, 'productos', inversion.proyectoId);
    const etapaPath = `etapas.${inversion.etapa}`;

    await updateDoc(proyectoRef, {
      [`${etapaPath}.montoRecaudado`]: increment(inversion.montoInvertido),
      [`${etapaPath}.cubos.vendidos`]: increment(inversion.cubosComprados),
      [`${etapaPath}.cubos.disponibles`]: increment(-inversion.cubosComprados),
      [`${etapaPath}.numeroSociosActuales`]: increment(1),
      updatedAt: Date.now()
    });

    // 5. Crear o actualizar socio
    const sociosQuery = query(
      collection(db, 'socios'),
      where('proyectoId', '==', inversion.proyectoId),
      where('usuarioId', '==', inversion.usuarioId)
    );
    const sociosSnap = await getDocs(sociosQuery);

    if (sociosSnap.empty) {
      // Crear nuevo socio
      await addDoc(collection(db, 'socios'), {
        proyectoId: inversion.proyectoId,
        usuarioId: inversion.usuarioId,
        tipoSocio: inversion.tipoInversion,
        porcentajePropiedad: inversion.porcentajeParticipacion,
        valorAportado: inversion.montoInvertido,
        ...(inversion.tipoInversion === 'tierra'
          ? { valorTierraProporcional: inversion.montoInvertido }
          : { valorCapitalProporcional: inversion.montoInvertido }
        ),
        tieneDerechoVoto: true,
        tieneDerechoGanancia: true,
        fechaIngreso: Date.now(),
        activo: true,
        createdAt: Date.now()
      });
      devLog('✅ Nuevo socio creado');
    } else {
      // Actualizar a socio mixto
      const socioRef = sociosSnap.docs[0].ref;
      await updateDoc(socioRef, {
        tipoSocio: 'mixto',
        porcentajePropiedad: increment(inversion.porcentajeParticipacion),
        valorAportado: increment(inversion.montoInvertido),
        ...(inversion.tipoInversion === 'tierra'
          ? { valorTierraProporcional: increment(inversion.montoInvertido) }
          : { valorCapitalProporcional: increment(inversion.montoInvertido) }
        )
      });
      devLog('✅ Socio actualizado a MIXTO');
    }

    devLog('✅ Inversión aprobada exitosamente');

  } catch (error) {
    console.error('❌ Error aprobando inversión:', error);
    throw error;
  }
}

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
