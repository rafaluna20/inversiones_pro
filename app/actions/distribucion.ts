'use server';

/**
 * SERVER ACTION — EJECUTAR DISTRIBUCIÓN DE UTILIDADES
 *
 * Valida que el ejecutor sea el gestor del proyecto,
 * calcula la distribución 10/90 y la persiste en Firestore
 * como un documento inmutable con hash SHA-256.
 *
 * @version 1.0 Enterprise
 */

import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { calcularDistribucion } from '@/lib/distribucion';
import {
  Rol,
  Permiso,
  tienePermiso,
  type UsuarioRBAC,
} from '@/lib/security/rbac';
import type { Inversion, Distribucion } from '@/types';

/**
 * Construye un UsuarioRBAC a partir del documento de Firestore del ejecutor.
 *
 * El modelo de datos aún no persiste roles explícitos en todos los usuarios,
 * por lo que:
 *  - se leen `roles` (array) o `rol` (string) si existen en el documento, y
 *  - si el usuario es el gestor del proyecto (`esGestorDelProyecto`), se le
 *    concede el rol GESTOR para este recurso (compatibilidad con el modelo
 *    actual basado en `gestorId`).
 */
function construirUsuarioRBAC(
  uid: string,
  data: Record<string, any> | undefined,
  esGestorDelProyecto: boolean
): UsuarioRBAC {
  const roles = new Set<Rol>();

  if (Array.isArray(data?.roles)) {
    data!.roles.forEach((r: string) => {
      if (Object.values(Rol).includes(r as Rol)) roles.add(r as Rol);
    });
  }
  if (typeof data?.rol === 'string' && Object.values(Rol).includes(data.rol as Rol)) {
    roles.add(data.rol as Rol);
  }
  if (esGestorDelProyecto) roles.add(Rol.GESTOR);
  if (roles.size === 0) roles.add(Rol.USUARIO);

  return {
    id: uid,
    email: data?.email || '',
    roles: Array.from(roles),
    permisosAdicionales: data?.permisosAdicionales,
    permisosRevocados: data?.permisosRevocados,
  };
}

/**
 * Genera hash SHA-256 en el servidor usando el módulo `crypto` de Node.
 *
 * Este hash es lo que hace "auditable e inmutable" al documento de
 * distribución: si el cálculo del hash fallara y la función devolviera un
 * valor de reemplazo en silencio, el documento quedaría persistido con una
 * garantía criptográfica falsa. Por eso aquí NO se atrapa el error — debe
 * propagarse y abortar la liquidación completa (ver el try/catch de
 * `ejecutarDistribucionAction`, que ya maneja este caso).
 */
