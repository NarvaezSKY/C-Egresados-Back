import egresadoService from "../services/egresadoService.js";
import pdfGenerator from "../utils/pdfGenerator.js";
import recaptchaService from "../services/recaptchaService.js";
import qrService from "../services/qrService.js";

class EgresadoController {

  // 📌 Verificar egresado
  async verify(req, res) {
    try {
      const { cedula } = req.body;

      const result = await egresadoService.verifyEgresado(cedula);

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
          required: ["cedula"]
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
      const { cedula } = req.params;

      const egresadoData = await egresadoService.getEgresadoForCarnet(cedula);
      
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
      const { cedula, recaptchaToken } = req.body;

      // Verificar campos requeridos
      if (!cedula || !recaptchaToken) {
        return res.status(400).json({
          message: "Faltan campos requeridos",
          required: ["cedula", "recaptchaToken"]
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

      // Obtener datos del egresado y registrar carnet
      const metadata = {
        userAgent: req.get('User-Agent') || '',
        ip: req.ip || req.connection.remoteAddress || '',
        recaptchaScore: recaptchaResult.score || 'N/A'
      };

      const egresadoData = await egresadoService.getEgresadoForCarnet(cedula, metadata);
      
      // Generar código QR
      let qrBuffer = null;
      try {
        qrBuffer = await qrService.generateQRImage(egresadoData.qrData.verificationUrl);
      } catch (qrError) {
        console.error('⚠️ Error generando QR, continuando sin QR:', qrError.message);
      }
      
      // Generar carnet PDF con QR
      await pdfGenerator.generateCarnet(egresadoData, res, qrBuffer);

      // Log de seguridad
      console.log(`✅ Carnet generado con reCAPTCHA - Cédula: ${cedula}, ID: ${egresadoData.carnetId?.substring(0, 8)}, Score: ${recaptchaResult.score || 'N/A'}`);

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

  // 📌 Verificar estado de encuesta para un egresado
  async checkSurveyStatus(req, res) {
    try {
      const { cedula } = req.params;
      
      const result = await egresadoService.checkSurveyStatus(cedula);
      
      res.json(result);

    } catch (error) {
      console.error("Error verificando estado de encuesta:", error);
      res.status(500).json({
        message: "Error verificando estado de encuesta",
        error: error.message
      });
    }
  }

  // 📌 DEBUG: Ver cédulas de la encuesta
  async debugSurveyCedulas(req, res) {
    try {
      const result = await egresadoService.debugSurveyCedulas();
      
      res.json(result);

    } catch (error) {
      console.error("Error debuggeando cédulas:", error);
      res.status(500).json({
        message: "Error debuggeando cédulas",
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

  // 📌 Recargar datos de la encuesta
  async reloadSurveyData(req, res) {
    try {
      const result = await egresadoService.reloadSurveyData();
      
      res.json(result);

    } catch (error) {
      console.error("Error recargando datos de encuesta:", error);
      res.status(500).json({
        message: "Error recargando datos de encuesta",
        error: error.message
      });
    }
  }

  // 📌 Validar carnet por código QR
  async validateCarnet(req, res) {
    try {
      const { qrData } = req.params;
      
      const validation = await egresadoService.validateCarnetByQR(qrData);
      
      const statusCode = validation.valid ? 200 : 
                        validation.status === 'expired' ? 410 : 
                        validation.status === 'not_found' ? 404 : 400;

      res.status(statusCode).json(validation);

    } catch (error) {
      console.error("Error validando carnet:", error);
      res.status(500).json({
        message: "Error interno validando carnet",
        error: error.message
      });
    }
  }

  // 📌 Verificar estado de carnet de un usuario
  async checkCarnetStatus(req, res) {
    try {
      const { cedula } = req.params;
      
      const status = await egresadoService.checkCarnetStatus(cedula);
      
      res.json(status);

    } catch (error) {
      console.error("Error verificando estado de carnet:", error);
      res.status(500).json({
        message: "Error verificando estado de carnet",
        error: error.message
      });
    }
  }

  // 📌 Obtener estadísticas de carnets
  async getCarnetStats(req, res) {
    try {
      const stats = await egresadoService.getCarnetStats();
      
      res.json(stats);

    } catch (error) {
      console.error("Error obteniendo estadísticas de carnets:", error);
      res.status(500).json({
        message: "Error obteniendo estadísticas",
        error: error.message
      });
    }
  }

  // 📌 Página web simple para verificación de carnets
  async verifyPage(req, res) {
    try {
      const { id } = req.query;
      
      let validation = null;
      if (id) {
        validation = await egresadoService.validateCarnetByQR(id);
      }

      // HTML simple para verificación
      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verificación de Carnet SENA</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .header { text-align: center; color: #39A900; margin-bottom: 30px; }
                .result { padding: 20px; border-radius: 8px; margin: 20px 0; }
                .valid { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
                .invalid { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
                .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
                .input-group { margin: 20px 0; }
                .input-group input { width: 100%; padding: 10px; margin: 5px 0; }
                .button { background: #39A900; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🎓 SENA - Verificación de Carnet</h1>
                <p>Sistema de validación de carnets de egresados</p>
            </div>
            
            ${validation ? `
                <div class="result ${validation.valid ? 'valid' : 'invalid'}">
                    <h3>${validation.valid ? '✅ Carnet Válido' : '❌ Carnet Inválido'}</h3>
                    <p><strong>Estado:</strong> ${validation.message}</p>
                    ${validation.carnet ? `
                        <p><strong>Titular:</strong> ${validation.carnet.nombreCompleto || 'N/A'}</p>
                        <p><strong>Cédula:</strong> ${validation.carnet.cedula}</p>
                        <p><strong>Programa:</strong> ${validation.carnet.programa || 'N/A'}</p>
                        <p><strong>Generado:</strong> ${new Date(validation.carnet.fechaGeneracion).toLocaleDateString('es-ES')}</p>
                        ${validation.valid ? `<p><strong>Días restantes:</strong> ${validation.daysRemaining}</p>` : ''}
                    ` : ''}
                </div>
            ` : `
                <div class="info">
                    <p>Para verificar un carnet, escanee el código QR o ingrese el ID manualmente.</p>
                </div>
            `}
            
            <div class="input-group">
                <label>ID del Carnet:</label>
                <input type="text" id="carnetId" placeholder="Ingrese el ID del carnet">
                <button class="button" onclick="verify()">Verificar</button>
            </div>
            
            <script>
                function verify() {
                    const id = document.getElementById('carnetId').value;
                    if (id) {
                        window.location.href = '?id=' + encodeURIComponent(id);
                    }
                }
            </script>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error) {
      console.error("Error en página de verificación:", error);
      res.status(500).json({
        message: "Error en la verificación",
        error: error.message
      });
    }
  }
}

export default new EgresadoController();