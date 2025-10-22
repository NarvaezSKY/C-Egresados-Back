import { Router } from "express";
import egresadoController from "../controllers/egresadoController.js";

const router = Router();

// 📌 Rutas públicas de verificación

// GET /verify - Página web de verificación
router.get('/', egresadoController.verifyPage);

// GET /verify/:qrData - Validación directa por QR
router.get('/:qrData', egresadoController.validateCarnet);

export default router;