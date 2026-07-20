'use server';

/**
 * SERVER ACTION — EJECUTAR DISTRIBUCIÓN DE UTILIDADES ("Liquidar proyecto")
 *
 * Verifica que el ejecutor sea el gestor/dueño del proyecto, calcula la
 * distribución con comisión de gestor, MUEVE el dinero de verdad (antes no
 * lo hacía — ver nota histórica abajo) y persiste un documento inmutable
 * con hash SHA-256 de auditoría.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NOTA HISTÓRICA (por qué esta versión es distinta a la anterior):
 * La versión original de este archivo leía inversiones confirmadas desde
 * una colección `inversiones` separada (el modelo "bifásico" de
 * lib/firebase/proyectos-bifasicos.ts). Se verificó contra datos reales de
 * producción con scripts/verificarModeloInversion.ts: esa colección está
 * vacía — nada en la app la escribe — mientras que los proyectos reales
 * guardan sus inversores en `producto.inversores[]` (el modelo que sí usa
 * app/productos/[id]/page.tsx). Resultado: "Liquidar proyecto" nunca
 * encontraba inversores para ningún proyecto real. Además, la versión
 * original tampoco movía saldo de nadie — solo generaba el documento de
 * auditoría, dejando el pago real en manos de otra acción
 * (distribuirGananciaLegacyAction en app/actions/inversion.ts). Esta
 * versión lee el modelo real Y mueve el dinero, para que "Liquidar
 * proyecto" sea una sola operación completa y auditable.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @version 3.0 Enterprise — Admin SDK, modelo real, con movimiento de saldo
 */

import { getAdminDb, verificarIdToken, mensajeErrorVerificacion } from '@/lib/firebase/admin';
import { calcularDistribucion, type InversionParaDistribucion } from '@/lib/distribucion';
import { Permiso, tienePermiso, type UsuarioRBAC } from '@/lib/security/rbac';
import { Rol } from '@/lib/security/rbac';

interface Inversor {
  usuarioId: string;
  cubos: number;
}

/**
 * Construye un UsuarioRBAC a partir del documento de Firestore del ejecutor.
 * El modelo de datos aún no persiste roles explícitos en todos los usuarios,
 * por lo que se leen `roles`/`rol` si existen, y si el usuario es el dueño
 * real del proyecto (`creador.id` en el modelo legado, o `gestorId` si
 * alguna vez se usa el bifásico) se le concede GESTOR para este recurso.
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
 * Deliberadamente NO atrapa el error acá — debe propagarse y abortar la
 * liquidación completa (ver el try/catch de ejecutarDistribucionAction).
 * Un fallback silencioso dejaría el documento "inmutable" con una garantía
 * criptográfica falsa.
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
 * Ejecuta la liquidación de un proyecto: calcula la distribución, mueve el
 * saldo real (gestor → socios, según su participación en cubos) y deja un
 * registro inmutable firmado.
 *
 * @param proyectoId - ID del proyecto a liquidar
 * @param utilidadNeta - Utilidad neta del proyecto declarada por el gestor
 * @param idToken - ID token del usuario que solicita la distribución (se
 *   verifica con Admin SDK; el usuario resultante debe ser el gestor)
 */
