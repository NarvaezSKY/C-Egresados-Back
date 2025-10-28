import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";

// 📌 Cargar variables de entorno
dotenv.config();

// Importar configuraciones
import { CORS_OPTIONS, SERVER_CONFIG } from "./config/fieldMapping.js";

// 📌 Importar conexión a MongoDB
import mongoConnection from "./db/mongoConnection.js";

// Importar rutas
import apiRoutes from "./routes/index.js";

// 📌 Crear aplicación Express
const app = express();

// 📌 Middlewares globales
app.use(cors(CORS_OPTIONS));
app.use(bodyParser.json());
app.use(morgan("dev"));

// 📌 Rutas de la API
app.use('/api', apiRoutes);

// 📌 Rutas de compatibilidad (mantener las rutas originales)
import egresadoController from "./controllers/egresadoController.js";
import verificationRoutes from "./routes/verificationRoutes.js";

// Rutas de verificación públicas
app.use('/verify', verificationRoutes);

// Rutas de API de verificación (para QR)
app.get('/api/carnet/verify/:qrData', egresadoController.validateCarnet);

app.post('/verify-legacy', egresadoController.verify);
app.post('/carnet', egresadoController.generateCarnetWithCaptcha); // Nueva ruta principal con reCAPTCHA
app.get('/carnet/:cedula', egresadoController.generateCarnet); // Compatibilidad sin reCAPTCHA

// 📌 Ruta raíz
app.get('/', (req, res) => {
  const mongoStatus = mongoConnection.getConnectionStatus();
  
  res.json({
    message: 'API de Egresados SENA - Servidor Backend',
    version: '2.0.0',
    status: 'MongoDB exclusivamente (sin Excel)',
    database: {
      type: 'MongoDB Atlas',
      connected: mongoStatus.isConnected,
      name: mongoStatus.dbName || 'EGRESADOS'
    },
    endpoints: {
      // Rutas principales (con reCAPTCHA)
      verify: 'POST /verify o POST /api/egresados/verify (solo cedula)',
      carnetSecure: 'POST /carnet o POST /api/egresados/carnet (con reCAPTCHA, solo cedula)',
      
      // Rutas de compatibilidad
      carnetLegacy: 'GET /carnet/:cedula o GET /api/egresados/carnet/:cedula (sin reCAPTCHA)',
      
      // Nuevas rutas administrativas
      stats: 'GET /api/egresados/stats',
      statsReport: 'GET /api/egresados/stats/report',
      allEgresados: 'GET /api/egresados',
      reloadData: 'POST /api/egresados/reload',
      health: 'GET /api/health'
    },
    documentation: 'https://github.com/tu-repo/api-docs'
  });
});

// 📌 Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

// 📌 Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    message: 'Ruta no encontrada',
    requestedPath: req.originalUrl,
    availableRoutes: [
      'POST /verify (solo cedula)',
      'POST /carnet (cedula + reCAPTCHA)',
      'GET /carnet/:cedula',
      'GET /api/egresados/stats',
      'GET /api/health'
    ]
  });
});

// 📌 Función de inicialización con MongoDB
async function initializeServer() {
  try {
    console.log('🚀 ================================');
    console.log('📚 API de Egresados SENA');
    console.log('🚀 ================================');
    
    // 🔗 Conectar a MongoDB Atlas
    console.log('🔗 Conectando a MongoDB Atlas...');
    await mongoConnection.connect();
    
    const status = mongoConnection.getConnectionStatus();
    if (status.isConnected) {
      console.log('✅ MongoDB Atlas conectado exitosamente');
      console.log(`📊 Base de datos: ${status.dbName}`);
      console.log('💾 Modo: Solo MongoDB (sin Excel)');
    } else {
      throw new Error('No se pudo conectar a MongoDB');
    }
    
    // 🚀 Inicializar servidor HTTP
    app.listen(SERVER_CONFIG.port, () => {
      console.log(`✅ Servidor corriendo en http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
      console.log(`📖 Documentación: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
      console.log(`🏥 Health check: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/api/health`);
      console.log('🚀 ================================');
    });
    
  } catch (error) {
    console.error('❌ Error iniciando la aplicación:', error.message);
    console.error('💡 Verifica que MongoDB Atlas esté disponible');
    process.exit(1);
  }
}

// 📌 Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🔄 Cerrando aplicación...');
  try {
    await mongoConnection.disconnect();
    console.log('🟡 MongoDB desconectado');
  } catch (error) {
    console.error('❌ Error desconectando MongoDB:', error.message);
  }
  console.log('👋 Aplicación cerrada');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoConnection.disconnect();
  process.exit(0);
});

// 🚀 Inicializar la aplicación
initializeServer();

export default app;
