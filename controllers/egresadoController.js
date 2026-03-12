import egresadoServiceMongo from "../services/egresadoServiceMongo.js";
import pdfGenerator from "../utils/pdfGenerator.js";
import recaptchaService from "../services/recaptchaService.js";
import qrService from "../services/qrService.js";

const isProduction = process.env.NODE_ENV === 'production';

class EgresadoController {
  constructor() {
    // Rate limiting: IP -> [timestamps]
    this.rateLimitMap = new Map();
    this.RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora en ms
    this.MAX_REQUESTS_PER_HOUR = 10;
    
    // Limpiar rate limit cache cada hora
    setInterval(() => this.cleanupRateLimitMap(), this.RATE_LIMIT_WINDOW);
  }

  // 🛡️ Verificar rate limit por IP
  checkRateLimit = (ip) => {
    const now = Date.now();
    
    if (!this.rateLimitMap.has(ip)) {
      this.rateLimitMap.set(ip, [now]);
      return { allowed: true, remaining: this.MAX_REQUESTS_PER_HOUR - 1 };
    }
    
    const timestamps = this.rateLimitMap.get(ip);
    // Filtrar requests dentro de la ventana de tiempo
    const recentRequests = timestamps.filter(t => now - t < this.RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= this.MAX_REQUESTS_PER_HOUR) {
      const oldestRequest = Math.min(...recentRequests);
      const retryAfter = Math.ceil((oldestRequest + this.RATE_LIMIT_WINDOW - now) / 1000 / 60); // minutos
      
      return { 
        allowed: false, 
        remaining: 0,
        retryAfter: retryAfter
      };
    }
    
    recentRequests.push(now);
    this.rateLimitMap.set(ip, recentRequests);
    
    return { 
      allowed: true, 
      remaining: this.MAX_REQUESTS_PER_HOUR - recentRequests.length 
    };
  }

  // 🧹 Limpiar mapa de rate limiting
  cleanupRateLimitMap = () => {
    const now = Date.now();
    for (const [ip, timestamps] of this.rateLimitMap.entries()) {
      const recentRequests = timestamps.filter(t => now - t < this.RATE_LIMIT_WINDOW);
      if (recentRequests.length === 0) {
        this.rateLimitMap.delete(ip);
      } else {
        this.rateLimitMap.set(ip, recentRequests);
      }
    }
  }

  // 📌 Verificar egresado
  verify = async (req, res) => {
    try {
      const { cedula } = req.body;

      const result = await egresadoServiceMongo.verifyEgresado(cedula);

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
      console.error("Error en verify:", isProduction ? error.message : error);
      
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
  generateCarnet = async (req, res) => {
    try {
      const { cedula } = req.params;

      const egresadoData = await egresadoServiceMongo.getEgresadoForCarnet(cedula);
      
      await pdfGenerator.generateCarnet(egresadoData, res);

    } catch (error) {
      console.error("Error generando carnet:", isProduction ? error.message : error);
      
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
  generateCarnetWithCaptcha = async (req, res) => {
    try {
      const { cedula, recaptchaToken } = req.body;

      // Verificar campos requeridos
      if (!cedula || !recaptchaToken) {
        return res.status(400).json({
          message: "Faltan campos requeridos",
          required: ["cedula", "recaptchaToken"]
        });
      }

      // 🛡️ Verificar rate limit
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const rateLimitResult = this.checkRateLimit(clientIp);
      
      // Agregar headers de rate limit
      res.setHeader('X-RateLimit-Limit', this.MAX_REQUESTS_PER_HOUR);
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
      
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          message: `Has alcanzado el límite de ${this.MAX_REQUESTS_PER_HOUR} descargas por hora. Por favor intenta nuevamente en ${rateLimitResult.retryAfter} minuto${rateLimitResult.retryAfter !== 1 ? 's' : ''}.`,
          error: "Límite de descargas excedido. Inténtalo nuevamente en 1 hora."
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

      const egresadoData = await egresadoServiceMongo.getEgresadoForCarnet(cedula, metadata);
      
      // Generar código QR
      let qrBuffer = null;
      try {
        qrBuffer = await qrService.generateQRImage(egresadoData.qrData.verificationUrl);
      } catch (qrError) {
        console.error('⚠️ Error generando QR, continuando sin QR:', qrError.message);
      }
      
      // Generar carnet PDF con QR
      await pdfGenerator.generateCarnet(egresadoData, res, qrBuffer);

    } catch (error) {
      console.error("Error generando carnet con reCAPTCHA:", isProduction ? error.message : error);
      
      if (error.message.includes("no encontrado")) {
        return res.status(404).json({ 
          message: "Egresado no encontrado" 
        });
      }

      if (error.message.includes("no ha respondido a la encuesta")) {
        return res.status(403).json({
          message: "Encuesta pendiente",
          error: error.message
        });
      }

      res.status(500).json({
        message: "Error generando carnet",
        error: error.message
      });
    }
  }  // 📌 Obtener todos los egresados (endpoint administrativo)
  getAll = async (req, res) => {
    try {
      const egresados = await egresadoServiceMongo.getAllEgresados();
      
      res.json({
        message: "Egresados obtenidos exitosamente",
        total: egresados.length,
        egresados: egresados
      });

    } catch (error) {
      console.error("Error obteniendo egresados:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error obteniendo egresados",
        error: error.message
      });
    }
  }

  // 📌 Obtener estadísticas
  getStats = async (req, res) => {
    try {
      const stats = await egresadoServiceMongo.getStats();
      
      res.json({
        message: "Estadísticas obtenidas exitosamente",
        data: stats
      });

    } catch (error) {
      console.error("Error obteniendo estadísticas:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error obteniendo estadísticas",
        error: error.message
      });
    }
  }

  // 📌 Generar reporte de estadísticas en PDF
  generateStatsReport = async (req, res) => {
    try {
      const stats = await egresadoServiceMongo.getStats();
      
      await pdfGenerator.generateStatsReport(stats, res);

    } catch (error) {
      console.error("Error generando reporte:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error generando reporte",
        error: error.message
      });
    }
  }

  // 📌 Verificar estado de encuesta para un egresado
  checkSurveyStatus = async (req, res) => {
    try {
      const { cedula } = req.params;
      
      const result = await egresadoServiceMongo.checkSurveyStatus(cedula);
      
      res.json(result);

    } catch (error) {
      console.error("Error verificando estado de encuesta:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error verificando estado de encuesta",
        error: error.message
      });
    }
  }

