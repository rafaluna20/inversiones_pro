# 📋 Guía de Verificación y Corrección de Gastos

## 🎯 Propósito

Esta guía te ayudará a verificar que todos los gastos de tus proyectos estén correctamente calculados y reflejados en los reportes financieros.

---

## 🔍 ¿Cuándo usar esta herramienta?

Usa la herramienta de verificación cuando:

- ✅ Agregaste gastos a un proyecto pero no se reflejan en el reporte
- ✅ Los totales de gastos parecen incorrectos
- ✅ El ROI mostrado no coincide con tus cálculos manuales
- ✅ Después de migrar datos o hacer cambios masivos en la base de datos
- ✅ Como parte de una auditoría mensual

---

## 🛠️ Método 1: Verificación Automática (Recomendado)

### Paso 1: Abrir la consola del navegador

1. Ve a tu aplicación en el navegador
2. Presiona `F12` o `Ctrl+Shift+I` (Windows/Linux) o `Cmd+Option+I` (Mac)
3. Ve a la pestaña **Console**

### Paso 2: Ejecutar el script de verificación

Copia y pega este código en la consola:

```javascript
// Importar la función de verificación
const { verificarYCorregirTodo } = await import('/lib/utils/verificarGastos');

// Ejecutar verificación y corrección automática
await verificarYCorregirTodo();
```

### Paso 3: Revisar el reporte

El script mostrará un reporte como este:

```
📊 REPORTE DE VERIFICACIÓN DE GASTOS

═══════════════════════════════════════════════════════════════════════════════

✅ Proyectos correctos: 15
⚠️  Proyectos con inconsistencias: 2

⚠️  PROYECTOS CON INCONSISTENCIAS:

───────────────────────────────────────────────────────────────────────────────

Proyecto: Terreno Lima Norte (abc123xyz)
  Gastos en subcolección: 3
  Gastos aprobados: 3
  Total calculado: S/ 500.00
  Total guardado: S/ 0.00
  Diferencia: S/ 500.00 ❌

Proyecto: Casa en Miraflores (def456uvw)
  Gastos en subcolección: 5
  Gastos aprobados: 4
  Total calculado: S/ 1,250.00
  Total guardado: S/ 1,200.00
  Diferencia: S/ 50.00 ❌

🔧 Corrigiendo inconsistencias automáticamente...

🔧 Corrigiendo proyecto Terreno Lima Norte...
   Total calculado: S/ 500.00
   Total guardado: S/ 0.00
   Diferencia: S/ 500.00
✅ Proyecto Terreno Lima Norte corregido

🔧 Corrigiendo proyecto Casa en Miraflores...
   Total calculado: S/ 1,250.00
   Total guardado: S/ 1,200.00
   Diferencia: S/ 50.00
✅ Proyecto Casa en Miraflores corregido

✅ Corrección completada. Verificando nuevamente...

📊 REPORTE DE VERIFICACIÓN DE GASTOS

═══════════════════════════════════════════════════════════════════════════════

✅ Proyectos correctos: 17
⚠️  Proyectos con inconsistencias: 0

═══════════════════════════════════════════════════════════════════════════════
```

---

## 🔧 Método 2: Verificación Manual de un Proyecto

Si solo quieres verificar un proyecto específico:

```javascript
// Importar funciones
const { verificarGastosProyecto, corregirInconsistencias } = await import('/lib/utils/verificarGastos');

// Verificar un proyecto específico
const resultado = await verificarGastosProyecto('ID_DEL_PROYECTO');
console.log(resultado);

// Si hay inconsistencias, corregir
if (!resultado.coincide) {
  await corregirInconsistencias('ID_DEL_PROYECTO');
}
```

---

## 📊 Entendiendo el Reporte

### Campos del reporte:

| Campo | Descripción |
|-------|-------------|
| **proyectoId** | ID único del proyecto en Firebase |
| **proyectoNombre** | Nombre del proyecto |
| **gastosEnSubcoleccion** | Total de gastos guardados (aprobados + pendientes + rechazados) |
| **gastosAprobados** | Solo gastos con estado 'aprobado' o sin estado |
| **totalCalculado** | Suma de montos de gastos aprobados |
| **totalGuardado** | Campo `totalGastos` en el documento del proyecto |
| **coincide** | `true` si la diferencia es < S/ 0.01 |
| **diferencia** | Diferencia absoluta entre calculado y guardado |

### Estados de gastos:

