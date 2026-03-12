import axios from 'axios';

const isProduction = process.env.NODE_ENV === 'production';
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

class RecaptchaService {
  
  // 📌 Verificar token de reCAPTCHA con Google
  async verifyRecaptcha(token) {
    try {
      if (!token) {
        throw new Error('Token de reCAPTCHA requerido');
      }

      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      
      if (!secretKey) {
        throw new Error('RECAPTCHA_SECRET_KEY no configurada en variables de entorno');
      }

      // Hacer petición a Google reCAPTCHA
      const response = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: secretKey,
            response: token
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { success, score, action, hostname, error_codes } = response.data;

      // Validar respuesta
      if (!success) {
        console.warn('reCAPTCHA verification failed:', {
          error_codes,
          hostname,
          action
        });
        
        return {
          valid: false,
          message: 'Verificación de reCAPTCHA fallida',
          errorCodes: error_codes
        };
      }

      // Para reCAPTCHA v3, verificar el score (opcional)
      if (score !== undefined && score < 0.5) {
        console.warn('reCAPTCHA score too low:', score);
        
        return {
          valid: false,
          message: 'Verificación de reCAPTCHA: puntuación demasiado baja',
          score: score
        };
      }

      debugLog('reCAPTCHA verification successful:', {
        score: score || 'N/A (v2)',
        action: action || 'N/A',
        hostname
      });

      return {
        valid: true,
        message: 'reCAPTCHA verificado exitosamente',
        score: score,
        action: action,
        hostname: hostname
      };

    } catch (error) {
      console.error('Error verificando reCAPTCHA:', error.message);
      
      if (error.response && !isProduction) {
        console.error('Google reCAPTCHA response error:', error.response.data);
      }

      return {
        valid: false,
        message: 'Error interno verificando reCAPTCHA',
        error: error.message
      };
    }
  }

  // 📌 Middleware para verificar reCAPTCHA automáticamente
  async middleware(req, res, next) {
    try {
      const { recaptchaToken } = req.body;

      // Verificar token
      const result = await this.verifyRecaptcha(recaptchaToken);

      if (!result.valid) {
        return res.status(400).json({
          message: 'Verificación de seguridad fallida',
          error: result.message,
          details: result.errorCodes || result.error
        });
      }

      // Agregar información del reCAPTCHA a la request
      req.recaptcha = result;
      next();

    } catch (error) {
      console.error('Error en middleware reCAPTCHA:', isProduction ? error.message : error);
      res.status(500).json({
        message: 'Error interno en verificación de seguridad',
        error: error.message
      });
    }
  }
}

export default new RecaptchaService();