# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Sin publicar] - 2026-09-25

### 🔒 Seguridad e integridad del dinero (revisión completa)

Revisión a fondo del manejo de saldo. Ver `../PLAN_AKALLPA/01_REVISION_INVERSIONES_PRO.md` para el detalle.

#### 🐛 Corregido

- **El saldo ya no se puede escribir desde el navegador.** `usuarios.saldo` y
  `usuarios.saldoRecaudado` pasan a ser de solo-servidor en `firestore.rules`.
  Antes la regla dejaba al dueño escribir su propio saldo (para que la recarga
  se acreditara desde el cliente) y cualquiera podía fijarse el saldo que
  quisiera desde la consola y retirarlo a su billetera.
- **Modo demo / rutas "legacy" que creaban saldo desde el cliente**
  (`RecargarModeDemo`, retiro "demo" en `retirar-banco`, transferencia
  "legacy" en `transferir`): ahora son Server Actions con Admin SDK; el modo
  demo solo funciona con `PLATAFORMA_MODO_DEMO=true` en el servidor.
- **Recarga en dos pasos con el segundo en el navegador**: ahora
  `cargarAPlataformaAction` hace todo en el servidor con registro previo
  (`plataforma_cargas/{llave}` en `pending`), idempotencia por llave y una
  reserva de 60 s contra doble ejecución. Si no se puede confirmar, queda
  pendiente y se completa con `completarCargaPendienteAction`.
- **Retiro hacia la billetera creaba dinero ante un timeout**: si Odoo no
  respondía, se devolvía el saldo en Firebase aunque Odoo pudiera haberlo
  aplicado. Ahora solo se revierte si Odoo RECHAZA; si no se sabe, el retiro
  queda `pending` con los fondos retenidos (`completarRetiroPendienteAction`).
- **`eliminarInversionAction` creaba dinero** si el creador ya había depositado
  lo recaudado, y **`invertirEnProyectoAction` dejaba dinero atrapado** en ese
  caso: ambos se rechazan cuando el proyecto está liquidado o ya se depositó lo
  recaudado.
- **`aportarGanancia` (crear saldo de la nada) lo podía usar cualquier creador**
  con un proyecto propio y un cómplice como inversor: ahora solo administradores
  o `PLATAFORMA_MODO_DEMO=true`.
- **Liquidación legacy descuadraba céntimos**: el reparto ahora usa el método
  del mayor resto (`repartirEnCentavos`) y la suma pagada es exacta.
- **Reglas de `productos`**: el gestor ya no puede editar desde el navegador
  `inversores`, `estado`, `monto`, `depositoRecaudado`, `distribucionEjecutada`,
  `creador`; `precio` y `comisionGestor` solo mientras no haya inversores; un
  producto no puede crearse con inversores inventados o ya liquidado.
- **Reglas `plataforma_cargas` / `plataforma_retiros`**: solo lectura para el
  dueño (antes podía crear registros y modificar el monto de un retiro
  pendiente); nueva colección `plataforma_transferencias` (solo lectura).
- **Middleware**: `?token=cualquier-cosa` ya no sirve para saltarse la
  comprobación de sesión en las rutas de dinero de la billetera.
- **Votos**: el detalle del proyecto hacía `votos + 1` sobre un array de
  votantes, corrompiéndolo a texto; ahora usa `arrayUnion` como el resto de la app.
- Validación de montos en servidor (NaN, negativos, más de 2 decimales, topes).
- El registro de billetera exige 8 caracteres (igual que `wallet_digital`).

#### ✨ Agregado

- `lib/plataforma-saldo.ts`, `lib/odoo-wallet.ts`, `app/actions/plataforma-saldo.ts`.
- Reconciliación: detecta cargas `pending` atascadas (`carga_atascada`).
- Historial de movimientos: las cargas muestran su estado real (pendiente/fallido).
- `storage.rules`: propuesta de reglas de Firebase Storage (NO desplegada).
- `PLATAFORMA_MODO_DEMO` en `.env.example`.

#### 🗑️ Eliminado

- `Validacion/{sumarSaldo,restarSaldo,restarSaldoAcumulado,sumarSaldoAcumulado,restarSaldoGanancia,enviarGanancia,acreditarDesdeBilletera}.ts`:
  escribían saldo desde el navegador y ya no tienen llamadores.
- `loadPlatformBalanceAction` (reemplazada por `cargarAPlataformaAction`).

#### ⚠️ Antes de desplegar

1. `firestore.rules` cambió: probar en el Simulador de reglas y desplegar
   (`firebase deploy --only firestore:rules`) **junto** con el código nuevo — el código
   viejo escribe `saldo` desde el navegador y dejaría de funcionar con las reglas nuevas.
2. Para conservar el botón "Añadir saldo demo" en un entorno de PRUEBA:
   `PLATAFORMA_MODO_DEMO=true` (variable de servidor). Dejarla sin definir en producción.
3. Las Server Actions de dinero exigen `FIREBASE_SERVICE_ACCOUNT_KEY` en el hosting.

#### 🧪 Pruebas

- Unitarias: 98 → 128. Integración con emulador: 45 → 119 (carreras, idempotencia,
  fallos de red simulados, reglas de seguridad, conservación del dinero).

---

## [2.0.0] - 2026-05-30

### 🎉 Mejoras Mayores - Sistema de Gastos Transparente

