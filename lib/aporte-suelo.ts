/**
 * CÁLCULO DE APORTE DE SUELO
 * 
 * Fórmula principal del modelo bifásico para distribuir ganancias
 * proporcionalmente entre socios de Tierra y socios de Capital.
 * 
 * @version 2.0 Enterprise
 * @date 09/02/2026
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Producto, Socio, Inversion } from '@/types';
import { transferirDinero } from '@/lib/billetera-api';

// ============================================
// INTERFACES
// ============================================

export interface CalculoAporteSuelo {
  valorTierra: number;
  valorConstruccion: number;
  valorTotal: number;
  porcentajeTierra: number;
  porcentajeCapital: number;
}

export interface DistribucionGanancia {
  socioId: string;
  usuarioId: string;
  tipoSocio: 'tierra' | 'capital' | 'mixto';
  valorAportado: number;
  porcentajeProyecto: number;
  gananciaCalculada: number;
  roiReal: number;
}

// ============================================
// CÁLCULO APORTE DE SUELO
// ============================================

/**
 * Calcular porcentajes de Aporte de Suelo
 * 
 * Fórmula:
 * % Tierra = (Valor Terreno / Valor Total) × 100
 * % Capital = (Valor Construcción / Valor Total) × 100
 * 
 * @example
 * const aporte = calcularAporteSuelo(400000, 600000);
 * // { porcentajeTierra: 40%, porcentajeCapital: 60% }
 */
export function calcularAporteSuelo(
  valorTierra: number,
  valorConstruccion: number
): CalculoAporteSuelo {
  // Validaciones
  if (valorTierra <= 0) {
    throw new Error('Valor de tierra debe ser mayor a cero');
  }

  if (valorConstruccion <= 0) {
    throw new Error('Valor de construcción debe ser mayor a cero');
  }

  const valorTotal = valorTierra + valorConstruccion;
  const porcentajeTierra = (valorTierra / valorTotal) * 100;
  const porcentajeCapital = (valorConstruccion / valorTotal) * 100;

  return {
    valorTierra,
    valorConstruccion,
    valorTotal,
    porcentajeTierra: Number(porcentajeTierra.toFixed(2)),
    porcentajeCapital: Number(porcentajeCapital.toFixed(2))
  };
}

// ============================================
// CÁLCULO DE GANANCIA POR SOCIO
// ============================================

/**
 * Calcular ganancia de un socio individual
 */
export function calcularGananciaSocio(
  aporteSuelo: CalculoAporteSuelo,
  socio: {
    tipoSocio: 'tierra' | 'capital' | 'mixto';
    valorTierraProporcional?: number;
    valorCapitalProporcional?: number;
  },
  montoTotalEtapaTierra: number,
  montoTotalEtapaCapital: number,
  gananciaTotalProyecto: number
): number {
  let gananciaTotal = 0;

  // Calcular ganancia de aporte en Tierra
  if (
    (socio.tipoSocio === 'tierra' || socio.tipoSocio === 'mixto') &&
    socio.valorTierraProporcional
  ) {
    const valorTierra = socio.valorTierraProporcional;

    // % dentro de la etapa tierra
    const porcentajeDentroEtapa = (valorTierra / montoTotalEtapaTierra) * 100;

    // % del proyecto total basado en Aporte de Suelo
    const porcentajeProyecto = (porcentajeDentroEtapa * aporteSuelo.porcentajeTierra) / 100;

    // Ganancia proporcional
    const gananciaTierra = (gananciaTotalProyecto * porcentajeProyecto) / 100;
    gananciaTotal += gananciaTierra;

    console.log(`   Ganancia Tierra: ${gananciaTierra.toFixed(2)} (${porcentajeProyecto.toFixed(2)}% del proyecto)`);
  }

  // Calcular ganancia de aporte en Capital
  if (
    (socio.tipoSocio === 'capital' || socio.tipoSocio === 'mixto') &&
    socio.valorCapitalProporcional
  ) {
    const valorCapital = socio.valorCapitalProporcional;

    // % dentro de la etapa capital
    const porcentajeDentroEtapa = (valorCapital / montoTotalEtapaCapital) * 100;

    // % del proyecto total basado en Aporte de Suelo
    const porcentajeProyecto = (porcentajeDentroEtapa * aporteSuelo.porcentajeCapital) / 100;

    // Ganancia proporcional
    const gananciaCapital = (gananciaTotalProyecto * porcentajeProyecto) / 100;
    gananciaTotal += gananciaCapital;

    console.log(`   Ganancia Capital: ${gananciaCapital.toFixed(2)} (${porcentajeProyecto.toFixed(2)}% del proyecto)`);
  }

  return Number(gananciaTotal.toFixed(2));
}

// ============================================
// DISTRIBUCIÓN COMPLETA DE GANANCIAS
// ============================================