- ✅ **aprobado**: Se incluye en el total
- ⏳ **pendiente**: NO se incluye en el total
- ❌ **rechazado**: NO se incluye en el total
- 🔄 **sin estado**: Se trata como aprobado (legacy)

---

## 🚨 Problemas Comunes y Soluciones

### Problema 1: "Los gastos no aparecen en el reporte"

**Causa:** Los gastos están en estado `pendiente` o el campo `totalGastos` no está actualizado.

**Solución:**
```javascript
// Verificar y corregir
await verificarYCorregirTodo();
```

### Problema 2: "El ROI mostrado es incorrecto"

**Causa:** El campo `roiReal` no se recalculó después de agregar gastos.

**Solución:**
```javascript
// Recalcular totales manualmente
const { recalcularTotalesGastos } = await import('/lib/firebase/gastos');
await recalcularTotalesGastos('ID_DEL_PROYECTO');
```

### Problema 3: "Diferencia de centavos entre calculado y guardado"

**Causa:** Redondeo de decimales en operaciones anteriores.

**Solución:** El script tiene una tolerancia de S/ 0.01. Si la diferencia es menor, se considera correcto.

### Problema 4: "Error: Proyecto no encontrado"

**Causa:** El ID del proyecto es incorrecto o el proyecto fue eliminado.

**Solución:** Verifica que el ID sea correcto. Puedes listar todos los proyectos:
```javascript
const { collection, getDocs } = await import('firebase/firestore');
const { db } = await import('/lib/firebase/config');

const productosRef = collection(db, 'productos');
const snapshot = await getDocs(productosRef);
snapshot.docs.forEach(doc => {
  console.log(doc.id, '→', doc.data().nombre);
});
```

---

## 📈 Mejores Prácticas

### 1. Verificación Mensual
Ejecuta `verificarYCorregirTodo()` al menos una vez al mes como parte de tu proceso de auditoría.

### 2. Después de Cambios Masivos
Si hiciste cambios manuales en Firebase o migraste datos, ejecuta la verificación inmediatamente.

### 3. Antes de Generar Reportes Importantes
Antes de enviar reportes a inversores o stakeholders, verifica que los datos estén correctos.

### 4. Monitoreo de Logs
Revisa la consola del navegador cuando cargues un reporte. El sistema automáticamente detecta y reporta inconsistencias:

```
⚠️ Totales de gastos desactualizados. Recalculando...
✅ Totales recalculados correctamente
```

---

## 🔐 Seguridad

- ✅ Solo usuarios con permisos de gestor o creador pueden ejecutar estas funciones
- ✅ Todas las operaciones se registran en logs
- ✅ Los cambios son auditables en Firebase
- ✅ No se eliminan datos, solo se recalculan totales

---

## 📞 Soporte

Si encuentras problemas que no puedes resolver:

1. Revisa los logs de la consola del navegador
2. Verifica que tengas permisos de gestor/admin
3. Contacta al equipo de desarrollo con:
   - ID del proyecto afectado
   - Captura de pantalla del error
   - Logs de la consola

---

## 🎓 Ejemplo Completo

```javascript
// 1. Importar todas las funciones necesarias
const verificacion = await import('/lib/utils/verificarGastos');

// 2. Verificar todos los proyectos
const resultados = await verificacion.verificarTodosLosProyectos();

// 3. Generar reporte
verificacion.generarReporteVerificacion(resultados);

// 4. Corregir solo los que tienen problemas
const conProblemas = resultados.filter(r => !r.coincide);
for (const proyecto of conProblemas) {
  await verificacion.corregirInconsistencias(proyecto.proyectoId);
}

// 5. Verificar nuevamente
const resultadosFinales = await verificacion.verificarTodosLosProyectos();
verificacion.generarReporteVerificacion(resultadosFinales);
```

---

## ✅ Checklist de Verificación

Antes de cerrar un proyecto o generar reportes finales:

- [ ] Ejecutar `verificarYCorregirTodo()`
- [ ] Confirmar que todos los proyectos están correctos
- [ ] Revisar que los gastos aprobados coincidan con los comprobantes
- [ ] Verificar que el ROI real se muestre correctamente en el reporte
- [ ] Confirmar que la comparación "Con/Sin gastos" sea precisa
- [ ] Generar y revisar el PDF del reporte de cierre

---

**Última actualización:** 30 de Mayo, 2026  
**Versión:** 1.0.0
