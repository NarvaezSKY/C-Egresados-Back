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

// 📌 Rutas de gestión de encuesta

// GET /api/egresados/survey/check/:cedula - Verificar si ha contestado la encuesta
router.get('/survey/check/:cedula', egresadoController.checkSurveyStatus);

// POST /api/egresados/survey/reload - Recargar datos de la encuesta
router.post('/survey/reload', egresadoController.reloadSurveyData);

// GET /api/egresados/survey/debug - DEBUG: Ver cédulas de encuesta
router.get('/survey/debug', egresadoController.debugSurveyCedulas);

// 📌 Rutas de gestión de carnets

// GET /api/egresados/carnet/validate/:qrData - Validar carnet por QR
router.get('/carnet/validate/:qrData', egresadoController.validateCarnet);

// GET /api/egresados/carnet/status/:cedula/:ficha - Estado de carnet de usuario
router.get('/carnet/status/:cedula/:ficha', egresadoController.checkCarnetStatus);

// GET /api/egresados/carnet/stats - Estadísticas de carnets
router.get('/carnet/stats', egresadoController.getCarnetStats);

export default router;