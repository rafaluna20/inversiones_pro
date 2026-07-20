'use server';

/**
 * SERVER ACTION — INVERTIR EN UNA ETAPA DE UN PROYECTO BIFÁSICO
 * (Tierra o Construcción)
 *
 * El modelo bifásico (producto.etapas.tierra/construccion, colecciones
 * `inversiones`/`socios`) estaba definido a nivel de datos pero sin ninguna
 * vía segura para invertir: `registrarInversion`/`aprobarInversion` en
 * lib/firebase/proyectos-bifasicos.ts corrían en el navegador con SDK
 * cliente, confiaban en el `usuarioId` que mandaba el cliente, y no movían
 * saldo de nadie. Esta acción es el equivalente bifásico de
 * invertirEnProyectoAction (app/actions/inversion.ts): verifica identidad
 * real vía Admin SDK y mueve el dinero de verdad, atómicamente.
 *
 * Por decisión de producto, la inversión se AUTO-CONFIRMA al momento de
 * invertir (no hay paso de aprobación de admin) — igual que el modelo
 * legado.
 *
 * Nota: aún no existe ninguna UI que llame a esta acción. Se deja lista y
 * segura para cuando se construya la pantalla de inversión bifásica.
 */

import { getAdminDb, verificarIdToken, mensajeErrorVerificacion } from '@/lib/firebase/admin';
import type { EtapaProyecto } from '@/types';

export type EtapaBifasica = 'tierra' | 'construccion';

export interface InvertirEnEtapaResult {
  ok: boolean;
  mensaje: string;
  inversionId?: string;
  montoTotal?: number;
  cubosComprados?: number;
}

function actualizarSaldoRecaudado(
  saldoRecaudado: Array<{ idProducto: string; monto: number }>,
  proyectoId: string,
  delta: number
): Array<{ idProducto: string; monto: number }> {
  const actualizado = [...saldoRecaudado];
  const idx = actualizado.findIndex((item) => item.idProducto === proyectoId);
  if (idx !== -1) {
    const nuevoMonto = actualizado[idx].monto + delta;
    if (nuevoMonto <= 0) {
      actualizado.splice(idx, 1);
    } else {
      actualizado[idx] = { ...actualizado[idx], monto: nuevoMonto };
    }
  } else if (delta > 0) {
    actualizado.push({ idProducto: proyectoId, monto: delta });
  }
  return actualizado;
}