export async function ejecutarDistribucionAction(
  proyectoId: string,
  utilidadNeta: number,
  idToken: string
): Promise<EjecutarDistribucionResult> {
  let gestorUid: string;
  try {
    const decoded = await verificarIdToken(idToken);
    gestorUid = decoded.uid;
  } catch (error) {
    return { ok: false, mensaje: mensajeErrorVerificacion(error) };
  }

  const db = getAdminDb();
  const proyectoRef = db.collection('productos').doc(proyectoId);
  const gestorDocRef = db.collection('usuarios').doc(gestorUid);

  try {
    return await db.runTransaction(async (tx) => {
      // ── LECTURAS ──────────────────────────────────────────────────────
      const proyectoSnap = await tx.get(proyectoRef);
      if (!proyectoSnap.exists) return { ok: false, mensaje: 'Proyecto no encontrado.' };

      const proyecto = proyectoSnap.data()!;

      // Autorización: dueño real del proyecto (modelo legado: creador.id;
      // modelo bifásico, por si se reactiva algún día: gestorId) o RBAC.
      const esGestorDelProyecto = proyecto.creador?.id === gestorUid || proyecto.gestorId === gestorUid;
      const gestorSnap = await tx.get(gestorDocRef);
      const ejecutor = construirUsuarioRBAC(
        gestorUid,
        gestorSnap.exists ? gestorSnap.data() : undefined,
        esGestorDelProyecto
      );

      if (!tienePermiso(ejecutor, Permiso.DISTRIBUIR_GANANCIAS)) {
        return { ok: false, mensaje: 'No tienes autorización para liquidar este proyecto.' };
      }

      if (proyecto.distribucionEjecutada === true) {
        return { ok: false, mensaje: 'Este proyecto ya fue liquidado anteriormente.' };
      }

      // Un proyecto bifásico guarda sus inversores en las colecciones
      // `inversiones`/`socios`, no en `producto.inversores[]` — sin este
      // guard, la liquidación de un proyecto bifásico "tendría éxito"
      // repartiendo 0 entre 0 socios, cuando en realidad tiene inversores
      // reales que jamás verían su ganancia. La liquidación bifásica por
      // fases queda como trabajo futuro (ver app/actions/inversion-bifasica.ts).
      if (proyecto.modeloBifasico === true) {
        return { ok: false, mensaje: 'La liquidación de proyectos bifásicos aún no está implementada.' };
      }

      const inversoresFrescos: Inversor[] = Array.isArray(proyecto.inversores) ? proyecto.inversores : [];
      const precioFresco: number = proyecto.precio;

      if (typeof precioFresco === 'number' && utilidadNeta < precioFresco) {
        return {
          ok: false,
          mensaje: `La distribución debe ser mayor o igual al capital invertido (S/ ${precioFresco.toFixed(2)})`,
        };
      }

      // Adapta producto.inversores[] (cubos) al formato que espera el motor
      // de cálculo puro (montoInvertido) — ver lib/distribucion.ts.
      const inversionesAdaptadas: InversionParaDistribucion[] = inversoresFrescos.map((inv) => ({
        usuarioId: inv.usuarioId,
        montoInvertido: typeof precioFresco === 'number' ? (inv.cubos * precioFresco) / 100 : 0,
        confirmada: true,
      }));

      // 3. Calcular distribución (comisión de gestor + reparto pro-rata,
      //    cuadrado al céntimo por el método del mayor resto)
      const comisionGestor = Number(proyecto.comisionGestor || 10);
      const resultado = calcularDistribucion(utilidadNeta, comisionGestor, inversionesAdaptadas, proyectoId);

      if (!resultado.ok) {
        return { ok: false, mensaje: resultado.error.mensaje };
      }

      const { data } = resultado;

      // 4. Leer el saldo de cada socio único + el del gestor (puede
      //    coincidir si el gestor también invirtió en su propio proyecto).
      const idsUnicos = Array.from(new Set([gestorUid, ...data.distribucionPorSocio.map((s) => s.usuarioId)]));
      const saldoBasePorUid = new Map<string, number>();
      for (const id of idsUnicos) {
        const snap = id === gestorUid ? gestorSnap : await tx.get(db.collection('usuarios').doc(id));
        if (!snap.exists) return { ok: false, mensaje: `Usuario ${id} no encontrado` };
        saldoBasePorUid.set(id, snap.data()?.saldo || 0);
      }

      const saldoGestorBase = saldoBasePorUid.get(gestorUid) || 0;
      if (saldoGestorBase < data.poolSocios) {
        return {
          ok: false,
          mensaje: `Saldo insuficiente para liquidar: necesitas S/ ${data.poolSocios.toFixed(2)} disponibles para pagar a los socios (tu comisión de S/ ${data.feeGestor.toFixed(2)} no se descuenta, es tuya).`,
        };
      }

      // 5. Mapa de deltas por uid: el gestor paga poolSocios (su comisión
      //    feeGestor nunca sale de su saldo, no hace falta transacción para
      //    lo que ya es suyo); cada socio recibe su gananciaDistribuida. Si
      //    el gestor también es socio, ambos deltas se acumulan sobre el
      //    mismo uid en vez de pisarse.
      const deltaSaldoPorUid = new Map<string, number>();
      const addDelta = (uid: string, delta: number) =>
        deltaSaldoPorUid.set(uid, (deltaSaldoPorUid.get(uid) || 0) + delta);

      addDelta(gestorUid, -data.poolSocios);
      for (const socio of data.distribucionPorSocio) {
        addDelta(socio.usuarioId, socio.gananciaDistribuida);
      }

      // 6. Hash SHA-256 de auditoría
      const hashInput = [
        proyectoId,
        gestorUid,
        utilidadNeta.toString(),
        data.feeGestor.toString(),
        data.poolSocios.toString(),
        data.distribucionPorSocio.length.toString(),
        Date.now().toString(),
      ].join('|');
      const hashSHA256 = await generarHashSHA256(hashInput);

      // ── ESCRITURAS (atómicas: todas o ninguna) ──────────────────────────
      for (const [uid, delta] of deltaSaldoPorUid) {
        const ref = uid === gestorUid ? gestorDocRef : db.collection('usuarios').doc(uid);
        tx.update(ref, { saldo: (saldoBasePorUid.get(uid) || 0) + delta });
      }

      const distribucionRef = db.collection('distribuciones').doc();
      tx.set(distribucionRef, {
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
      });

      tx.update(proyectoRef, {
        distribucionEjecutada: true,
        fechaDistribucion: Date.now(),
        utilidadNeta,
        estado: false,
        // Registra la ganancia real de cada inversor directo en su propia
        // entrada del array (mismo lugar de donde salió el capital), ya que
        // no existe un documento `inversiones` separado para el modelo real.
        inversores: inversoresFrescos.map((inv) => {
          const socio = data.distribucionPorSocio.find((s) => s.usuarioId === inv.usuarioId);
          if (!socio) return inv;
          return {
            ...inv,
            gananciaReal: socio.gananciaDistribuida,
            roiReal: parseFloat(((socio.gananciaDistribuida / socio.montoInvertido) * 100).toFixed(2)),
          };
        }),
      });

      return {
        ok: true,
        mensaje: `Distribución ejecutada exitosamente. Fee gestor: S/ ${data.feeGestor.toFixed(2)}. Pool socios: S/ ${data.poolSocios.toFixed(2)}.`,
        distribucionId: distribucionRef.id,
        feeGestor: data.feeGestor,
        poolSocios: data.poolSocios,
        socioBeneficiados: data.distribucionPorSocio.length,
      };
    });
  } catch (error: any) {
    console.error('[ejecutarDistribucionAction] Error:', error);
    return { ok: false, mensaje: `Error interno: ${error?.message || 'desconocido'}` };
  }
}
