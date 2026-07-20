'use server';

/**
 * SERVER ACTIONS — FLUJO DE INVERSIÓN (modelo legado: array `inversores`
 * embebido en `productos/{id}`)
 *
 * Cierra el hallazgo crítico #1 de la auditoría: hasta ahora, invertir,
 * editar/eliminar una inversión, distribuir ganancias y depositar lo
 * recaudado corrían enteros en el navegador con la sesión del propio
 * usuario (ver Validacion/*.ts y el commit anterior en
 * app/productos/[id]/page.tsx). Estas funciones usan Firebase Admin SDK:
 * verifican la identidad real del usuario contra su ID token (no confían en
 * un `usuarioId` que el cliente podría falsificar) y ejecutan la
 * transacción con privilegios de servidor, sin depender de que
 * firestore.rules sea perfecto.
 *
 * El cliente (app/productos/[id]/page.tsx) ahora solo obtiene su propio
 * `idToken` (`await usuario.getIdToken()`) y llama a estas acciones — ya no
 * importa Validacion/restarSaldo.ts ni escribe en Firestore directamente
 * para estos flujos.
 */

import {
  getAdminDb,
  verificarIdToken,
  mensajeErrorVerificacion,
  type UsuarioVerificado,
} from '@/lib/firebase/admin';

export interface InversionData {
  descripcion: string;
  cubos: number;
  categoria: string;
}

interface Inversor {
  usuarioId: string;
  usuarioNombre: string;
  cubos: number;
  descripcion: string;
  categoria: string;
  fecha: number;
  icono?: string;
}

