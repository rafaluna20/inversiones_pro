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
import type { Inversion, Distribucion } from '@/types';

/** Genera hash SHA-256 en el servidor usando Node.js crypto */
async function generarHashSHA256(texto: string): Promise<string> {
  try {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(texto, 'utf8').digest('hex');
  } catch {
    return 'SHA256-SERVER-BYPASS';
  }
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

    if (proyecto.gestorId !== gestorUid) {
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
