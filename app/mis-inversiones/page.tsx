'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useProductos from '@/Hooks/useProductos';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useMisInversiones from '@/Hooks/useMisInversiones';
import ProductCard from '@/components/productos/ProductCard';
import ConsolidatedPortfolioReport from '@/components/mis-inversiones/ConsolidatedPortfolioReport';
import { FaChartLine, FaWallet, FaCheckCircle, FaChartPie } from 'react-icons/fa';
import PanelParticipacion from '@/components/mis-inversiones/PanelParticipacion';

export default function MisInversionesPage() {
  const { productos } = useProductos('creado');
  const { usuario, loading } = useAutenticacion();
  const [inversiones, setInversiones] = useState<any[]>([]);
  const [tabActiva, setTabActiva] = useState<'activas' | 'liquidadas'>('activas');

  // ✅ CRÍTICO: Todos los hooks deben ir ANTES de cualquier early return
  // Se pasa '' cuando no hay usuario; el hook maneja este caso internamente
  const { inversiones: inversionesReales, loading: loadingInversiones } = useMisInversiones(usuario?.uid || '');

  useEffect(() => {
    if (usuario && productos.length > 0) {
      const misInversiones = productos.filter((producto: any) => {
        return producto.inversores?.some(
          (inversor: any) => inversor.usuarioId === usuario.uid
        );
      });
      setInversiones(misInversiones);
    }
  }, [usuario, productos]);

  // --- EARLY RETURNS (SIEMPRE DESPUÉS DE TODOS LOS HOOKS) ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin blur-[1px]"></div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
            <FaChartLine className="text-3xl text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 font-roboto-slab">Acceso Restringido</h2>
          <p className="text-gray-400 mb-8">Debes iniciar sesión para monitorear el rendimiento de tus inversiones.</p>
          <Link
            href="/login"
            className="inline-flex w-full justify-center py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  // --- CÁLCULOS DEL PORTAFOLIO (ENTERPRISE) ---
  let capitalTotalInvertido = 0;
  let gananciasNetasHistoricas = 0;
  let sumaRoiPonderado = 0;
  let totalInvertidoConfirmado = 0;

  // Mezclar inversiones de Firestore con inversiones legacy (las que solo existen en producto.inversores)
  const inversionesCompletas = [...inversionesReales];
  inversiones.forEach((producto) => {
    if (!inversionesCompletas.some(inv => inv.proyectoId === producto.id)) {
      const legacyInv = producto.inversores?.find((i: any) => i.usuarioId === usuario.uid);
      if (legacyInv) {
        const capitalTotal = Number(producto.precio || producto.monto || 0);
        const cubos = Number(legacyInv.cubos || 0);
        const montoInvertido = (cubos * capitalTotal) / 100;
        const roiProyectado = Number(producto.roi || 15);
        
        let gananciaReal = 0;
        let roiReal: number | undefined = undefined;
        if (producto.distribucionEjecutada || producto.estado === false) {
          // El 'monto' actualizado en la DB contiene el 'valorVenta' (Capital + Plusvalía) al momento de liquidar
          const valorVentaTotal = Number(producto.monto || producto.precio || 0);
          const capitalOriginal = Number(producto.precio || 0);
          
          // La distribución se hace proporcional al total de cubos vendidos realmente
          const totalCubosVendidos = producto.inversores?.reduce((sum: number, inv: any) => sum + Number(inv.cubos || 0), 0) || 100;
          const porcentajeParticipacion = totalCubosVendidos > 0 ? (cubos / totalCubosVendidos) : 0;
          
          const gastosTotales = Number(producto.totalGastos || 0);
          const gananciaTotalProyecto = (valorVentaTotal - capitalOriginal) - gastosTotales;
          
          gananciaReal = gananciaTotalProyecto * porcentajeParticipacion;
          roiReal = montoInvertido > 0 ? (gananciaReal / montoInvertido) * 100 : 0;
        }

        inversionesCompletas.push({
          id: `legacy-${producto.id}`,
          proyectoId: producto.id,
          usuarioId: usuario.uid,
          montoInvertido,
          confirmada: true,
          roiProyectado,
          gananciaReal,
          gananciaEstimada: montoInvertido * (roiProyectado / 100),
          cubosComprados: cubos,
          fechaInversion: producto.creado || Date.now(),
          roiReal,
        } as any);
      }
    }
  });

  // Filtrar inversiones confirmadas
  const inversionesConfirmadas = inversionesCompletas.filter(inv => inv.confirmada !== false);

  inversionesConfirmadas.forEach((inv) => {
    capitalTotalInvertido += Number(inv.montoInvertido || 0);
    gananciasNetasHistoricas += Number(inv.gananciaReal || 0);

    // ROI Ponderado por el capital invertido en cada proyecto
    const roiActivo = Number(inv.roiReal || inv.roiProyectado || 0);
    sumaRoiPonderado += Number(inv.montoInvertido || 0) * roiActivo;
    totalInvertidoConfirmado += Number(inv.montoInvertido || 0);
  });

  const roiPromedioPonderado = totalInvertidoConfirmado > 0
    ? (sumaRoiPonderado / totalInvertidoConfirmado)
    : 0;

  // TIR Estimada Anualizada ponderada basada en ROI y liquidez
  const tirEstimadaPonderada = roiPromedioPonderado * 0.92;

  // Filtrado de proyectos para renderizar ProductCard en pantalla (UI)
  const proyectosActivos = inversiones.filter(p => p.estado !== false);
  const proyectosLiquidados = inversiones.filter(p => p.estado === false);

  const formatCurrency = (n: number) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">

        {/* ENCABEZADO Y BOTÓN PDF */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="border-l-4 border-blue-500 pl-6">
            <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab">Mi Portafolio</h1>
            <p className="text-gray-400 text-lg">Monitorea y gestiona tus inversiones corporativas</p>
          </div>
          {inversiones.length > 0 && (
            <ConsolidatedPortfolioReport
              usuario={{ uid: usuario.uid, nombre: usuario.displayName || 'Inversor', email: usuario.email || undefined }}
              proyectos={inversiones}
              inversiones={inversionesCompletas}
              metricas={{
                capitalTotalInvertido,
                gananciasNetasHistoricas,
                roiPonderado: roiPromedioPonderado,
                tirPonderada: tirEstimadaPonderada
              }}
            />
          )}
        </div>

        {inversiones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[32px] text-center p-8">
            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
              <span className="text-6xl">🌱</span>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4 font-roboto-slab">
              Aún no tienes inversiones
            </h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-lg">
              Tu portafolio está vacío. Comienza a invertir en proyectos inmobiliarios de alto rendimiento hoy mismo.
            </p>
            <Link
              href="/"
              className="inline-flex py-4 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-900/20"
            >
              Explorar Proyectos
            </Link>
          </div>
        ) : (
          <>
            {/* DASHBOARD KPIs ENTERPRISE */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* KPI 1: Capital Desplegado */}
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                    <FaWallet className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-medium">Capital Total Invertido</p>
                    <h3 className="text-xl font-bold text-white font-mono">
                      {loadingInversiones ? '—' : formatCurrency(capitalTotalInvertido)}
                    </h3>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500">Histórico acumulado en plataforma</div>
              </div>

              {/* KPI 2: Ganancias Netas */}
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
                <div className="flex items-center gap-4 mb-4 relative z-10">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                    <FaChartLine className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-medium">Ganancias Reales</p>
                    <h3 className="text-xl font-bold text-emerald-400 font-mono">
                      {loadingInversiones ? '—' : `+${formatCurrency(gananciasNetasHistoricas)}`}
                    </h3>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-500/70 relative z-10">Retornos efectivos distribuidos</div>
              </div>

              {/* KPI 3: ROI Ponderado */}
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                    <FaChartPie className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-medium">ROI Promedio Ponderado</p>
                    <h3 className="text-xl font-bold text-purple-400 font-mono">
                      {loadingInversiones ? '—' : `${roiPromedioPonderado.toFixed(2)}%`}
                    </h3>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500">Rentabilidad ajustada al capital</div>
              </div>

              {/* KPI 4: TIR Ponderada */}
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                    <FaChartLine className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-medium">TIR Ponderada Anual</p>
                    <h3 className="text-xl font-bold text-indigo-400 font-mono">
                      {loadingInversiones ? '—' : `${tirEstimadaPonderada.toFixed(2)}%`}
                    </h3>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500">Rendimiento anualizado estimado</div>
              </div>
            </div>

            {/* TABS DE PROYECTOS */}
            <div className="mt-8">
              <div className="flex border-b border-white/10 mb-6">
                <button
                  onClick={() => setTabActiva('activas')}
                  className={`px-6 py-4 font-semibold text-sm transition-all border-b-2 ${
                    tabActiva === 'activas'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Proyectos en Curso ({proyectosActivos.length})
                  </span>
                </button>
                <button
                  onClick={() => setTabActiva('liquidadas')}
                  className={`px-6 py-4 font-semibold text-sm transition-all border-b-2 ${
                    tabActiva === 'liquidadas'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FaCheckCircle />
                    Historial Liquidado ({proyectosLiquidados.length})
                  </span>
                </button>
              </div>

              {/* LISTA DE PROYECTOS */}
              <div>
                {/* PROYECTOS ACTIVOS */}
                {tabActiva === 'activas' && proyectosActivos.length === 0 && (
                  <div className="py-12 text-center text-gray-500">
                    No tienes proyectos en curso actualmente.
                  </div>
                )}
                {tabActiva === 'activas' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {proyectosActivos.map((producto) => {
                      // Buscar la inversión real del usuario en este proyecto (incluyendo legacy)
                      const miInversionReal = inversionesCompletas.find(
                        (inv) => inv.proyectoId === producto.id && inv.confirmada !== false
                      );

                      return (
                        <div key={producto.id} className="space-y-4 bg-slate-900/30 p-5 rounded-[28px] border border-white/5 flex flex-col justify-between h-full backdrop-blur-sm">
                          <ProductCard producto={producto} usuarioId={usuario.uid} />
                          {miInversionReal && (
                            <div className="mt-auto pt-2">
                              <PanelParticipacion
                                proyectoNombre={producto.nombre}
                                capitalTotalProyecto={Number(producto.precio || producto.monto || 0)}
                                miInversion={Number(miInversionReal.montoInvertido || 0)}
                                miParticipacionReal={miInversionReal.porcentajeParticipacion}
                                comisionGestor={Number(producto.comisionGestor || 10)}
                                estaLiquidado={false}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* PROYECTOS LIQUIDADOS */}
                {tabActiva === 'liquidadas' && proyectosLiquidados.length === 0 && (
                  <div className="py-12 text-center text-gray-500">
                    Aún no tienes proyectos finalizados.
                  </div>
                )}
                {tabActiva === 'liquidadas' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {proyectosLiquidados.map((producto) => {
                      const miInversionReal = inversionesCompletas.find(
                        (inv) => inv.proyectoId === producto.id && inv.confirmada !== false
                      );

                      return (
                        <div key={producto.id} className="space-y-4 bg-slate-900/30 p-5 rounded-[28px] border border-white/5 flex flex-col justify-between h-full backdrop-blur-sm">
                          <ProductCard producto={producto} usuarioId={usuario.uid} />
                          {miInversionReal && (
                            <div className="mt-auto pt-2">
                              <PanelParticipacion
                                proyectoNombre={producto.nombre}
                                capitalTotalProyecto={Number(producto.precio || producto.monto || 0)}
                                miInversion={Number(miInversionReal.montoInvertido || 0)}
                                miParticipacionReal={miInversionReal.porcentajeParticipacion}
                                miGananciaReal={miInversionReal.gananciaReal}
                                comisionGestor={Number(producto.comisionGestor || 10)}
                                utilidadNeta={Number(producto.utilidadNeta || 0)}
                                estaLiquidado={producto.distribucionEjecutada === true || producto.estado === false}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
