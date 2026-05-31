# 🗑️ Script de Eliminación Masiva de Base de Datos

Este script elimina **TODA** la base de datos de Firebase de forma automática.

---

## ⚠️ ADVERTENCIA

**Esta acción es IRREVERSIBLE**. Solo usar con datos de prueba.

---

## 📋 PASOS PARA EJECUTAR

### **Paso 1: Descargar Service Account Key**

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Click en ⚙️ **Settings** (arriba izquierda)
4. Click en **Project settings**
5. Ve a la pestaña **Service accounts**
6. Click en **Generate new private key**
7. Confirma y descarga el archivo JSON
8. **Renombra** el archivo a: `serviceAccountKey.json`
9. **Mueve** el archivo a la carpeta: `scripts/`

```
inversiones/
├── scripts/
│   ├── deleteAllData.js
│   └── serviceAccountKey.json  ← Aquí
```

---

### **Paso 2: Instalar Dependencias**

```bash
npm install firebase-admin
```

---

### **Paso 3: Ejecutar Script**

#### **Opción A: Con Confirmación (Recomendado)**
```bash
node scripts/deleteAllData.js
```

Te pedirá que escribas `ELIMINAR TODO` para confirmar.

#### **Opción B: Sin Confirmación (Peligroso)**
```bash
node scripts/deleteAllData.js --force
```

Elimina inmediatamente sin preguntar.

---

## 📊 QUÉ ELIMINA

El script elimina:

- ✅ **Productos** (y sus gastos)
- ✅ **Usuarios** (Firestore)
- ✅ **Billeteras**
- ✅ **Movimientos**
- ✅ **Storage** (todas las imágenes)
- ✅ **Authentication** (todos los usuarios)

---

## 🎯 EJEMPLO DE EJECUCIÓN

```bash
$ node scripts/deleteAllData.js

⚠️⚠️⚠️  ADVERTENCIA FINAL  ⚠️⚠️⚠️

Estás a punto de ELIMINAR TODA LA BASE DE DATOS
Esta acción es IRREVERSIBLE y eliminará:

  ❌ Todos los proyectos
  ❌ Todos los usuarios
  ❌ Todas las inversiones
  ❌ Todos los gastos
  ❌ Todas las imágenes
  ❌ Todos los documentos

¿Estás ABSOLUTAMENTE SEGURO? Escribe "ELIMINAR TODO" para continuar: ELIMINAR TODO

✅ Confirmación recibida. Iniciando eliminación...

═══════════════════════════════════════════════════════
⚠️  ELIMINACIÓN MASIVA DE BASE DE DATOS FIREBASE
═══════════════════════════════════════════════════════

🗑️  [1/6] Eliminando productos y gastos...
   📦 Encontrados 15 producto(s)
   💰 Eliminando 8 gasto(s) del proyecto abc123
   💰 Eliminando 5 gasto(s) del proyecto def456
   ✅ Productos eliminados

🗑️  [2/6] Eliminando usuarios...
   👤 Encontrados 23 usuario(s)
   ✅ Usuarios eliminados

🗑️  [3/6] Eliminando billeteras...
   💳 Encontrados 23 billetera(s)
   ✅ Billeteras eliminadas

🗑️  [4/6] Eliminando movimientos...
   📊 Encontrados 156 movimiento(s)
   ✅ Movimientos eliminados

🗑️  [5/6] Eliminando archivos de Storage...
   📁 Encontrados 47 archivo(s)
   🗑️  Eliminado: productos/1234_imagen1.webp
   🗑️  Eliminado: productos/1234_imagen2.webp
   ...
   ✅ Storage limpiado

🗑️  [6/6] Eliminando usuarios de Authentication...
   👥 Encontrados 23 usuario(s)
   🗑️  Eliminado: user1@example.com
   🗑️  Eliminado: user2@example.com
   ...
   ✅ Authentication limpiado

═══════════════════════════════════════════════════════
✅ TODA LA BASE DE DATOS HA SIDO ELIMINADA EXITOSAMENTE
═══════════════════════════════════════════════════════

📊 Resumen:
   • Productos: 15 eliminados
   • Usuarios: 23 eliminados
   • Billeteras: 23 eliminadas
   • Movimientos: 156 eliminados
   • Storage: Limpiado
   • Authentication: Limpiado
```

---

## 🔒 SEGURIDAD

### **Archivo serviceAccountKey.json**

⚠️ **NUNCA** subas este archivo a Git

Ya está incluido en `.gitignore`:

```gitignore
# Service Account Keys
scripts/serviceAccountKey.json
**/serviceAccountKey.json
```

---

## ❓ SOLUCIÓN DE PROBLEMAS

### **Error: Cannot find module './serviceAccountKey.json'**

```bash
❌ Error al inicializar Firebase Admin

Necesitas el archivo serviceAccountKey.json
Descárgalo desde:
Firebase Console > ⚙️ Settings > Service Accounts > Generate new private key

Guárdalo como: scripts/serviceAccountKey.json
```

**Solución:** Descarga el archivo y guárdalo en `scripts/serviceAccountKey.json`

---

### **Error: Permission denied**

```bash
❌ Error: Permission denied
```

**Solución:** Asegúrate de que el Service Account tenga permisos de administrador.

---

### **Error: Module 'firebase-admin' not found**

```bash
❌ Error: Cannot find module 'firebase-admin'
```

**Solución:**
```bash
npm install firebase-admin
```

---

## 🎯 DESPUÉS DE ELIMINAR

La base de datos estará completamente vacía. Puedes:

1. **Crear nuevos proyectos** desde la aplicación
2. **Importar datos** si tienes backup
3. **Empezar de cero** con datos limpios

---

## 📞 SOPORTE

Si tienes problemas, verifica:

1. ✅ `serviceAccountKey.json` está en `scripts/`
2. ✅ `firebase-admin` está instalado
3. ✅ Tienes conexión a internet
4. ✅ El proyecto de Firebase existe

---

**¡Listo para eliminar toda la base de datos!** 🗑️