#### ✨ Agregado

- **Sistema de Verificación de Gastos**
  - Nueva utilidad `lib/utils/verificarGastos.ts` para detectar y corregir inconsistencias
  - Función `verificarYCorregirTodo()` para auditoría automática de todos los proyectos
  - Función `verificarGastosProyecto()` para verificación individual
  - Función `corregirInconsistencias()` para corrección automática
  - Generación de reportes detallados en consola

- **Mejoras en Reportes de Cierre (ProjectClosureReport.tsx)**
  - Indicador visual "Sin Gastos Registrados" cuando `totalGastos === 0`
  - Alerta de "Gastos Elevados" cuando gastos > 25% del capital inicial
  - Sección "Desglose de Costos" ahora SIEMPRE visible (antes solo con gastos)
  - Nueva sección "Comparación: Impacto de Gastos" (Con gastos vs Sin gastos)
  - Cálculo de diferencia porcentual en ganancia y ROI
  - Verificación automática de totales al cargar el reporte
  - Auto-recálculo si se detectan inconsistencias (diferencia > S/ 1)

- **Documentación**
  - Nueva guía completa: `GUIA_VERIFICACION_GASTOS.md`
  - README actualizado con badges, estructura del proyecto y características
  - Documentación de uso de herramientas de verificación
  - Ejemplos de código para ejecutar desde consola del navegador

#### 🔧 Corregido

- **Bug Crítico:** Filtro de gastos usaba `estadoAprobacion` en lugar de `estado`
  - Ahora filtra correctamente: `g.estado === 'aprobado' || !g.estado`
  - Los gastos legacy sin campo `estado` se tratan como aprobados

- **Inconsistencia de Datos:** Totales de gastos desactualizados
  - Implementado `useEffect` que verifica totales al cargar reporte
  - Si detecta diferencia > S/ 1, ejecuta `recalcularTotalesGastos()` automáticamente
  - Logs informativos en consola para debugging

#### 🎨 Mejorado

- **Transparencia Financiera**
  - Desglose de costos siempre visible (incluso sin gastos)
  - Muestra "S/ 0.00" en gris cuando no hay gastos
  - Comparación lado a lado: escenario hipotético vs realidad
  - Cálculo de impacto porcentual de gastos en ganancia y ROI

- **UX del Reporte**
  - Iconos mejorados (Info, AlertTriangle, Receipt)
  - Colores semánticos: azul (info), ámbar (advertencia), rojo (crítico)
  - Tooltips y mensajes más descriptivos
  - Formato de moneda consistente en todo el reporte

- **PDF Generado**
  - Incluye todas las mejoras visuales del reporte en pantalla
  - Desglose de costos en formato empresarial
  - Tabla de gastos detallada con categorías
  - Alertas de impacto incluidas en el documento

#### 📊 Cambios Técnicos

- **Imports Agregados:**
  - `Info` de lucide-react
  - `recalcularTotalesGastos` de @/lib/firebase/gastos

- **Nuevos useEffect:**
  - Verificación de consistencia de totales (líneas 63-81)
  - Filtrado correcto de gastos aprobados (líneas 53-57)

- **Nuevas Secciones JSX:**
  - Indicador "Sin Gastos" (líneas 438-452)
  - Alerta "Gastos Elevados" (líneas 471-485)
  - Comparación "Con/Sin Gastos" (líneas 533-579)

#### 🔐 Seguridad

- Validación de permisos en funciones de verificación
- Logs auditables de todas las correcciones
- No se eliminan datos, solo se recalculan totales
- Tolerancia de S/ 0.01 para evitar falsos positivos por redondeo

---

## [1.0.0] - 2026-05-01

### Lanzamiento Inicial

#### Características Principales

- Sistema de inversión por cubos (1 cubo = 1% del proyecto)
- Modelo bifásico (tierra + construcción)
- Distribución de utilidades 10/90 (gestor/socios)
- Reportes PDF descargables
- Dashboard para gestores
- Billetera virtual integrada
- Sistema de gastos básico
- Autenticación con Firebase
- Mapas interactivos con ubicación de proyectos

---

## Tipos de Cambios

- `✨ Agregado` - para nuevas características
- `🔧 Corregido` - para corrección de bugs
- `🎨 Mejorado` - para mejoras en características existentes
- `🔐 Seguridad` - para correcciones de vulnerabilidades
- `📊 Cambios Técnicos` - para cambios internos sin impacto visible
- `🗑️ Eliminado` - para características removidas
- `⚠️ Deprecado` - para características que serán removidas

---

## Roadmap

### [2.1.0] - Próxima Versión (Planificado)

- [ ] Exportación de reportes a Excel
- [ ] Dashboard analítico para gestores
- [ ] Sistema de notificaciones push
- [ ] Workflow de aprobación de gastos multi-nivel
- [ ] Optimización de imágenes con Next.js Image
- [ ] PWA (Progressive Web App)

### [3.0.0] - Futuro (En Consideración)

- [ ] Integración con pasarelas de pago (Yape, Plin, Mercado Pago)
- [ ] Sistema de referidos
- [ ] Internacionalización (i18n)
- [ ] Modo oscuro/claro
- [ ] Testing automatizado (cobertura 70%+)
- [ ] Blockchain para contratos inteligentes

---

**Mantenido por:** Rafael Luna  
**Última actualización:** 30 de Mayo, 2026