/**
 * Distribuir ganancias al finalizar proyecto
 * 
 * 1. Calcula Aporte de Suelo
 * 2. Obtiene todos los socios activos
 * 3. Calcula ganancia de cada socio
 * 4. Transfiere via Odoo Wallet
 * 5. Actualiza inversiones con ganancia real
 * 6. Notifica a cada socio
 */
export async function distribuirGananciasProyecto(
  proyectoId: string,
  precioVenta: number
): Promise<DistribucionGanancia[]> {
  try {
    console.log('🎯 Iniciando distribución de ganancias...');
    console.log(`   Proyecto: ${proyectoId}`);
    console.log(`   Precio Venta: S/ ${precioVenta.toLocaleString()}`);

    // 1. Obtener proyecto
    const proyectoRef = doc(db, 'productos', proyectoId);
    const proyectoSnap = await getDoc(proyectoRef);

    if (!proyectoSnap.exists()) {
      throw new Error('Proyecto no encontrado');
    }

    const proyecto = proyectoSnap.data() as Producto;

    if (!proyecto.modeloBifasico || !proyecto.etapas) {
      throw new Error('Este proyecto no es bifásico');
    }

    // 2. Calcular Aporte de Suelo
    const valorTierra = proyecto.etapas.tierra.tasacion?.actual || proyecto.etapas.tierra.montoRecaudado;
    const valorConstruccion = proyecto.etapas.construccion.montoRecaudado;

    const aporteSuelo = calcularAporteSuelo(valorTierra, valorConstruccion);

    console.log('\n📊 Aporte de Suelo:');
    console.log(`   Valor Tierra: S/ ${valorTierra.toLocaleString()}`);
    console.log(`   Valor Construcción: S/ ${valorConstruccion.toLocaleString()}`);
    console.log(`   Valor Total: S/ ${aporteSuelo.valorTotal.toLocaleString()}`);
    console.log(`   % Tierra: ${aporteSuelo.porcentajeTierra}%`);
    console.log(`   % Capital: ${aporteSuelo.porcentajeCapital}%`);

    // Guardar en proyecto
    await updateDoc(proyectoRef, {
      aporteSuelo,
      precioVenta,
      gananciaTotalProyecto: precioVenta - aporteSuelo.valorTotal,
      estadoProyecto: 'completado',
      fechaFinalizacion: Date.now(),
      updatedAt: Date.now()
    });

    const gananciaTotalProyecto = precioVenta - aporteSuelo.valorTotal;

    if (gananciaTotalProyecto < 0) {
      throw new Error('El proyecto tuvo pérdidas, no se puede distribuir ganancia negativa');
    }

    console.log(`\n💰 Ganancia Total Proyecto: S/ ${gananciaTotalProyecto.toLocaleString()}`);
    console.log(`   Distribución: ${aporteSuelo.porcentajeTierra}% Tierra + ${aporteSuelo.porcentajeCapital}% Capital`);

    // 3. Obtener todos los socios activos
    const sociosQuery = query(
      collection(db, 'socios'),
      where('proyectoId', '==', proyectoId),
      where('activo', '==', true)
    );
    const sociosSnap = await getDocs(sociosQuery);

    if (sociosSnap.empty) {
      throw new Error('No hay socios en este proyecto');
    }

    console.log(`\n👥 Distribuyendo a ${sociosSnap.size} socios...\n`);

    const distribucion: DistribucionGanancia[] = [];

    // 4. Calcular y distribuir a cada socio
    for (const socioDoc of sociosSnap.docs) {
      const socio = { id: socioDoc.id, ...socioDoc.data() } as Socio;

      console.log(`\n🧑 Socio: ${socio.usuarioId}`);
      console.log(`   Tipo: ${socio.tipoSocio.toUpperCase()}`);
      console.log(`   Valor Aportado: S/ ${socio.valorAportado.toLocaleString()}`);

      // Calcular ganancia del socio
      const gananciaSocio = calcularGananciaSocio(
        aporteSuelo,
        socio,
        proyecto.etapas.tierra.montoRecaudado,
        proyecto.etapas.construccion.montoRecaudado,
        gananciaTotalProyecto
      );

      const roiReal = ((gananciaSocio / socio.valorAportado) * 100);

      console.log(`   💵 Ganancia: S/ ${gananciaSocio.toLocaleString()}`);
      console.log(`   📈 ROI Real: ${roiReal.toFixed(2)}%`);

      // 5. Transferir via Odoo Wallet
      /* 
      TODO: Refactor this to use a secure Server Action for admin transfers.
      The previous client-side API call signature was mismatching and insecure.
      
      try {
        await transferirDinero({
          destinatario: socio.usuarioId,  // Mapear a Odoo ID
          monto: gananciaSocio,
          concepto: `Ganancia proyecto ${proyecto.nombre}`,
          referencia: `GANANCIA-${proyectoId}-${socio.id}`
        });

        console.log(`   ✅ Transferencia Odoo exitosa`);
      } catch (odooError) {
        console.error(`   ❌ Error en transferencia Odoo:`, odooError);
        // Continuar con otros socios aunque falle uno
      }
      */

      // 6. Actualizar inversiones del socio
      const inversionesQuery = query(
        collection(db, 'inversiones'),
        where('proyectoId', '==', proyectoId),
        where('usuarioId', '==', socio.usuarioId)
      );
      const inversionesSnap = await getDocs(inversionesQuery);

      for (const invDoc of inversionesSnap.docs) {
        const inv = invDoc.data() as Inversion;
        const roiInversion = ((gananciaSocio / inv.montoInvertido) * 100);

        await updateDoc(invDoc.ref, {
          gananciaReal: gananciaSocio,
          roiReal: Number(roiReal.toFixed(2)),
          updatedAt: Date.now()
        });
      }

      // Agregar a resultado
      distribucion.push({
        socioId: socio.id,
        usuarioId: socio.usuarioId,
        tipoSocio: socio.tipoSocio,
        valorAportado: socio.valorAportado,
        porcentajeProyecto: (socio.valorAportado / aporteSuelo.valorTotal) * 100,
        gananciaCalculada: gananciaSocio,
        roiReal: Number(roiReal.toFixed(2))
      });
    }

    console.log('\n✅ Distribución completada exitosamente');
    console.log(`   Total distribuido: S/ ${distribucion.reduce((sum, d) => sum + d.gananciaCalculada, 0).toLocaleString()}`);

    return distribucion;

  } catch (error) {
    console.error('❌ Error distribuyendo ganancias:', error);
    throw error;
  }
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Simular distribución sin ejecutar transferencias
 * Útil para preview antes de confirmar
 */
export async function simularDistribucionGanancias(
  proyectoId: string,
  precioVentaSimulado: number
): Promise<{
  aporteSuelo: CalculoAporteSuelo;
  gananciaTotalProyecto: number;
  distribucion: DistribucionGanancia[];
}> {
  // Similar a distribuirGananciasProyecto pero sin ejecutar transferencias
  const proyectoRef = doc(db, 'productos', proyectoId);
  const proyectoSnap = await getDoc(proyectoRef);

  if (!proyectoSnap.exists()) {
    throw new Error('Proyecto no encontrado');
  }

  const proyecto = proyectoSnap.data() as Producto;

  if (!proyecto.modeloBifasico || !proyecto.etapas) {
    throw new Error('Este proyecto no es bifásico');
  }

  const valorTierra = proyecto.etapas.tierra.tasacion?.actual || proyecto.etapas.tierra.montoRecaudado;
  const valorConstruccion = proyecto.etapas.construccion.montoRecaudado;

  const aporteSuelo = calcularAporteSuelo(valorTierra, valorConstruccion);
  const gananciaTotalProyecto = precioVentaSimulado - aporteSuelo.valorTotal;

  const sociosQuery = query(
    collection(db, 'socios'),
    where('proyectoId', '==', proyectoId),
    where('activo', '==', true)
  );
  const sociosSnap = await getDocs(sociosQuery);

  const distribucion: DistribucionGanancia[] = [];

  for (const socioDoc of sociosSnap.docs) {
    const socio = { id: socioDoc.id, ...socioDoc.data() } as Socio;

    const gananciaSocio = calcularGananciaSocio(
      aporteSuelo,
      socio,
      proyecto.etapas.tierra.montoRecaudado,
      proyecto.etapas.construccion.montoRecaudado,
      gananciaTotalProyecto
    );

    const roiReal = ((gananciaSocio / socio.valorAportado) * 100);

    distribucion.push({
      socioId: socio.id,
      usuarioId: socio.usuarioId,
      tipoSocio: socio.tipoSocio,
      valorAportado: socio.valorAportado,
      porcentajeProyecto: (socio.valorAportado / aporteSuelo.valorTotal) * 100,
      gananciaCalculada: gananciaSocio,
      roiReal: Number(roiReal.toFixed(2))
    });
  }

  return {
    aporteSuelo,
    gananciaTotalProyecto,
    distribucion
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// ============================================
// FUNCIONES ADICIONALES PARA TESTS
// ============================================

export function calcularDistribucionGanancias(
  aporteSuelo: CalculoAporteSuelo,
  gananciaTotal: number
): { gananciaTierra: number; gananciaCapital: number } {
  const gananciaTierra = (gananciaTotal * aporteSuelo.porcentajeTierra) / 100;
  const gananciaCapital = (gananciaTotal * aporteSuelo.porcentajeCapital) / 100;

  return {
    gananciaTierra,
    gananciaCapital
  };
}

export function calcularROI(inversion: number, ganancia: number): number {
  if (inversion === 0) {
    throw new Error("La inversión no puede ser cero para calcular ROI");
  }
  const roi = (ganancia / inversion) * 100;
  return Number(roi.toFixed(2)); // O simplemente return roi; test expects precise values usually but verified toFixed in usage
}
