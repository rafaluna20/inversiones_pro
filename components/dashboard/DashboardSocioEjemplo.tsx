'use client';

/**
 * DASHBOARD SOCIO INVERSOR - COMPONENTE EJEMPLO
 * 
 * Dashboard empresarial con métricas, gráficas y KPIs
 * Utiliza Tremor para visualizaciones
 * 
 * Versión: 2.0 Enterprise
 * Fecha: 09/02/2026
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Metric,
  AreaChart,
  DonutChart,
  BarChart,
  BadgeDelta,
  Flex,
  Grid,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  ProgressBar,
  Badge
} from '@tremor/react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building,
  PiggyBank,
  Target,
  Calendar,
  Bell,
  FileText,
  BarChart3
} from 'lucide-react';

import { DashboardSocio, ProyectoBifasico, TipoAporte } from '@/types/enterprise';

// ============================================
// INTERFACES
// ============================================

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  trendText?: string;
  color?: 'blue' | 'emerald' | 'violet' | 'amber';
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function DashboardSocioEjemplo() {
  const [data, setData] = useState<DashboardSocio | null>(null);
  const [loading, setLoading] = useState(true);

  // Simular carga de datos (en producción vendría de API)
  useEffect(() => {
    const mockData: DashboardSocio = {
      usuario: {
        uid: 'user123',
        nombre: 'Juan Pérez',
        email: 'juan.perez@email.com',
        photoURL: 'https://via.placeholder.com/150'
      },
      resumen: {
        totalInvertido: 125000,
        numeroProyectos: 8,
        proyectosActivos: 5,
        proyectosCompletados: 3,
        gananciaTotal: 32500,
        roiPromedio: 26
      },
      misInversiones: [],
      misProyectos: [],
      notificacionesRecientes: [],
      graficas: {
        evolucionCartera: [
          { fecha: 'Ene 2026', valorTotal: 100000, ganancia: 0 },
          { fecha: 'Feb 2026', valorTotal: 110000, ganancia: 5000 },
          { fecha: 'Mar 2026', valorTotal: 125000, ganancia: 12500 },
          { fecha: 'Abr 2026', valorTotal: 145000, ganancia: 22000 },
          { fecha: 'May 2026', valorTotal: 157500, ganancia: 32500 }
        ],
        distribucionPorTipo: [
          { tipo: TipoAporte.TIERRA, cantidad: 3, porcentaje: 37.5 },
          { tipo: TipoAporte.CAPITAL, cantidad: 2, porcentaje: 25 },
          { tipo: TipoAporte.MIXTO, cantidad: 3, porcentaje: 37.5 }
        ],
        roiPorProyecto: [
          { proyectoNombre: 'Edificio Los Álamos', roiProyectado: 28, roiReal: 32 },
          { proyectoNombre: 'Residencial Vista Hermosa', roiProyectado: 22, roiReal: undefined },
          { proyectoNombre: 'Torre Empresarial', roiProyectado: 35, roiReal: 38 },
          { proyectoNombre: 'Condominio Los Pinos', roiProyectado: 20, roiReal: undefined },
          { proyectoNombre: 'Plaza Comercial Norte', roiProyectado: 25, roiReal: 24 }
        ]
      }
    };

    setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title className="text-3xl font-bold">Dashboard de Inversor</Title>
          <Text className="text-slate-600 dark:text-slate-400">
            Bienvenido, {data.usuario.nombre}
          </Text>
        </div>
        <div className="flex gap-3">
          <button className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <Bell size={20} />
          </button>
          <button className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <FileText size={20} />
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
        <StatsCard
          title="Capital Invertido"
          value={formatCurrency(data.resumen.totalInvertido)}
          icon={<DollarSign className="text-blue-600" />}
          trend={12.5}
          trendText="vs mes anterior"
          color="blue"
        />
        <StatsCard
          title="ROI Promedio"
          value={`${data.resumen.roiPromedio}%`}
          icon={<TrendingUp className="text-emerald-600" />}
          trend={3.2}
          trendText="vs promedio mercado"
          color="emerald"
        />
        <StatsCard
          title="Proyectos Activos"
          value={data.resumen.proyectosActivos}
          icon={<Building className="text-violet-600" />}
          trend={0}
          trendText={`${data.resumen.proyectosCompletados} completados`}
          color="violet"
        />
        <StatsCard
          title="Ganancia Total"
          value={formatCurrency(data.resumen.gananciaTotal)}
          icon={<PiggyBank className="text-amber-600" />}
          trend={25.8}
          trendText="vs inversión inicial"
          color="amber"
        />
      </Grid>

      {/* Gráficas Principales */}
      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        {/* Evolución de Cartera */}
        <Card className="shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="text-blue-600" size={24} />
            <Title>Evolución de tu Cartera</Title>
          </div>
          <Text className="mb-4 text-slate-600">
            Tracking del valor total y ganancias acumuladas
          </Text>
          <AreaChart
            className="h-80"
            data={data.graficas.evolucionCartera}
            index="fecha"
            categories={['valorTotal', 'ganancia']}
            colors={['blue', 'emerald']}
            valueFormatter={formatCurrency}
            yAxisWidth={65}
            showLegend
            showAnimation
            curveType="natural"
          />
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <Text className="text-sm text-blue-700 dark:text-blue-300">
              📈 Tu cartera ha crecido un <strong>57.5%</strong> en los últimos 5 meses
            </Text>
          </div>
        </Card>

        {/* Distribución por Tipo */}
        <Card className="shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Target className="text-violet-600" size={24} />
            <Title>Distribución de Inversiones</Title>
          </div>
          <Text className="mb-4 text-slate-600">
            Breakdown por tipo de aporte (Tierra, Capital, Mixto)
          </Text>
          <DonutChart
            className="h-80"
            data={data.graficas.distribucionPorTipo.map(item => ({
              name: getTipoLabel(item.tipo),
              value: item.cantidad,
              percentage: item.porcentaje
            }))}
            category="value"
            index="name"
            valueFormatter={(val) => `${val} proyectos`}
            colors={['blue', 'violet', 'amber']}
            showAnimation
            showLabel
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {data.graficas.distribucionPorTipo.map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                <Text className="text-xs text-slate-600">
                  {getTipoLabel(item.tipo)}
                </Text>
                <Metric className="text-lg">{item.porcentaje}%</Metric>
              </div>
            ))}
          </div>
        </Card>
      </Grid>

      {/* ROI por Proyecto */}
      <Card className="shadow-lg">
        <Title className="mb-4">ROI por Proyecto</Title>
        <Text className="mb-6 text-slate-600">
          Comparación entre ROI proyectado vs ROI real (proyectos finalizados)
        </Text>
        <BarChart
          className="h-80"
          data={data.graficas.roiPorProyecto}
          index="proyectoNombre"
          categories={['roiProyectado', 'roiReal']}
          colors={['blue', 'emerald']}
          valueFormatter={(val) => `${val}%`}
          yAxisWidth={48}
          showLegend
          showAnimation
          layout="vertical"
        />
      </Card>

      {/* Sección de Proyectos */}
      <Card className="shadow-lg">
        <TabGroup>
          <TabList className="mb-6">
            <Tab>Proyectos Activos ({data.resumen.proyectosActivos})</Tab>
            <Tab>Proyectos Completados ({data.resumen.proyectosCompletados})</Tab>
            <Tab>Todos ({data.resumen.numeroProyectos})</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <ProyectosGrid proyectos={mockProyectosActivos} />
            </TabPanel>
            <TabPanel>
              <ProyectosGrid proyectos={mockProyectosCompletados} />
            </TabPanel>
            <TabPanel>
              <ProyectosGrid proyectos={[...mockProyectosActivos, ...mockProyectosCompletados]} />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Card>

      {/* Notificaciones Recientes */}
      <Card className="shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="text-blue-600" size={24} />
          <Title>Notificaciones Recientes</Title>
        </div>
        <div className="space-y-3">
          {mockNotificaciones.map((notif, idx) => (
            <NotificacionCard key={idx} notificacion={notif} />
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function StatsCard({ title, value, icon, trend, trendText, color = 'blue' }: StatsCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/10 to-blue-600/5',
    emerald: 'from-emerald-500/10 to-emerald-600/5',
    violet: 'from-violet-500/10 to-violet-600/5',
    amber: 'from-amber-500/10 to-amber-600/5'
  };

  return (
    <Card className={`shadow-lg bg-gradient-to-br ${colorClasses[color]}`}>
      <Flex justifyContent="between" alignItems="start">
        <div>
          <Text className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</Text>
          <Metric className="text-3xl font-bold mt-2">{value}</Metric>
          {trend !== undefined && (
            <div className="mt-2">
              <BadgeDelta
                deltaType={trend > 0 ? 'increase' : trend < 0 ? 'decrease' : 'unchanged'}
                size="xs"
              >
                {trend > 0 ? '+' : ''}{trend}%
              </BadgeDelta>
              {trendText && (
                <Text className="text-xs text-slate-500 ml-2">{trendText}</Text>
              )}
            </div>
          )}
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          {icon}
        </div>
      </Flex>
    </Card>
  );
}

function ProyectosGrid({ proyectos }: { proyectos: any[] }) {
  return (
    <Grid numItemsSm={1} numItemsLg={2} className="gap-4">
      {proyectos.map((proyecto, idx) => (
        <Card key={idx} className="hover:shadow-xl transition-shadow cursor-pointer">
          <div className="flex gap-4">
            <img
              src={proyecto.imagen}
              alt={proyecto.nombre}
              className="w-24 h-24 rounded-lg object-cover"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <Title className="text-lg">{proyecto.nombre}</Title>
                <Badge color={proyecto.estado === 'activo' ? 'blue' : 'emerald'}>
                  {proyecto.estado}
                </Badge>
              </div>
              <Text className="text-sm text-slate-600 mb-3">{proyecto.ubicacion}</Text>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Text className="text-xs text-slate-500">Tu Inversión</Text>
                  <Text className="font-semibold">{formatCurrency(proyecto.miInversion)}</Text>
                </div>
                <div>
                  <Text className="text-xs text-slate-500">ROI</Text>
                  <Text className="font-semibold text-emerald-600">+{proyecto.roi}%</Text>
                </div>
              </div>
              <div className="mt-3">
                <Flex justifyContent="between" className="mb-1">
                  <Text className="text-xs">Progreso</Text>
                  <Text className="text-xs font-semibold">{proyecto.progreso}%</Text>
                </Flex>
                <ProgressBar value={proyecto.progreso} color="blue" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </Grid>
  );
}

function NotificacionCard({ notificacion }: { notificacion: any }) {
  const iconMap: Record<string, React.ReactNode> = {
    ganancia: <DollarSign className="text-emerald-600" size={20} />,
    hito: <Building className="text-blue-600" size={20} />,
    documento: <FileText className="text-violet-600" size={20} />,
    alerta: <Bell className="text-amber-600" size={20} />
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors">
      <div className="mt-1">{iconMap[notificacion.tipo]}</div>
      <div className="flex-1">
        <Text className="font-semibold">{notificacion.titulo}</Text>
        <Text className="text-sm text-slate-600">{notificacion.mensaje}</Text>
        <Text className="text-xs text-slate-400 mt-1">{notificacion.fecha}</Text>
      </div>
      {!notificacion.leida && (
        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
      )}
    </div>
  );
}

// ============================================
// UTILIDADES
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    tierra: 'Tierra',
    capital: 'Capital',
    mixto: 'Mixto'
  };
  return labels[tipo] || tipo;
}

// ============================================
// MOCK DATA
// ============================================

const mockProyectosActivos = [
  {
    nombre: 'Residencial Vista Hermosa',
    ubicacion: 'San Isidro, Lima',
    imagen: 'https://via.placeholder.com/100',
    estado: 'activo',
    miInversion: 25000,
    roi: 22,
    progreso: 45
  },
  {
    nombre: 'Condominio Los Pinos',
    ubicacion: 'Miraflores, Lima',
    imagen: 'https://via.placeholder.com/100',
    estado: 'activo',
    miInversion: 30000,
    roi: 20,
    progreso: 62
  },
  {
    nombre: 'Torre Empresarial Centro',
    ubicacion: 'San Borja, Lima',
    imagen: 'https://via.placeholder.com/100',
    estado: 'activo',
    miInversion: 40000,
    roi: 28,
    progreso: 38
  }
];

const mockProyectosCompletados = [
  {
    nombre: 'Edificio Los Álamos',
    ubicacion: 'Surco, Lima',
    imagen: 'https://via.placeholder.com/100',
    estado: 'completado',
    miInversion: 20000,
    roi: 32,
    progreso: 100
  },
  {
    nombre: 'Plaza Comercial Norte',
    ubicacion: 'Los Olivos, Lima',
    imagen: 'https://via.placeholder.com/100',
    estado: 'completado',
    miInversion: 15000,
    roi: 24,
    progreso: 100
  }
];

const mockNotificaciones = [
  {
    tipo: 'ganancia',
    titulo: '¡Ganancia Recibida!',
    mensaje: 'Has recibido S/ 6,400 del proyecto Edificio Los Álamos',
    fecha: 'Hace 2 horas',
    leida: false
  },
  {
    tipo: 'hito',
    titulo: 'Hito Completado',
    mensaje: 'Cimentación completada en Residencial Vista Hermosa',
    fecha: 'Hace 1 día',
    leida: false
  },
  {
    tipo: 'documento',
    titulo: 'Nuevo Documento',
    mensaje: 'Licencia de construcción subida a Torre Empresarial',
    fecha: 'Hace 2 días',
    leida: true
  },
  {
    tipo: 'alerta',
    titulo: 'Actualización de Timeline',
    mensaje: 'Nueva foto agregada al hito de acabados',
    fecha: 'Hace 3 días',
    leida: true
  }
];
