import { Router } from "express";
import egresadoRoutes from "./egresadoRoutes.js";
import verificationRoutes from "./verificationRoutes.js";

const router = Router();

// 📌 Rutas de la API
router.use('/egresados', egresadoRoutes);

// 📌 Rutas de verificación (también disponibles fuera de /api)
router.use('/carnet', verificationRoutes);

// 📌 Ruta de health check
router.get('/health', async (req, res) => {
  try {
    // Importar solo cuando se necesite para evitar dependencias circulares
    const mongoConnection = (await import('../db/mongoConnection.js')).default;
    const Egresado = (await import('../models/Egresado.js')).default;
    
    const mongoStatus = mongoConnection.getConnectionStatus();
    let dbStats = null;
    
    if (mongoStatus.isConnected) {
      try {
        const totalEgresados = await Egresado.countDocuments({ estado: 'activo' });
        dbStats = {
          totalEgresados,
          connected: true
        };
      } catch (error) {
        dbStats = {
          error: 'Error consultando base de datos',
          connected: false
        };
      }
    }
    
    res.json({ 
      status: 'OK', 
      message: 'Servidor funcionando correctamente',
      timestamp: new Date().toISOString(),
      database: {
        type: 'MongoDB Atlas',
        connected: mongoStatus.isConnected,
        name: mongoStatus.dbName || 'EGRESADOS',
        stats: dbStats
      },
      mode: 'MongoDB exclusivamente (sin Excel)'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Error verificando estado del servidor',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 📌 Ruta raíz de la API
router.get('/', (req, res) => {
  res.json({
    message: 'API de Egresados SENA',
    version: '1.0.0',
    endpoints: {
      verify: 'POST /api/egresados/verify',
      carnet: 'GET /api/egresados/carnet/:cedula/:ficha',
      stats: 'GET /api/egresados/stats',
      health: 'GET /api/health'
    }
  });
});

export default router;