export async function invertirEnEtapaAction(
  idToken: string,
  proyectoId: string,
  etapa: EtapaBifasica,
  cubos: number
): Promise<InvertirEnEtapaResult> {
  if (etapa !== 'tierra' && etapa !== 'construccion') {
    return { ok: false, mensaje: 'Etapa inválida.' };
  }
  const cubosRedondeados = Math.round(cubos);
  if (!Number.isFinite(cubosRedondeados) || cubosRedondeados < 1 || cubosRedondeados > 100) {
    return { ok: false, mensaje: 'La cantidad de cubos debe ser un entero entre 1 y 100.' };
  }

  let uid: string;
  try {
    const decoded = await verificarIdToken(idToken);
    uid = decoded.uid;
  } catch (error) {
    return { ok: false, mensaje: mensajeErrorVerificacion(error) };
  }

  const db = getAdminDb();
  const proyectoRef = db.collection('productos').doc(proyectoId);
  const inversorRef = db.collection('usuarios').doc(uid);
  const socioRef = db.collection('socios').doc(`${proyectoId}_${uid}`);

  try {
    return await db.runTransaction(async (tx) => {
      const proyectoSnap = await tx.get(proyectoRef);
      if (!proyectoSnap.exists) return { ok: false, mensaje: 'Proyecto no encontrado.' };

      const proyecto = proyectoSnap.data()!;
      if (proyecto.modeloBifasico !== true) {
        return { ok: false, mensaje: 'Este proyecto no usa el modelo de inversión por etapas.' };
      }

      const etapaData: EtapaProyecto | undefined = proyecto.etapas?.[etapa];
      if (!etapaData) {
        return { ok: false, mensaje: `Este proyecto no tiene configurada la etapa "${etapa}".` };
      }
      if (!etapaData.activa) {
        return { ok: false, mensaje: `La etapa "${etapa}" no está activa para recibir inversiones.` };
      }
      if (etapaData.cubos.disponibles < cubosRedondeados) {
        return { ok: false, mensaje: `Solo hay ${etapaData.cubos.disponibles} cubos disponibles en esta etapa.` };
      }

      const creadorId: string | undefined = proyecto.creador?.id;
      if (!creadorId) return { ok: false, mensaje: 'Proyecto sin creador válido.' };

      const montoTotal = cubosRedondeados * etapaData.cubos.precioPorCubo;
      const mismoDoc = uid === creadorId;

      const inversorSnap = await tx.get(inversorRef);
      if (!inversorSnap.exists) return { ok: false, mensaje: 'Usuario no encontrado.' };
      const saldoInversorActual: number = inversorSnap.data()!.saldo || 0;
      if (saldoInversorActual < montoTotal) {
        return { ok: false, mensaje: 'Saldo insuficiente.' };
      }

      const creadorSnap = mismoDoc ? inversorSnap : await tx.get(db.collection('usuarios').doc(creadorId));
      if (!creadorSnap.exists) return { ok: false, mensaje: 'Creador del proyecto no encontrado.' };
      const saldoRecaudadoCreador: Array<{ idProducto: string; monto: number }> =
        creadorSnap.data()!.saldoRecaudado || [];

      const socioSnap = await tx.get(socioRef);

      // ── Escrituras ────────────────────────────────────────────────────
      const deltaSaldoPorUid = new Map<string, number>();
      const addDelta = (id: string, delta: number) => deltaSaldoPorUid.set(id, (deltaSaldoPorUid.get(id) || 0) + delta);
      addDelta(uid, -montoTotal);

      const saldoRecaudadoActualizado = actualizarSaldoRecaudado(saldoRecaudadoCreador, proyectoId, montoTotal);

      if (mismoDoc) {
        tx.update(inversorRef, {
          saldo: saldoInversorActual + (deltaSaldoPorUid.get(uid) || 0),
          saldoRecaudado: saldoRecaudadoActualizado,
        });
      } else {
        tx.update(inversorRef, { saldo: saldoInversorActual + (deltaSaldoPorUid.get(uid) || 0) });
        tx.update(db.collection('usuarios').doc(creadorId), { saldoRecaudado: saldoRecaudadoActualizado });
      }

      const etapaPath = `etapas.${etapa}`;
      tx.update(proyectoRef, {
        [`${etapaPath}.montoRecaudado`]: etapaData.montoRecaudado + montoTotal,
        [`${etapaPath}.cubos.vendidos`]: etapaData.cubos.vendidos + cubosRedondeados,
        [`${etapaPath}.cubos.disponibles`]: etapaData.cubos.disponibles - cubosRedondeados,
        [`${etapaPath}.numeroSociosActuales`]: socioSnap.exists
          ? etapaData.numeroSociosActuales
          : etapaData.numeroSociosActuales + 1,
        updatedAt: Date.now(),
      });

      const porcentajeParticipacion = cubosRedondeados;
      if (!socioSnap.exists) {
        tx.set(socioRef, {
          proyectoId,
          usuarioId: uid,
          tipoSocio: etapa === 'tierra' ? 'tierra' : 'capital',
          porcentajePropiedad: porcentajeParticipacion,
          valorAportado: montoTotal,
          ...(etapa === 'tierra'
            ? { valorTierraProporcional: montoTotal }
            : { valorCapitalProporcional: montoTotal }),
          tieneDerechoVoto: true,
          tieneDerechoGanancia: true,
          fechaIngreso: Date.now(),
          activo: true,
          createdAt: Date.now(),
        });
      } else {
        const socioPrevio = socioSnap.data()!;
        const tipoSocioActualizado = socioPrevio.tipoSocio === etapa || socioPrevio.tipoSocio === 'mixto'
          ? socioPrevio.tipoSocio
          : 'mixto';
        tx.update(socioRef, {
          tipoSocio: tipoSocioActualizado,
          porcentajePropiedad: (socioPrevio.porcentajePropiedad || 0) + porcentajeParticipacion,
          valorAportado: (socioPrevio.valorAportado || 0) + montoTotal,
          ...(etapa === 'tierra'
            ? { valorTierraProporcional: (socioPrevio.valorTierraProporcional || 0) + montoTotal }
            : { valorCapitalProporcional: (socioPrevio.valorCapitalProporcional || 0) + montoTotal }),
          activo: true,
        });
      }

      const inversionRef = db.collection('inversiones').doc();
      tx.set(inversionRef, {
        proyectoId,
        usuarioId: uid,
        tipoInversion: etapa === 'tierra' ? 'tierra' : 'capital',
        etapa,
        montoInvertido: montoTotal,
        cubosComprados: cubosRedondeados,
        porcentajeParticipacion,
        contrato: {
          numeroContrato: `CONT-${Date.now()}`,
          tipoContrato: 'mutuo_dinerario',
        },
        transaccionOdoo: {
          estado: 'pendiente',
        },
        roiProyectado: 25,
        gananciaEstimada: montoTotal * 0.25,
        gananciaReal: 0,
        confirmada: true,
        fechaConfirmacion: Date.now(),
        fechaInversion: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return {
        ok: true,
        mensaje: '¡Inversión realizada con éxito!',
        inversionId: inversionRef.id,
        montoTotal,
        cubosComprados: cubosRedondeados,
      };
    });
  } catch (err: any) {
    console.error('[invertirEnEtapaAction] Error:', err);
    return { ok: false, mensaje: 'Error al procesar la inversión.' };
  }
}
