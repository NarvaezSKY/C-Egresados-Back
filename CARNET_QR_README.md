# 🎓 Sistema de Carnets con QR - SENA Cauca

## ✨ Nuevas Funcionalidades

### 🔐 **Control de Generación de Carnets**
- ✅ **Límite temporal**: Solo 1 carnet cada 30 días por usuario
- ✅ **Validación de encuesta**: Debe haber contestado la encuesta de egresados
- ✅ **Registro completo**: Historial de todos los carnets generados

### 📱 **Códigos QR de Verificación**
- ✅ **QR único**: Cada carnet tiene un QR único e irrepetible
- ✅ **Firma digital**: Los QR están firmados digitalmente para evitar falsificaciones
- ✅ **Validación en tiempo real**: Verifica estado y vigencia al escanear

### 🛡️ **Seguridad**
- ✅ **Encriptación**: Datos del QR encriptados con clave secreta
- ✅ **Vencimiento automático**: Carnets vencen después de 30 días
- ✅ **Auditoría**: Registro completo de generación con IP y User-Agent

---

## 🛣️ **Nuevas Rutas de la API**

### **Gestión de Carnets**
```bash
# Generar carnet (existente, ahora con QR y validaciones)
POST /carnet
POST /api/egresados/carnet

# Verificar estado de carnet de un usuario
GET /api/egresados/carnet/status/:cedula/:ficha

# Estadísticas de carnets
GET /api/egresados/carnet/stats
```

### **Verificación de QR**
```bash
# Validar carnet por código QR
GET /api/egresados/carnet/validate/:qrData

# Página web de verificación (para escanear QR)
GET /verify

# API de verificación directa
GET /api/carnet/verify/:qrData
```

---

## 📊 **Almacenamiento de Datos**

### **Archivo de Registro**
```
📁 data/
└── 📄 carnets_registry.json
```

### **Estructura de Registro**
```json
{
  "id": "uuid-único",
  "cedula": "1110288054",
  "ficha": "24690",
  "nombreCompleto": "JUAN PÉREZ",
  "programa": "TÉCNICO EN SISTEMAS",
  "fechaGeneracion": "2025-10-22T15:30:00Z",
  "fechaVencimiento": "2025-11-22T15:30:00Z",
  "estado": "activo",
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.100",
    "recaptchaScore": "0.9"
  }
}
```

---

## 🔍 **Cómo Funciona la Verificación**

### **1. Generación del Carnet**
1. Usuario solicita carnet con cédula y ficha
2. Sistema valida:
   - ✅ Egresado existe en base de datos
   - ✅ Ha contestado la encuesta
   - ✅ No tiene carnet válido en últimos 30 días
3. Se genera carnet con QR único

### **2. Verificación del QR**
1. Usuario escanea QR del carnet
2. QR contiene URL: `https://tudominio.com/verify?id=datos-encriptados`
3. Sistema valida:
   - ✅ Formato del QR es correcto
   - ✅ Firma digital es válida
   - ✅ Carnet no ha vencido
   - ✅ Carnet sigue activo

### **3. Estados Posibles**
- 🟢 **Activo**: Carnet válido y vigente
- 🟡 **Vencido**: Carnet expiró después de 30 días
- 🔴 **Reemplazado**: Se generó un carnet nuevo
- ⚫ **No encontrado**: QR inválido o falsificado

---

## 🧪 **Ejemplos de Uso**

### **Generar Carnet**
```bash
curl -X POST http://localhost:4000/carnet \
  -H "Content-Type: application/json" \
  -d '{
    "cedula": "1110288054",
    "ficha": "24690",
    "recaptchaToken": "token-valido"
  }'
```

### **Verificar Estado de Usuario**
```bash
curl http://localhost:4000/api/egresados/carnet/status/1110288054/24690
```

### **Validar QR**
```bash
curl http://localhost:4000/api/egresados/carnet/validate/eyJ0eXAiOiJKV1QiLCJhbGc...
```

### **Ver Estadísticas**
```bash
curl http://localhost:4000/api/egresados/carnet/stats
```

---

## ⚙️ **Configuración**

### **Variables de Entorno (.env)**
```env
# Códigos QR y carnets
QR_SECRET_KEY=tu-clave-secreta-super-segura
BASE_URL=https://tudominio.com

# Encuesta de egresados
SURVEY_FILE_PATH=./EncuestaEgresados.xlsx
SURVEY_SHEET_NAME=Sheet1
```

### **Dependencias Nuevas**
```bash
yarn add qrcode uuid
```

---

## 🔧 **Mantenimiento**

### **Limpieza Automática**
- El sistema automáticamente marca como vencidos los carnets expirados
- Se ejecuta cada vez que se consultan las estadísticas

### **Backup del Registro**
- Respaldar regularmente el archivo `data/carnets_registry.json`
- Contiene todo el historial de carnets generados

### **Monitoreo**
- Revisar logs para detectar intentos de falsificación
- Monitorear estadísticas de carnets activos vs vencidos

---

## 🚨 **Mensajes de Error Comunes**

| Error | Causa | Solución |
|-------|-------|----------|
| "No puedes generar un nuevo carnet" | Ya tiene carnet válido | Esperar hasta fecha indicada |
| "No has contestado a la encuesta" | No está en EncuestaEgresados.xlsx | Completar encuesta primero |
| "QR inválido: firma digital no coincide" | QR falsificado | QR no es auténtico |
| "Carnet vencido" | Más de 30 días desde generación | Generar nuevo carnet |

---

## 🎯 **Beneficios del Sistema**

1. **📱 Verificación instantánea**: Escanear QR para validar al momento
2. **🔐 Anti-falsificación**: Imposible duplicar o falsificar carnets
3. **⏰ Control temporal**: Evita abuso del sistema con límites de tiempo
4. **📊 Trazabilidad completa**: Historial completo de generación y uso
5. **🌐 Verificación online**: Cualquier persona puede verificar autenticidad