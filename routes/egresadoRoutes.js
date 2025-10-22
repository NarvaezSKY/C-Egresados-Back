import { Router } from "express";
import egresadoController from "../controllers/egresadoController.js";

const router = Router();

// 📌 Rutas principales de egresados

// POST /api/egresados/verify - Verificar credenciales de egresado
router.post('/verify', egresadoController.verify);

// POST /api/egresados/carnet - Generar carnet PDF con reCAPTCHA (nueva ruta principal)
router.post('/carnet', egresadoController.generateCarnetWithCaptcha);

// GET /api/egresados/carnet/:cedula/:ficha - Generar carnet PDF (compatibilidad, sin reCAPTCHA)
router.get('/carnet/:cedula/:ficha', egresadoController.generateCarnet);

// 📌 Rutas administrativas

// GET /api/egresados - Obtener todos los egresados
router.get('/', egresadoController.getAll);

// GET /api/egresados/stats - Obtener estadísticas
router.get('/stats', egresadoController.getStats);

// GET /api/egresados/stats/report - Generar reporte de estadísticas en PDF
router.get('/stats/report', egresadoController.generateStatsReport);

// POST /api/egresados/reload - Recargar datos del Excel
router.post('/reload', egresadoController.reloadData);

export default router;