export interface AccionInversionResult {
  ok: boolean;
  mensaje: string;
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

/**
 * Invertir (o editar una inversión existente) en un proyecto.
 * @param esEdicion - true si es una edición de una inversión ya existente del usuario
 */
export async function invertirEnProyectoAction(
  idToken: string,
  proyectoId: string,
  data: InversionData,
  esEdicion: boolean
): Promise<AccionInversionResult> {
  let usuario: UsuarioVerificado;
  try {
    usuario = await verificarIdToken(idToken);
  } catch (error) {
    return { ok: false, mensaje: mensajeErrorVerificacion(error) };
  }

  const db = getAdminDb();
  const docRef = db.collection('productos').doc(proyectoId);
  const usuarioDocRef = db.collection('usuarios').doc(usuario.uid);

  try {
    return await db.runTransaction(async (tx) => {
      const productoSnap = await tx.get(docRef);
      if (!productoSnap.exists) return { ok: false, mensaje: 'Producto no encontrado' };

      const productoData = productoSnap.data()!;
      const inversoresFrescos: Inversor[] = productoData.inversores || [];
      const precioFresco: number = productoData.precio;
      const creadorId: string | undefined = productoData.creador?.id;

      if (!creadorId) return { ok: false, mensaje: 'Proyecto sin creador válido' };

      if (productoData.fechaLimite && Date.now() > productoData.fechaLimite) {
        return { ok: false, mensaje: 'El plazo de recaudación para este proyecto ha expirado.' };
      }

      const totalCubosFresco = inversoresFrescos.reduce((sum, inv) => sum + inv.cubos, 0);
      const cubosLibresFrescos = 100 - totalCubosFresco;
      const cubosRedondeados = Math.round(data.cubos * 10000) / 10000;

      const mismoDoc = usuario.uid === creadorId;

      const usuarioSnap = await tx.get(usuarioDocRef);
      if (!usuarioSnap.exists) return { ok: false, mensaje: 'Usuario no encontrado' };
      const saldoInversorActual: number = usuarioSnap.data()!.saldo || 0;

      const creadorSnap = mismoDoc ? usuarioSnap : await tx.get(db.collection('usuarios').doc(creadorId));
      if (!creadorSnap.exists) return { ok: false, mensaje: 'Creador del proyecto no encontrado' };
      const saldoRecaudadoCreador: Array<{ idProducto: string; monto: number }> =
        creadorSnap.data()!.saldoRecaudado || [];

      let nuevoSaldoInversor: number;
      let deltaSaldoRecaudado: number;
      let nuevosInversores: Inversor[];

      if (esEdicion) {
        const index = inversoresFrescos.findIndex((inv) => inv.usuarioId === usuario.uid);
        if (index === -1) return { ok: false, mensaje: 'Tu inversión ya no existe en este proyecto.' };

        const valorViejo = (inversoresFrescos[index].cubos * precioFresco) / 100;
        const nuevoCosto = (data.cubos * precioFresco) / 100;

        // Cubos libres considerando que esta inversión libera los suyos primero
        const cubosLibresParaEdicion = cubosLibresFrescos + inversoresFrescos[index].cubos;
        if (cubosRedondeados > Math.round(cubosLibresParaEdicion * 10000) / 10000 + 0.0001) {
          return {
            ok: false,
            mensaje: `Solo quedan ${cubosLibresParaEdicion.toFixed(4)} cubos disponibles. Ajusta tu inversión.`,
          };
        }

        if (saldoInversorActual + valorViejo < nuevoCosto) {
          return { ok: false, mensaje: 'Saldo insuficiente' };
        }

        nuevoSaldoInversor = saldoInversorActual + valorViejo - nuevoCosto;
        deltaSaldoRecaudado = nuevoCosto - valorViejo;

        nuevosInversores = [...inversoresFrescos];
        nuevosInversores[index] = {
          ...nuevosInversores[index],
          descripcion: data.descripcion,
          cubos: data.cubos,
          categoria: data.categoria,
          fecha: Date.now(),
        };
      } else {
        if (cubosLibresFrescos <= 0) {
          return { ok: false, mensaje: 'Este proyecto ya alcanzó el 100% de financiamiento.' };
        }
        if (cubosRedondeados > Math.round(cubosLibresFrescos * 10000) / 10000 + 0.0001) {
          return {
            ok: false,
            mensaje: `Solo quedan ${cubosLibresFrescos.toFixed(4)} cubos disponibles. Ajusta tu inversión.`,
          };
        }

        const costoTotal = (data.cubos * precioFresco) / 100;
        if (saldoInversorActual < costoTotal) {
          return { ok: false, mensaje: 'Saldo insuficiente' };
        }

        nuevoSaldoInversor = saldoInversorActual - costoTotal;
        deltaSaldoRecaudado = costoTotal;

        const nuevaInversion: Inversor = {
          usuarioId: usuario.uid,
          usuarioNombre: usuario.nombre,
          icono: usuario.foto,
          fecha: Date.now(),
          ...data,
        };
        nuevosInversores = [...inversoresFrescos, nuevaInversion];
      }

      const saldoRecaudadoActualizado = actualizarSaldoRecaudado(saldoRecaudadoCreador, proyectoId, deltaSaldoRecaudado);

      if (mismoDoc) {
        tx.update(usuarioDocRef, { saldo: nuevoSaldoInversor, saldoRecaudado: saldoRecaudadoActualizado });
      } else {
        tx.update(usuarioDocRef, { saldo: nuevoSaldoInversor });
        tx.update(db.collection('usuarios').doc(creadorId), { saldoRecaudado: saldoRecaudadoActualizado });
      }
      tx.update(docRef, { inversores: nuevosInversores });

      return { ok: true, mensaje: esEdicion ? 'Inversión actualizada' : '¡Inversión realizada con éxito!' };
    });
  } catch (err: any) {
    console.error('[invertirEnProyectoAction] Error:', err);
    return { ok: false, mensaje: 'Error al procesar la inversión' };
  }
}

/** Elimina la inversión del usuario en un proyecto y le devuelve el saldo. */
export async function eliminarInversionAction(
  idToken: string,
  proyectoId: string
): Promise<AccionInversionResult> {
  let usuario: UsuarioVerificado;
  try {
    usuario = await verificarIdToken(idToken);
  } catch (error) {
    return { ok: false, mensaje: mensajeErrorVerificacion(error) };
  }

  const db = getAdminDb();
  const docRef = db.collection('productos').doc(proyectoId);
  const usuarioDocRef = db.collection('usuarios').doc(usuario.uid);

  try {
    return await db.runTransaction(async (tx) => {
      const productoSnap = await tx.get(docRef);
      if (!productoSnap.exists) return { ok: false, mensaje: 'Producto no encontrado' };

      const productoData = productoSnap.data()!;
      const inversoresFrescos: Inversor[] = productoData.inversores || [];
      const precioFresco: number = productoData.precio;
      const creadorId: string | undefined = productoData.creador?.id;
      if (!creadorId) return { ok: false, mensaje: 'Proyecto sin creador válido' };

      const inversorFresco = inversoresFrescos.find((inv) => inv.usuarioId === usuario.uid);
      if (!inversorFresco) return { ok: false, mensaje: 'Tu inversión ya no existe en este proyecto.' };

      const montoDevolucion = (inversorFresco.cubos * precioFresco) / 100;
      const mismoDoc = usuario.uid === creadorId;

      const usuarioSnap = await tx.get(usuarioDocRef);
      if (!usuarioSnap.exists) return { ok: false, mensaje: 'Usuario no encontrado' };
      const saldoInversorActual: number = usuarioSnap.data()!.saldo || 0;

      const creadorSnap = mismoDoc ? usuarioSnap : await tx.get(db.collection('usuarios').doc(creadorId));
      const saldoRecaudadoCreador: Array<{ idProducto: string; monto: number }> = creadorSnap.exists
        ? creadorSnap.data()!.saldoRecaudado || []
        : [];

      const saldoRecaudadoActualizado = actualizarSaldoRecaudado(saldoRecaudadoCreador, proyectoId, -montoDevolucion);
      const nuevosInversores = inversoresFrescos.filter((inv) => inv.usuarioId !== usuario.uid);
      const nuevoSaldoInversor = saldoInversorActual + montoDevolucion;

      if (mismoDoc) {
        tx.update(usuarioDocRef, { saldo: nuevoSaldoInversor, saldoRecaudado: saldoRecaudadoActualizado });
      } else {
        tx.update(usuarioDocRef, { saldo: nuevoSaldoInversor });
        tx.update(db.collection('usuarios').doc(creadorId), { saldoRecaudado: saldoRecaudadoActualizado });
      }
      tx.update(docRef, { inversores: nuevosInversores });

      return { ok: true, mensaje: 'Inversión eliminada y saldo devuelto' };
    });
  } catch (err: any) {
    console.error('[eliminarInversionAction] Error:', err);
    return { ok: false, mensaje: 'Error al eliminar inversión' };
  }
}

/** Distribuye ganancias a los inversores (modelo legado). Solo el creador. */
export async function distribuirGananciaLegacyAction(
  idToken: string,
  proyectoId: string,
  gananciaTotal: number,
  aportarGanancia: boolean
): Promise<AccionInversionResult> {
  let usuario: UsuarioVerificado;
  try {
    usuario = await verificarIdToken(idToken);
  } catch (error) {
    return { ok: false, mensaje: mensajeErrorVerificacion(error) };
  }

  const db = getAdminDb();
  const docRef = db.collection('productos').doc(proyectoId);
  const creadorDocRef = db.collection('usuarios').doc(usuario.uid);

  try {
    return await db.runTransaction(async (tx) => {
      const productoSnap = await tx.get(docRef);
      if (!productoSnap.exists) return { ok: false, mensaje: 'Producto no encontrado' };

      const productoData = productoSnap.data()!;

      // Autorización server-side real: el cliente ya no decide quién puede
      // distribuir ganancias con un booleano `esCreador` local.
      if (productoData.creador?.id !== usuario.uid) {
        return { ok: false, mensaje: 'Solo el creador del proyecto puede distribuir ganancias.' };
      }
      if (productoData.estado === false) {
        return { ok: false, mensaje: 'Este proyecto ya fue liquidado anteriormente.' };
      }

      const inversoresFrescos: Inversor[] = productoData.inversores || [];
      const precioFresco: number = productoData.precio;

      if (gananciaTotal < precioFresco) {
        return {
          ok: false,
          mensaje: `La distribución debe ser mayor o igual al capital invertido (S/ ${precioFresco.toFixed(2)})`,
        };
      }

      const totalCubos = inversoresFrescos.reduce((sum, inv) => sum + inv.cubos, 0);
      if (totalCubos <= 0) {
        return { ok: false, mensaje: 'No hay inversores para distribuir ganancias.' };
      }

      const idsUnicos = Array.from(new Set([usuario.uid, ...inversoresFrescos.map((inv) => inv.usuarioId)]));
      const saldoBasePorUid = new Map<string, number>();
      for (const id of idsUnicos) {
        const snap = id === usuario.uid ? await tx.get(creadorDocRef) : await tx.get(db.collection('usuarios').doc(id));
        if (!snap.exists) return { ok: false, mensaje: `Usuario ${id} no encontrado` };
        saldoBasePorUid.set(id, snap.data()!.saldo || 0);
      }

      const saldoCreadorBase = saldoBasePorUid.get(usuario.uid) || 0;
      const gananciaNeta = gananciaTotal - precioFresco;
      const aporte = aportarGanancia && gananciaNeta > 0 ? gananciaNeta : 0;

      if (saldoCreadorBase + aporte < gananciaTotal) {
        return { ok: false, mensaje: 'Saldo insuficiente para distribuir ganancia' };
      }

      const deltaSaldoPorUid = new Map<string, number>();
      const addDelta = (uid: string, delta: number) =>
        deltaSaldoPorUid.set(uid, (deltaSaldoPorUid.get(uid) || 0) + delta);

      addDelta(usuario.uid, aporte - gananciaTotal);

      for (const id of idsUnicos) {
        if (id === usuario.uid) continue;
        const cubosDelInversor = inversoresFrescos
          .filter((inv) => inv.usuarioId === id)
          .reduce((sum, inv) => sum + inv.cubos, 0);
        if (cubosDelInversor <= 0) continue;
        const gananciaInversor = parseFloat(((gananciaTotal * cubosDelInversor) / totalCubos).toFixed(2));
        addDelta(id, gananciaInversor);
      }
      const cubosPropios = inversoresFrescos
        .filter((inv) => inv.usuarioId === usuario.uid)
        .reduce((sum, inv) => sum + inv.cubos, 0);
      if (cubosPropios > 0) {
        addDelta(usuario.uid, parseFloat(((gananciaTotal * cubosPropios) / totalCubos).toFixed(2)));
      }

      for (const [id, delta] of deltaSaldoPorUid) {
        const ref = id === usuario.uid ? creadorDocRef : db.collection('usuarios').doc(id);
        tx.update(ref, { saldo: (saldoBasePorUid.get(id) || 0) + delta });
      }
      tx.update(docRef, { estado: false, monto: gananciaTotal });

      return { ok: true, mensaje: 'Ganancias distribuidas exitosamente' };
    });
  } catch (err: any) {
    console.error('[distribuirGananciaLegacyAction] Error:', err);
    return { ok: false, mensaje: 'Error al distribuir ganancias' };
  }
}

/** Deposita a saldo del creador lo recaudado por un proyecto. Solo el creador. */
export async function depositarRecaudadoAction(
  idToken: string,
  proyectoId: string
): Promise<AccionInversionResult> {
  let usuario: UsuarioVerificado;
  try {
    usuario = await verificarIdToken(idToken);
  } catch (error) {
    return { ok: false, mensaje: mensajeErrorVerificacion(error) };
  }

  const db = getAdminDb();
  const docRef = db.collection('productos').doc(proyectoId);
  const creadorDocRef = db.collection('usuarios').doc(usuario.uid);

  try {
    return await db.runTransaction(async (tx) => {
      const productoSnap = await tx.get(docRef);
      if (!productoSnap.exists) return { ok: false, mensaje: 'Producto no encontrado' };

      const productoData = productoSnap.data()!;
      if (productoData.creador?.id !== usuario.uid) {
        return { ok: false, mensaje: 'Solo el creador del proyecto puede depositar lo recaudado.' };
      }
      if (productoData.depositoRecaudado) {
        return { ok: false, mensaje: 'Los fondos ya fueron retirados en otra transacción.' };
      }

      const creadorSnap = await tx.get(creadorDocRef);
      if (!creadorSnap.exists) return { ok: false, mensaje: 'Usuario no encontrado' };

      const saldoActual: number = creadorSnap.data()!.saldo || 0;
      const saldoRecaudado: Array<{ idProducto: string; monto: number }> = creadorSnap.data()!.saldoRecaudado || [];
      const idx = saldoRecaudado.findIndex((item) => item.idProducto === proyectoId);
      const montoFresco = idx !== -1 ? saldoRecaudado[idx].monto : 0;

      if (montoFresco <= 0) {
        return { ok: false, mensaje: 'No hay fondos recaudados pendientes de depositar para este proyecto.' };
      }

      const saldoRecaudadoActualizado = [...saldoRecaudado];
      saldoRecaudadoActualizado.splice(idx, 1);

      tx.update(creadorDocRef, { saldo: saldoActual + montoFresco, saldoRecaudado: saldoRecaudadoActualizado });
      tx.update(docRef, { depositoRecaudado: true });

      return { ok: true, mensaje: 'Fondos depositados a tu saldo' };
    });
  } catch (err: any) {
    console.error('[depositarRecaudadoAction] Error:', err);
    return { ok: false, mensaje: 'Error al depositar fondos' };
  }
}