async function generarHashSHA256(texto: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

export interface EjecutarDistribucionResult {
  ok: boolean;
  mensaje: string;
  distribucionId?: string;
  feeGestor?: number;
  poolSocios?: number;
  socioBeneficiados?: number;
}

/**
 * Ejecuta la liquidación de un proyecto.
 *
 * @param proyectoId - ID del proyecto a liquidar
 * @param utilidadNeta - Utilidad neta del proyecto declarada por el gestor
 * @param gestorUid - UID del usuario que solicita la distribución (debe ser el gestor)
 */
export async function ejecutarDistribucionAction(
  proyectoId: string,
  utilidadNeta: number,
  gestorUid: string
): Promise<EjecutarDistribucionResult> {
  try {
    // 1. Verificar que el proyecto existe y que el ejecutor es su gestor
    const proyectoRef = doc(db, 'productos', proyectoId);
    const proyectoSnap = await getDoc(proyectoRef);

    if (!proyectoSnap.exists()) {
      return { ok: false, mensaje: 'Proyecto no encontrado.' };
    }

    const proyecto = proyectoSnap.data();

    // 1a. Autorización RBAC: el ejecutor debe poseer el permiso DISTRIBUIR_GANANCIAS.
    //     Se combina la propiedad del proyecto (gestorId) con los roles del usuario.
    const esGestorDelProyecto = proyecto.gestorId === gestorUid;
    const usuarioSnap = await getDoc(doc(db, 'usuarios', gestorUid));
    const ejecutor = construirUsuarioRBAC(
      gestorUid,
      usuarioSnap.exists() ? usuarioSnap.data() : undefined,
      esGestorDelProyecto
    );

    if (!tienePermiso(ejecutor, Permiso.DISTRIBUIR_GANANCIAS)) {
      return { ok: false, mensaje: 'No tienes autorización para liquidar este proyecto.' };
    }

    if (proyecto.distribucionEjecutada === true) {
      return { ok: false, mensaje: 'Este proyecto ya fue liquidado anteriormente.' };
    }

    // 2. Obtener inversiones confirmadas del proyecto
    const inversionesQuery = query(
      collection(db, 'inversiones'),
      where('proyectoId', '==', proyectoId),
      where('confirmada', '==', true)
    );
    const inversionesSnap = await getDocs(inversionesQuery);
    const inversiones = inversionesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Inversion[];

    // 3. Calcular distribución
    const comisionGestor = Number(proyecto.comisionGestor || 10);
    const resultado = calcularDistribucion(utilidadNeta, comisionGestor, inversiones, proyectoId);

    if (!resultado.ok) {
      return { ok: false, mensaje: resultado.error.mensaje };
    }

    const { data } = resultado;

    // 4. Generar hash SHA-256 de auditoría
    const hashInput = [
      proyectoId,
      gestorUid,
      utilidadNeta.toString(),
      data.feeGestor.toString(),
      data.poolSocios.toString(),
      inversiones.length.toString(),
      Date.now().toString(),
    ].join('|');
    const hashSHA256 = await generarHashSHA256(hashInput);

    // 5. Construir el documento de distribución
    const distribucionDoc: Omit<Distribucion, 'id'> = {
      proyectoId,
      proyectoNombre: proyecto.nombre || 'Proyecto',
      gestorId: gestorUid,
      comisionGestorPorcentaje: comisionGestor,
      fechaEjecucion: Date.now(),
      utilidadNeta: data.utilidadNeta,
      feeGestor: data.feeGestor,
      poolSocios: data.poolSocios,
      capitalTotalSocios: data.capitalTotalSocios,
      distribucionPorSocio: data.distribucionPorSocio,
      hashSHA256,
      ejecutadoPor: gestorUid,
      createdAt: Date.now(),
    };

    // 6. Persistir en Firestore con batch atómico
    const batch = writeBatch(db);

    // 6a. Crear documento de distribución (inmutable)
    const distribucionRef = doc(collection(db, 'distribuciones'));
    batch.set(distribucionRef, distribucionDoc);

    // 6b. Marcar el proyecto como liquidado
    batch.update(proyectoRef, {
      distribucionEjecutada: true,
      fechaDistribucion: Date.now(),
      utilidadNeta,
      estado: false, // El proyecto pasa a completado
    });

    // 6c. Actualizar gananciaReal en cada inversión del socio
    for (const socioDistrib of data.distribucionPorSocio) {
      const invDel = inversionesSnap.docs.find(
        (d) => d.data().usuarioId === socioDistrib.usuarioId
      );
      if (invDel) {
        batch.update(doc(db, 'inversiones', invDel.id), {
          gananciaReal: socioDistrib.gananciaDistribuida,
          roiReal: parseFloat(
            ((socioDistrib.gananciaDistribuida / socioDistrib.montoInvertido) * 100).toFixed(2)
          ),
          fechaConfirmacion: Date.now(),
        });
      }
    }

    await batch.commit();

    return {
      ok: true,
      mensaje: `Distribución ejecutada exitosamente. Fee gestor: S/ ${data.feeGestor.toFixed(2)}. Pool socios: S/ ${data.poolSocios.toFixed(2)}.`,
      distribucionId: distribucionRef.id,
      feeGestor: data.feeGestor,
      poolSocios: data.poolSocios,
      socioBeneficiados: data.distribucionPorSocio.length,
    };
  } catch (error: any) {
    console.error('[ejecutarDistribucionAction] Error:', error);
    return { ok: false, mensaje: `Error interno: ${error?.message || 'desconocido'}` };
  }
}
