# 🏢 InversionesPro - Plataforma de Crowdfunding Inmobiliario

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-9.22-orange)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

## 🎯 Descripción

Plataforma empresarial para inversión colectiva en proyectos inmobiliarios con características avanzadas:

- 💰 **Sistema bifásico** (tierra + construcción)
- 📊 **Gestión de gastos** y contabilidad real con transparencia total
- 🔄 **Distribución automática** de utilidades (modelo 10/90)
- 📄 **Reportes financieros** profesionales en PDF
- 🎯 **ROI real** calculado considerando todos los costos
- 🔐 **Seguridad empresarial** con validación Zod y rate limiting

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** React 19
- **Lenguaje:** TypeScript 5.9
- **Estilos:** Tailwind CSS 3.4
- **Animaciones:** Framer Motion
- **Iconos:** React Icons, Lucide React

### Backend
- **Base de Datos:** Firebase Firestore
- **Autenticación:** Firebase Auth
- **Storage:** Firebase Storage
- **Validación:** Zod
- **Logging:** Winston

### Herramientas
- **Mapas:** React Leaflet, Google Maps API
- **Gráficos:** Tremor React
- **PDF:** jsPDF
- **Testing:** Jest, React Testing Library

---

## 📁 Estructura del Proyecto

```
inversiones/
├── app/                    # Páginas y rutas (App Router)
│   ├── (auth)/            # Rutas de autenticación
│   ├── productos/         # Gestión de proyectos
│   ├── billetera/         # Sistema de billetera virtual
│   ├── gestor/            # Dashboard de gestores
│   └── mis-inversiones/   # Portfolio del inversor
├── components/            # Componentes reutilizables
│   ├── productos/         # Componentes de proyectos
│   ├── gestor/            # Componentes de gestión
│   └── ui/                # Componentes UI genéricos
├── Hooks/                 # Custom hooks
├── lib/                   # Utilidades y configuración
│   ├── firebase/          # Funciones de Firebase
│   ├── security/          # Validación y seguridad
│   └── utils/             # Utilidades generales
├── types/                 # Definiciones TypeScript
├── Validacion/            # Lógica de negocio
└── public/                # Assets estáticos
```

---

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase

### Pasos

1. **Clonar el repositorio**
```bash
git clone https://github.com/rafaluna20/inversiones_pro.git
cd inversiones
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Google Maps (opcional)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_google_maps_key
```

4. **Ejecutar en desarrollo**
```bash
npm run dev
```

5. **Abrir en el navegador**
```
http://localhost:3000
```

---

## 📊 Características Principales

### 1. Sistema de Gastos Transparente

- ✅ Registro detallado de gastos por categoría
- ✅ Cálculo automático de ROI real (considerando gastos)
- ✅ Reportes con desglose financiero completo
- ✅ Comparación "Con gastos vs Sin gastos"
- ✅ Alertas de gastos elevados (>25% del capital)

**Ver:** [Guía de Verificación de Gastos](./GUIA_VERIFICACION_GASTOS.md)

### 2. Modelo Bifásico

- **Fase 1 - Tierra:** Inversión en terreno
- **Fase 2 - Construcción:** Desarrollo del proyecto
- Tracking independiente de cada fase
- Cálculo de plusvalía por etapa

### 3. Distribución de Utilidades

- **Modelo 10/90:** 10% comisión gestor, 90% para socios
- Distribución proporcional según participación
- Reportes auditables con hash SHA-256
- Historial completo de distribuciones

### 4. Reportes Profesionales

- PDF descargables con diseño empresarial
- Desglose completo de costos y ganancias
- Tabla de inversores con participaciones
- Código de operación único
- Exportación a Excel (próximamente)

---

## 🔐 Seguridad

- ✅ Validación de inputs con Zod
- ✅ Sanitización contra XSS
- ✅ Rate limiting con Redis
- ✅ RBAC (Role-Based Access Control)
- ✅ Encriptación de datos sensibles
- ✅ Auditoría de operaciones críticas

---

## 📖 Documentación Adicional

- [Análisis Crítico de Gastos](./ANALISIS_CRITICO_GASTOS_PROYECTOS.md)
- [Análisis de Gastos en Reportes](./ANALISIS_GASTOS_EN_REPORTES.md)
- [Guía de Verificación de Gastos](./GUIA_VERIFICACION_GASTOS.md)

---

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con cobertura
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

---

## 🏗️ Build para Producción

```bash
# Crear build optimizado
npm run build

# Ejecutar build
npm start
```

---

## 📝 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Ejecutar build de producción |
| `npm run lint` | Linter de código |
| `npm test` | Ejecutar tests |

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es privado y confidencial.

---

## 👥 Equipo

- **Desarrollo:** Rafael Luna
- **Repositorio:** [github.com/rafaluna20/inversiones_pro](https://github.com/rafaluna20/inversiones_pro)

---

## 📞 Soporte

Para reportar bugs o solicitar features, usa el sistema de issues de GitHub o contacta al equipo de desarrollo.

---

**Última actualización:** 30 de Mayo, 2026  
**Versión:** 2.0.0