  // 📌 DEBUG: Ver cédulas de la encuesta
  debugSurveyCedulas = async (req, res) => {
    try {
      const result = await egresadoServiceMongo.debugSurveyCedulas();
      
      res.json(result);

    } catch (error) {
      console.error("Error debuggeando cédulas:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error debuggeando cédulas",
        error: error.message
      });
    }
  }

  // 📌 Recargar datos del Excel
  reloadData = async (req, res) => {
    try {
      const result = await egresadoServiceMongo.reloadData();
      
      res.json(result);

    } catch (error) {
      console.error("Error recargando datos:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error recargando datos",
        error: error.message
      });
    }
  }

  // 📌 Recargar datos de la encuesta
  reloadSurveyData = async (req, res) => {
    try {
      const result = await egresadoServiceMongo.reloadSurveyData();
      
      res.json(result);

    } catch (error) {
      console.error("Error recargando datos de encuesta:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error recargando datos de encuesta",
        error: error.message
      });
    }
  }

  // 📌 Validar carnet por código QR
  validateCarnet = async (req, res) => {
    try {
      const { qrData } = req.params;
      
      const validation = await egresadoServiceMongo.validateCarnetByQR(qrData);
      
      // Determinar código HTTP apropiado
      let statusCode = 200; // Por defecto OK
      
      if (validation.type === 'qr_invalid') {
        // QR malformado o inválido
        statusCode = 400;
      } else if (validation.status === 'not_found') {
        // Carnet no encontrado
        statusCode = 404;
      } else if (validation.status === 'expirado') {
        // Carnet expirado - 200 OK con información de expiración
        statusCode = 200;
      } else if (validation.status === 'revocado') {
        // Carnet revocado - 410 Gone
        statusCode = 410;
      }

      res.status(statusCode).json(validation);

    } catch (error) {
      console.error("Error validando carnet:", isProduction ? error.message : error);
      res.status(500).json({
        message: "Error interno validando carnet",
        error: error.message
      });
    }
  }

  // 📌 Verificar estado de carnet de un usuario
  checkCarnetStatus = async (req, res) => {
    try {
      const { cedula } = req.params;
      
      const status = await egresadoServiceMongo.checkCarnetStatus(cedula);
      
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
  getCarnetStats = async (req, res) => {
    try {
      const stats = await egresadoServiceMongo.getCarnetStats();
      
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
  verifyPage = async (req, res) => {
    try {
      const { id } = req.query;
      
      let validation = null;
      if (id) {
        validation = await egresadoServiceMongo.validateCarnetByQR(id);
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
