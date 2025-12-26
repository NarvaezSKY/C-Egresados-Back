# 🎓 API Backend - Sistema de Carnets Digitales para Egresados SENA

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![MongoDB](https://img.shields.io/badge/database-MongoDB%20Atlas-green.svg)
![License](https://img.shields.io/badge/license-ISC-lightgrey.svg)

Sistema backend completo para la gestión y generación de carnets digitales con códigos QR para egresados del SENA Regional Cauca - Centro de Teleinformática y Producción Industrial.

---

## 📋 Tabla de Contenidos

- [¿Qué es esta aplicación?](#-qué-es-esta-aplicación)
- [¿Para qué sirve?](#-para-qué-sirve)
- [¿Cómo funciona?](#-cómo-funciona)
- [Características Principales](#-características-principales)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Seguridad](#-seguridad)
- [Scripts Disponibles](#-scripts-disponibles)
- [Migración de Datos](#-migración-de-datos)
- [Arquitectura](#-arquitectura)
- [Contribución](#-contribución)

---

## 🎯 ¿Qué es esta aplicación?

Esta aplicación es un **servidor backend REST API** desarrollado en Node.js con Express, diseñado específicamente para gestionar la generación y verificación de carnets digitales de egresados del SENA. El sistema integra:

- **Base de datos MongoDB Atlas** para almacenamiento de información de egresados
- **Generación de PDFs** con carnets personalizados
- **Códigos QR únicos** con firma digital para verificación
- **Sistema de validación** con encuestas de egresados
- **Control de generación** con límites temporales (1 carnet cada 30 días)
- **Protección reCAPTCHA** contra generación automatizada

---

## 🎁 ¿Para qué sirve?

### Funcionalidades Principales

1. **Verificación de Egresados**
   - Validar si una persona es egresada del SENA
   - Consultar información académica (programa, ficha, fecha de certificación)
   
2. **Generación de Carnets Digitales**
   - Crear carnets en formato PDF personalizados
   - Incluir código QR único para cada carnet
   - Validar que el egresado haya completado la encuesta de seguimiento
   - Control de frecuencia: 1 carnet cada 30 días por usuario

3. **Verificación de Carnets**
   - Validar autenticidad de carnets mediante escaneo de QR
   - Verificar vigencia de carnets (vencimiento a 30 días)
   - Detectar carnets falsificados mediante firma digital

4. **Gestión de Encuestas**
   - Verificar si un egresado ha completado la encuesta de seguimiento
   - Requisito obligatorio para generar carnet

5. **Estadísticas y Reportes**
   - Obtener estadísticas de egresados por programa
   - Generar reportes de carnets emitidos
   - Monitoreo de uso del sistema

---

## ⚙️ ¿Cómo funciona?

### Flujo de Funcionamiento

```
┌─────────────────────────────────────────────────────────────┐
│  1. USUARIO SOLICITA CARNET                                 │
│     POST /carnet + {cedula, recaptchaToken}                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  2. VALIDACIONES                                            │
│     ✓ Verificar reCAPTCHA                                  │
│     ✓ Verificar que existe en MongoDB                     │
│     ✓ Verificar encuesta completada                       │
│     ✓ Verificar no tenga carnet vigente                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  3. GENERACIÓN DEL CARNET                                   │
│     • Crear código QR único con firma digital              │
│     • Generar PDF personalizado                            │
│     • Registrar en base de datos de carnets                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  4. RESPUESTA AL USUARIO                                    │
│     • PDF del carnet con QR incluido                       │
│     • Fecha de vencimiento (30 días)                       │
└─────────────────────────────────────────────────────────────┘
```

### Verificación de Carnet por QR

```
┌─────────────────────────────────────────────────────────────┐
│  1. ESCANEO DEL QR                                          │
│     QR contiene: https://domain.com/verify?id=encrypted     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  2. VERIFICACIÓN                                            │
│     ✓ Desencriptar datos del QR                           │
│     ✓ Validar firma digital                               │
│     ✓ Verificar no esté vencido                           │
│     ✓ Verificar estado activo                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  3. RESULTADO                                               │
│     • ✅ Carnet válido y vigente                           │
│     • ⏰ Carnet vencido                                    │
│     • ❌ Carnet inválido o falsificado                     │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Características Principales

### 🔐 Seguridad
- **reCAPTCHA v3** integrado para prevenir bots
- **Firma digital** en códigos QR
- **Encriptación** de datos en QR
- **Validación de encuestas** obligatoria
- **Control de frecuencia** de generación de carnets
- **Auditoría completa** con registro de IP y User-Agent

### 📱 Códigos QR Inteligentes
- **Únicos e irrepetibles** para cada carnet
- **Firmados digitalmente** para evitar falsificaciones
- **Validación en tiempo real** al escanear
- **Información encriptada** con clave secreta

### 🎫 Gestión de Carnets
- **Vencimiento automático** después de 30 días
- **Límite temporal**: 1 carnet cada 30 días
- **Historial completo** de carnets generados
- **Estados**: activo, vencido, revocado

### 📊 Estadísticas y Reportes
- **Dashboard de estadísticas** de egresados
- **Reportes en PDF** de carnets emitidos
- **Análisis por programa** de formación
- **Monitoreo de uso** del sistema

### 🗄️ Base de Datos Optimizada
- **MongoDB Atlas** en la nube
- **Índices optimizados** para búsquedas rápidas
- **Modelo de datos minimalista** (70% menos espacio)
- **Procesamiento en lotes** para migraciones

---

## 🛠️ Tecnologías Utilizadas

### Backend Core
- **Node.js** (v18+) - Entorno de ejecución JavaScript
- **Express.js** (v5.1.0) - Framework web minimalista
- **MongoDB** (v8.19.2 con Mongoose) - Base de datos NoSQL

### Librerías Principales
- **PDFKit** (v0.17.2) - Generación de PDFs
- **QRCode** (v1.5.4) - Generación de códigos QR
- **Axios** (v1.12.2) - Cliente HTTP para reCAPTCHA
- **UUID** (v13.0.0) - Generación de identificadores únicos
- **XLSX** (v0.18.5) - Lectura de archivos Excel

### Seguridad y Middleware
- **CORS** (v2.8.5) - Control de acceso entre dominios
- **dotenv** (v17.2.3) - Gestión de variables de entorno
- **body-parser** (v2.2.0) - Análisis de cuerpos de peticiones
- **morgan** (v1.10.1) - Logger de peticiones HTTP

### Herramientas de Desarrollo
- **nodemon** (v3.1.10) - Reinicio automático en desarrollo

---

## 📁 Estructura del Proyecto

```
C-Egresados-Back/
│
├── 📁 config/                      # Configuraciones
│   └── fieldMapping.js             # Mapeo de campos Excel/MongoDB + CORS
│
├── 📁 controllers/                 # Controladores de la API
│   └── egresadoController.js      # Lógica de endpoints
│
├── 📁 db/                          # Conexiones a bases de datos
│   ├── mongoConnection.js         # Conexión a MongoDB Atlas
│   ├── excelConnection.js         # Lectura de archivos Excel
│   └── surveyConnection.js        # Conexión a archivo de encuestas
│
├── 📁 models/                      # Modelos de datos (Mongoose)
│   ├── Egresado.js                # Esquema de egresados
│   └── Carnet.js                  # Esquema de carnets generados
│
├── 📁 routes/                      # Rutas de la API
│   ├── index.js                   # Rutas principales
│   ├── egresadoRoutes.js          # Rutas de egresados
│   └── verificationRoutes.js      # Rutas de verificación QR
│
├── 📁 services/                    # Lógica de negocio
│   ├── egresadoService.js         # Servicios de egresados (Excel - Legacy)
│   ├── egresadoServiceMongo.js    # Servicios de egresados (MongoDB)
│   ├── carnetService.js           # Gestión de carnets
│   ├── qrService.js               # Generación y validación de QR
│   └── recaptchaService.js        # Validación de reCAPTCHA
│
├── 📁 utils/                       # Utilidades
│   └── pdfGenerator.js            # Generación de PDFs de carnets
│
├── 📁 scripts/                     # Scripts de utilidad
│   ├── migrate.js                 # Migración rápida a MongoDB
│   └── migrateToMongo.js          # Migración completa optimizada
│
├── 📁 others/                      # Archivos varios
│   └── req.txt                    # Requerimientos adicionales
│
├── 📄 app.js                       # Aplicación principal Express
├── 📄 package.json                 # Dependencias y scripts npm
├── 📄 nodemon.json                 # Configuración de nodemon
├── 📄 .env                         # Variables de entorno (no versionado)
│
├── 📄 README.md                    # Este archivo
├── 📄 CARNET_QR_README.md         # Documentación de carnets con QR
├── 📄 ENCUESTA_README.md          # Documentación de encuestas
├── 📄 MONGODB_MIGRATION.md        # Guía de migración a MongoDB
└── 📄 OPTIMIZATION_SUMMARY.md     # Resumen de optimizaciones
```

### Descripción de Carpetas

#### 📁 `config/`
Contiene archivos de configuración global:
- **fieldMapping.js**: Mapeo de columnas Excel a campos MongoDB, configuración de CORS y opciones del servidor

#### 📁 `controllers/`
Controladores que manejan las peticiones HTTP:
- **egresadoController.js**: Endpoints de verificación, generación de carnets, estadísticas

#### 📁 `db/`
Gestión de conexiones a diferentes fuentes de datos:
- **mongoConnection.js**: Conexión principal a MongoDB Atlas con pooling
- **excelConnection.js**: Lectura de archivos Excel (DBEGRESADOS.xlsx)
- **surveyConnection.js**: Lectura de archivo de encuestas

#### 📁 `models/`
Modelos de datos con Mongoose:
- **Egresado.js**: Esquema optimizado con índices para búsquedas rápidas
- **Carnet.js**: Esquema para registro de carnets con QR

#### 📁 `routes/`
Definición de rutas de la API:
- **index.js**: Agrupa todas las rutas
- **egresadoRoutes.js**: Rutas completas de egresados
- **verificationRoutes.js**: Rutas públicas de verificación

#### 📁 `services/`
Lógica de negocio separada de los controladores:
- **egresadoServiceMongo.js**: Operaciones CRUD con MongoDB
- **carnetService.js**: Generación, validación y gestión de carnets
- **qrService.js**: Creación y verificación de códigos QR
- **recaptchaService.js**: Integración con Google reCAPTCHA

#### 📁 `utils/`
Funciones utilitarias:
- **pdfGenerator.js**: Generación de PDFs con PDFKit

#### 📁 `scripts/`
Scripts de mantenimiento y migración:
- **migrateToMongo.js**: Migración optimizada desde Excel a MongoDB
- **migrate.js**: Migración rápida

---

## 📋 Requisitos Previos

- **Node.js** v18.0.0 o superior
- **npm** v9.0.0 o superior
- **Cuenta en MongoDB Atlas** (o MongoDB local)
- **Cuenta de Google reCAPTCHA** (para protección anti-bot)
- **Archivo Excel** DBEGRESADOS.xlsx con datos de egresados
- **Archivo Excel** EncuestaEgresados.xlsx con respuestas de encuestas

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd C-Egresados-Back
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Preparar archivos de datos

Coloca los siguientes archivos en la raíz del proyecto:

- `DBEGRESADOS.xlsx` - Base de datos de egresados
- `EncuestaEgresados.xlsx` - Respuestas de encuestas

---

## ⚙️ Configuración

### 1. Crear archivo `.env`

Crea un archivo `.env` en la raíz del proyecto:

```env
# 🌐 MongoDB Atlas
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/egresados_db?retryWrites=true&w=majority
DB_NAME=egresados_db

# 📊 Archivos de datos
EXCEL_FILE_PATH=./DBEGRESADOS.xlsx
SHEET_NAME=BD
SURVEY_FILE_PATH=./EncuestaEgresados.xlsx
SURVEY_SHEET_NAME=Hoja1

# 🔐 Google reCAPTCHA v3
RECAPTCHA_SECRET_KEY=tu_clave_secreta_recaptcha

# 🔑 Clave para firmar QR (genera una aleatoria)
QR_SECRET_KEY=tu_clave_secreta_para_qr_123456789

# 🌍 URL base de tu aplicación
BASE_URL=https://tudominio.com

# 🚀 Puerto del servidor
PORT=3000

# 🌐 URLs permitidas por CORS
ALLOWED_ORIGINS=http://localhost:3000,https://tudominio.com
```

### 2. Configurar MongoDB Atlas

1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crear un cluster gratuito
3. Crear un usuario de base de datos
4. Obtener el string de conexión
5. Agregar tu IP a la lista blanca (o permitir acceso desde cualquier lugar)

### 3. Configurar Google reCAPTCHA

1. Ir a [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Registrar un nuevo sitio (reCAPTCHA v3)
3. Obtener la clave secreta
4. Agregarla al archivo `.env`

---

## 🎮 Uso

### Modo Desarrollo

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3000` con auto-recarga.

### Modo Producción

```bash
npm start
```

### Verificar Conexión a MongoDB

```bash
npm run db:status
```

### Migrar Datos desde Excel

```bash
# Migración completa optimizada
npm run migrate:full

# Migración rápida
npm run migrate
```

---

## 🌐 API Endpoints

### 🔍 Verificación de Egresados

#### Verificar por Cédula
```http
POST /api/egresados/verify
Content-Type: application/json

{
  "cedula": "1110288054"
}
```

**Respuesta exitosa:**
```json
{
  "message": "Egresado encontrado",
  "egresado": {
    "numeroDocumento": "1110288054",
    "nombreAprendiz": "JUAN PÉREZ",
    "denominacionPrograma": "TÉCNICO EN SISTEMAS",
    "ficha": "24690",
    "fechaCertificacion": "2023-06-15"
  }
}
```

### 🎫 Generación de Carnets

#### Generar Carnet (con reCAPTCHA)
```http
POST /api/egresados/carnet
Content-Type: application/json

{
  "cedula": "1110288054",
  "recaptchaToken": "token_generado_por_recaptcha"
}
```

**Respuesta:** PDF del carnet

#### Generar Carnet (sin reCAPTCHA - legacy)
```http
GET /api/egresados/carnet/1110288054
```

### 🔐 Verificación de Carnets

#### Validar Carnet por QR
```http
GET /api/egresados/carnet/validate/datos_encriptados_del_qr
```

**Respuesta válida:**
```json
{
  "valid": true,
  "message": "Carnet válido",
  "carnet": {
    "carnetId": "uuid-único",
    "nombreCompleto": "JUAN PÉREZ",
    "programa": "TÉCNICO EN SISTEMAS",
    "cedula": "1110288054",
    "ficha": "24690",
    "fechaGeneracion": "2025-10-22T15:30:00Z",
    "fechaVencimiento": "2025-11-22T15:30:00Z",
    "daysRemaining": 15,
    "estado": "activo"
  }
}
```

#### Estado de Carnet de Usuario
```http
GET /api/egresados/carnet/status/1110288054
```

### 📊 Estadísticas

#### Obtener Estadísticas Generales
```http
GET /api/egresados/stats
```

**Respuesta:**
```json
{
  "totalEgresados": 15000,
  "porProgramas": [
    {
      "programa": "TÉCNICO EN SISTEMAS",
      "cantidad": 1500
    }
  ],
  "porAnio": {
    "2023": 3000,
    "2024": 5000
  }
}
```

#### Generar Reporte de Estadísticas (PDF)
```http
GET /api/egresados/stats/report
```

#### Estadísticas de Carnets
```http
GET /api/egresados/carnet/stats
```

### 📋 Encuestas

#### Verificar si completó encuesta
```http
GET /api/egresados/survey/check/1110288054
```

**Respuesta:**
```json
{
  "hasAnswered": true,
  "message": "El egresado ha contestado la encuesta"
}
```

### 🔄 Gestión

#### Recargar Datos desde Excel
```http
POST /api/egresados/reload
```

#### Recargar Datos de Encuesta
```http
POST /api/egresados/survey/reload
```

#### Obtener Todos los Egresados
```http
GET /api/egresados
```

#### Health Check
```http
GET /api/health
```

### 🏠 Ruta Raíz

```http
GET /
```

Retorna información del servidor y endpoints disponibles.

---

## 🔒 Seguridad

### Sistema de Protección Multi-Capa

1. **reCAPTCHA v3**
   - Protección contra bots en generación de carnets
   - Puntuación mínima configurable (default: 0.5)
   - Análisis de comportamiento del usuario

2. **Firma Digital en QR**
   - Códigos QR firmados con clave secreta
   - Detección de QR falsificados
   - Encriptación de datos sensibles

3. **Control de Frecuencia**
   - Máximo 1 carnet cada 30 días por usuario
   - Prevención de generación masiva
   - Registro de historial completo

4. **Validación de Encuesta**
   - Requisito obligatorio para generar carnet
   - Verificación en tiempo real
   - Sincronización con archivo Excel

5. **Auditoría**
   - Registro de IP y User-Agent
   - Timestamp de todas las operaciones
   - Rastreabilidad completa

6. **CORS Configurado**
   - Control de orígenes permitidos
   - Headers de seguridad
   - Prevención de CSRF

### Manejo de Errores

- **400 Bad Request**: Parámetros faltantes o inválidos
- **401 Unauthorized**: Token reCAPTCHA inválido
- **404 Not Found**: Egresado no encontrado
- **409 Conflict**: Carnet ya existe vigente
- **500 Internal Server Error**: Error del servidor

---

## 📜 Scripts Disponibles

```bash
# Desarrollo con auto-recarga
npm run dev

# Producción
npm start

# Migración completa a MongoDB
npm run migrate:full

# Migración rápida
npm run migrate

# Verificar estado de MongoDB
npm run db:status

# Conectar a MongoDB
npm run db:connect

# Obtener información de la base de datos
npm run db:info
```

---

## 🗄️ Migración de Datos

### Proceso de Migración desde Excel a MongoDB

El sistema incluye scripts optimizados para migrar datos desde archivos Excel a MongoDB:

#### Características de la Migración

- ✅ **Procesamiento en lotes** de 500 registros
- ✅ **Validación exhaustiva** de datos
- ✅ **Manejo de duplicados** inteligente
- ✅ **Recuperación automática** de errores
- ✅ **Logging detallado** con estadísticas
- ✅ **Optimización de espacio** (70% menos datos)

#### Campos Migrados

Solo se migran campos **esenciales** para carnets:
- Número de documento (cédula)
- Nombre completo del aprendiz
- Ficha de formación
- Denominación del programa
- Fecha de certificación
- Regional y centro (auto-asignados)

#### Ejecutar Migración

```bash
# Opción 1: Migración completa con validaciones
npm run migrate:full

# Opción 2: Migración rápida
npm run migrate
```

#### Salida Esperada

```
🚀 MIGRACIÓN OPTIMIZADA - Excel a MongoDB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Archivo: DBEGRESADOS.xlsx
📊 Total de registros: 15,000

✅ Validando datos...
✅ Procesando lote 1/30 (500 registros)
✅ Procesando lote 2/30 (500 registros)
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMEN DE MIGRACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Registros insertados: 14,850
⚠️  Duplicados omitidos: 150
❌ Errores: 0
⏱️  Tiempo total: 45.3s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Para más detalles, consulta [MONGODB_MIGRATION.md](MONGODB_MIGRATION.md).

---

## 🏗️ Arquitectura

### Arquitectura en Capas

```
┌─────────────────────────────────────────────────┐
│              CAPA DE PRESENTACIÓN               │
│                  (API REST)                      │
│                                                  │
│  • Express Routes                               │
│  • Middlewares (CORS, Body Parser)             │
│  • Error Handlers                               │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              CAPA DE CONTROLADORES              │
│                                                  │
│  • egresadoController                           │
│  • Validación de peticiones                     │
│  • Manejo de respuestas HTTP                    │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│            CAPA DE LÓGICA DE NEGOCIO            │
│                 (Services)                       │
│                                                  │
│  • egresadoServiceMongo                         │
│  • carnetService                                │
│  • qrService                                    │
│  • recaptchaService                             │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│            CAPA DE ACCESO A DATOS               │
│                  (Models)                        │
│                                                  │
│  • Egresado Model (Mongoose)                    │
│  • Carnet Model (Mongoose)                      │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              CAPA DE PERSISTENCIA               │
│                                                  │
│  • MongoDB Atlas (Egresados)                    │
│  • MongoDB Atlas (Carnets)                      │
│  • File System (Registro local JSON)            │
└─────────────────────────────────────────────────┘
```

### Flujo de Datos

1. **Cliente** → Petición HTTP
2. **Express Router** → Enruta la petición
3. **Controller** → Valida y procesa
4. **Service** → Aplica lógica de negocio
5. **Model** → Interactúa con base de datos
6. **MongoDB** → Almacena/recupera datos
7. **Service** → Procesa respuesta
8. **Controller** → Formatea respuesta
9. **Cliente** ← Respuesta HTTP/PDF

---

## 🎨 Generación de Carnets PDF

El sistema genera carnets personalizados con:

- **Header**: Logo del SENA y título
- **Foto**: Espacio para fotografía del egresado
- **Información Personal**:
  - Nombre completo
  - Número de cédula
  - Ficha de formación
  - Programa de formación
  - Fecha de certificación
- **Código QR**: QR único con firma digital
- **Footer**: Regional y centro de formación
- **Fecha de Vencimiento**: Vigencia del carnet

---

## 📖 Documentación Adicional

- [CARNET_QR_README.md](CARNET_QR_README.md) - Documentación completa del sistema de carnets con QR
- [ENCUESTA_README.md](ENCUESTA_README.md) - Información sobre el sistema de encuestas
- [MONGODB_MIGRATION.md](MONGODB_MIGRATION.md) - Guía detallada de migración a MongoDB
- [OPTIMIZATION_SUMMARY.md](OPTIMIZATION_SUMMARY.md) - Resumen de optimizaciones implementadas

---

## 🐛 Solución de Problemas

### No se puede conectar a MongoDB

```bash
# Verificar conexión
npm run db:status

# Intentar conectar manualmente
npm run db:connect
```

**Causas comunes:**
- String de conexión incorrecto en `.env`
- IP no autorizada en MongoDB Atlas
- Usuario/contraseña incorrectos

### Error al generar carnet

**Posibles causas:**
1. Egresado no ha completado la encuesta
2. Ya tiene un carnet vigente
3. Token de reCAPTCHA inválido
4. Egresado no existe en la base de datos

### Archivos Excel no encontrados

Verifica que los archivos estén en la raíz del proyecto:
- `DBEGRESADOS.xlsx`
- `EncuestaEgresados.xlsx`

---

## 🤝 Contribución

Para contribuir al proyecto:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

---

## 📝 Licencia

ISC License

---

## 👥 Autores

**SENA Regional Cauca - Centro de Teleinformática y Producción Industrial**

---

## 📞 Soporte

Para soporte técnico o preguntas:
- **Email**: soporte@senacauca.edu.co
- **Teléfono**: +57 (2) XXX XXXX

---

## 🔄 Changelog

### v2.0.0 (Actual)
- ✅ Migración completa a MongoDB Atlas
- ✅ Sistema de carnets con QR único
- ✅ Integración con reCAPTCHA v3
- ✅ Control de generación con límite temporal
- ✅ Validación de encuestas
- ✅ API REST completa
- ✅ Optimización de base de datos (70% menos espacio)

### v1.0.0 (Legacy)
- ⚠️ Sistema basado en Excel
- ⚠️ Sin códigos QR
- ⚠️ Sin protección reCAPTCHA

---

## 🌟 Características Futuras

- [ ] Panel de administración web
- [ ] Exportación de carnets en lote
- [ ] Notificaciones por email
- [ ] Integración con sistema de gestión académica
- [ ] App móvil para verificación de carnets
- [ ] Dashboard de análisis y métricas
- [ ] API GraphQL
- [ ] Autenticación con JWT
- [ ] Sistema de roles y permisos

---

<div align="center">

**Hecho con ❤️ por el equipo de desarrollo del SENA Cauca**

![SENA Logo](https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png)

</div>
