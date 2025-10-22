import egresadoService from "../services/egresadoService.js";
import pdfGenerator from "../utils/pdfGenerator.js";
import recaptchaService from "../services/recaptchaService.js";

class EgresadoController {

  // 📌 Verificar egresado
  async verify(req, res) {
    try {
      const { cedula, ficha } = req.body;

      const result = await egresadoService.verifyEgresado(cedula, ficha);

      if (!result.found) {
        return res.status(404).json({ 
          message: result.message 
        });
      }

      res.json({
        message: result.message,
        egresado: result.egresado
      });

    } catch (error) {
      console.error("Error en verify:", error);
      
      if (error.message.includes("Faltan campos")) {
        return res.status(400).json({
          message: error.message,
          required: ["cedula", "ficha"]
        });
      }

      res.status(500).json({
        message: "Error interno del servidor",
        error: error.message
      });
    }
  }

  // 📌 Generar carnet PDF (GET - sin reCAPTCHA, para compatibilidad)
  async generateCarnet(req, res) {
    try {
      const { cedula, ficha } = req.params;

      const egresadoData = await egresadoService.getEgresadoForCarnet(cedula, ficha);
      
      await pdfGenerator.generateCarnet(egresadoData, res);

    } catch (error) {
      console.error("Error generando carnet:", error);
      
      if (error.message.includes("no encontrado")) {
        return res.status(404).json({ 
          message: "Egresado no encontrado" 
        });
      }

      res.status(500).json({
        message: "Error generando carnet",
        error: error.message
      });
    }
  }

  // 📌 Generar carnet PDF con reCAPTCHA (POST - nueva ruta principal)
  async generateCarnetWithCaptcha(req, res) {
    try {
      const { cedula, ficha, recaptchaToken } = req.body;

      // Verificar campos requeridos
      if (!cedula || !ficha || !recaptchaToken) {
        return res.status(400).json({
          message: "Faltan campos requeridos",
          required: ["cedula", "ficha", "recaptchaToken"]
        });
      }

      // Verificar reCAPTCHA
      const recaptchaResult = await recaptchaService.verifyRecaptcha(recaptchaToken);
      
      if (!recaptchaResult.valid) {
        return res.status(400).json({
          message: "Verificación de seguridad fallida",
          error: recaptchaResult.message,
          details: recaptchaResult.errorCodes || recaptchaResult.error
        });
      }

      // Obtener datos del egresado
      const egresadoData = await egresadoService.getEgresadoForCarnet(cedula, ficha);
      
      // Generar carnet PDF
      await pdfGenerator.generateCarnet(egresadoData, res);

      // Log de seguridad
      console.log(`✅ Carnet generado con reCAPTCHA - Cédula: ${cedula}, Score: ${recaptchaResult.score || 'N/A'}`);

    } catch (error) {
      console.error("Error generando carnet con reCAPTCHA:", error);
      
      if (error.message.includes("no encontrado")) {
        return res.status(404).json({ 
          message: "Egresado no encontrado" 
        });
      }

      res.status(500).json({
        message: "Error generando carnet",
        error: error.message
      });
    }
  }

  // 📌 Obtener todos los egresados (endpoint administrativo)
  async getAll(req, res) {
    try {
      const egresados = await egresadoService.getAllEgresados();
      
      res.json({
        message: "Egresados obtenidos exitosamente",
        total: egresados.length,
        egresados: egresados
      });

    } catch (error) {
      console.error("Error obteniendo egresados:", error);
      res.status(500).json({
        message: "Error obteniendo egresados",
        error: error.message
      });
    }
  }

  // 📌 Obtener estadísticas
  async getStats(req, res) {
    try {
      const stats = await egresadoService.getStats();
      
      res.json({
        message: "Estadísticas obtenidas exitosamente",
        data: stats
      });

    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      res.status(500).json({
        message: "Error obteniendo estadísticas",
        error: error.message
      });
    }
  }

  // 📌 Generar reporte de estadísticas en PDF
  async generateStatsReport(req, res) {
    try {
      const stats = await egresadoService.getStats();
      
      await pdfGenerator.generateStatsReport(stats, res);

    } catch (error) {
      console.error("Error generando reporte:", error);
      res.status(500).json({
        message: "Error generando reporte",
        error: error.message
      });
    }
  }

  // 📌 Recargar datos del Excel
  async reloadData(req, res) {
    try {
      const result = await egresadoService.reloadData();
      
      res.json(result);

    } catch (error) {
      console.error("Error recargando datos:", error);
      res.status(500).json({
        message: "Error recargando datos",
        error: error.message
      });
    }
  }
}

export default new EgresadoController();