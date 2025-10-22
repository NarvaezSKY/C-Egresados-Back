import { Router } from "express";
import egresadoRoutes from "./egresadoRoutes.js";

const router = Router();

// 📌 Rutas de la API
router.use('/egresados', egresadoRoutes);

// 📌 Ruta de health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
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