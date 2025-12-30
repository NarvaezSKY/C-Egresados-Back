# 📊 GUÍA DE CONFIGURACIÓN: EXCEL EN SHAREPOINT

## ✅ Implementación Completada

Se ha migrado la lectura del Excel de encuestas desde un archivo local a SharePoint en línea.

---

## 🔧 Configuración Requerida

### 1. **Crear archivo `.env`**

En la raíz del proyecto, crea un archivo `.env` (si no existe) con el siguiente contenido:

```env
# 🌐 MongoDB
MONGODB_URI=tu_mongodb_uri_aqui
DB_NAME=egresados_db

# 🌍 Servidor
NODE_ENV=development
PORT=3000

# 🔑 Claves
RECAPTCHA_SECRET_KEY=tu_secret_key_aqui
JWT_SECRET=tu_jwt_secret_aqui

# 📊 SharePoint - Encuesta de Egresados
SHAREPOINT_EXCEL_URL=https://sena4-my.sharepoint.com/personal

### 2. **Verificar que `.env` esté en `.gitignore`**

Asegúrate de que el archivo `.env` NO se suba a Git (por seguridad).

---

## 🚀 Cómo Funciona

### **Antes (Archivo Local):**
- Leía `EncuestaEgresados.xlsx` del servidor
- Había que actualizar el archivo manualmente
- Requería acceso físico al servidor

### **Ahora (SharePoint):**
- ✅ Descarga automáticamente desde SharePoint
- ✅ Se actualiza cada **2 meses** automáticamente
- ✅ Sin acceso al servidor necesario
- ✅ Datos siempre actualizados

---

## 📂 Archivos Modificados

1. **`db/sharepointConnection.js`** (NUEVO)
   - Conexión a SharePoint
   - Cache automático de 2 meses
   - Descarga automática del Excel

2. **`services/egresadoServiceMongo.js`**
   - Cambiado de `surveyConnection` a `sharepointConnection`
   - Todos los métodos ahora usan `await` para operaciones async

3. **`.env.example`**
   - Agregada variable `SHAREPOINT_EXCEL_URL`

---

## ⚙️ Configuración del Cache

**Duración actual:** 2 meses (configurable)

Para cambiar la duración del cache, edita [db/sharepointConnection.js](db/sharepointConnection.js#L9):

```javascript
this.cacheExpiration = 2 * 30 * 24 * 60 * 60 * 1000; // 2 meses
```

**Ejemplos:**
- 1 día: `24 * 60 * 60 * 1000`
- 1 semana: `7 * 24 * 60 * 60 * 1000`
- 1 mes: `30 * 24 * 60 * 60 * 1000`
- 6 horas: `6 * 60 * 60 * 1000`

---

## 🔄 Endpoints Disponibles

### **Forzar recarga manual:**
```bash
GET /api/egresados/reload-survey
```

### **Ver estadísticas del cache:**
```javascript
const stats = sharepointConnection.getCacheInfo();
console.log(stats);
// {
//   lastUpdate: "2025-12-29T10:30:00.000Z",
//   cacheExpiration: 5184000000,
//   isExpired: false,
//   timeUntilExpiration: 5000000000,
//   dataLoaded: true
// }
```

---

## 🧪 Testing

### **1. Probar descarga:**
```bash
npm start
```

En los logs deberías ver:
```
🌐 Descargando Excel desde SharePoint...
✅ Excel descargado: 125.45 KB
✅ Datos de encuesta cargados: 150 respuestas encontradas
🕐 Cache válido hasta: 29/02/2026 10:30:00
```

### **2. Verificar que el cache funciona:**
- Primera ejecución: descarga el archivo
- Segunda ejecución (antes de 2 meses): usa cache, NO descarga
- Después de 2 meses: descarga nuevamente

---

## ⚠️ Solución de Problemas

### **Error: URL de SharePoint no configurada**
```
❌ Error: URL de SharePoint no configurada en .env
```
**Solución:** Agrega `SHAREPOINT_EXCEL_URL` en tu archivo `.env`

### **Error 401/403 al descargar**
```
❌ Error HTTP: 403
```
**Solución:** Verifica que el enlace compartido tenga permisos de lectura públicos

### **El archivo descargado está vacío**
```
✅ Excel descargado: 0 KB
```
**Solución:** 
1. Verifica que la URL sea la de **descarga directa** (debe contener `download.aspx`)
2. Prueba la URL en tu navegador, debe descargar el archivo automáticamente

---

## 🔐 Seguridad

- ✅ El enlace de SharePoint es de **solo lectura**
- ✅ No requiere autenticación (enlace público anónimo)
- ✅ El archivo `.env` NO se sube a Git
- ✅ Sin credenciales expuestas

---

## 📊 Ventajas de esta Implementación

| Característica | Antes | Ahora |
|---------------|-------|-------|
| Actualización | Manual | Automática |
| Acceso servidor | Requerido | No requerido |
| Cache | No | Sí (2 meses) |
| Performance | Archivo local | Cache + descarga |
| Colaboración | Difícil | Fácil (SharePoint) |

---

## 🎯 Próximos Pasos Opcionales

1. **Agregar webhook:** Notificación cuando el Excel cambia
2. **Dashboard:** Ver estadísticas del cache en tiempo real
3. **Logs:** Guardar historial de descargas
4. **Alertas:** Email cuando falla la descarga

---

## 📞 Soporte

Si encuentras algún problema:
1. Revisa los logs de la aplicación
2. Verifica que la URL de SharePoint sea accesible
3. Confirma que el archivo `.env` esté configurado correctamente

**Archivo creado:** 29 de diciembre de 2025
**Versión:** 1.0.0
