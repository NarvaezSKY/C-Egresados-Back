import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";

// 📌 Cargar variables de entorno
dotenv.config();

// Importar configuraciones
import { CORS_OPTIONS, SERVER_CONFIG } from "./config/fieldMapping.js";

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

app.post('/verify', egresadoController.verify);
app.post('/carnet', egresadoController.generateCarnetWithCaptcha); // Nueva ruta principal con reCAPTCHA
app.get('/carnet/:cedula/:ficha', egresadoController.generateCarnet); // Compatibilidad sin reCAPTCHA

// 📌 Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API de Egresados SENA - Servidor Backend',
    version: '2.0.0',
    status: 'Refactorizado con arquitectura modular',
    endpoints: {
      // Rutas principales (con reCAPTCHA)
      verify: 'POST /verify o POST /api/egresados/verify',
      carnetSecure: 'POST /carnet o POST /api/egresados/carnet (con reCAPTCHA)',
      
      // Rutas de compatibilidad
      carnetLegacy: 'GET /carnet/:cedula/:ficha o GET /api/egresados/carnet/:cedula/:ficha (sin reCAPTCHA)',
      
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
      'POST /verify',
      'GET /carnet/:cedula/:ficha',
      'GET /api/egresados/stats',
      'GET /api/health'
    ]
  });
});

// 📌 Inicializar servidor
app.listen(SERVER_CONFIG.port, () => {
  console.log('🚀 ================================');
  console.log('📚 API de Egresados SENA');
  console.log('🚀 ================================');
  console.log(`✅ Servidor corriendo en http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
  console.log(`📖 Documentación: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
  console.log(`🏥 Health check: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/api/health`);
  console.log('🚀 ================================');
});

export default app;
