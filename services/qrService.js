import QRCode from 'qrcode';
import crypto from 'crypto';

class QRService {
  constructor() {
    // Clave secreta para firmar QR (deberías ponerla en .env)
    this.secretKey = process.env.QR_SECRET_KEY || 'sena-carnet-secret-2024-cauca';
    this.baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  }

  // 📌 Generar datos para el QR
  generateQRData(carnetRecord) {
    const qrPayload = {
      id: carnetRecord.id,
      cedula: carnetRecord.cedula,
      ficha: carnetRecord.ficha,
      exp: new Date(carnetRecord.fechaVencimiento).getTime(),
      iat: Date.now() // issued at
    };

    // Crear firma digital del payload
    const signature = this.createSignature(qrPayload);
    qrPayload.sig = signature;

    // Codificar en base64 para el QR
    const encodedData = Buffer.from(JSON.stringify(qrPayload)).toString('base64url');
    
    return {
      qrData: encodedData,
      verificationUrl: `${this.baseUrl}/verify/${encodedData}`,
      payload: qrPayload
    };
  }

  // 📌 Crear firma digital
  createSignature(payload) {
    const payloadString = JSON.stringify({
      id: payload.id,
      cedula: payload.cedula,
      ficha: payload.ficha,
      exp: payload.exp
    });
    
    return crypto.createHmac('sha256', this.secretKey)
                 .update(payloadString)
                 .digest('hex')
                 .substring(0, 16);
  }

  // 📌 Generar imagen QR
  async generateQRImage(qrData, options = {}) {
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: options.size || 120,
      ...options
    };

    try {
      const qrBuffer = await QRCode.toBuffer(qrData, qrOptions);
      return qrBuffer;
    } catch (error) {
      console.error('❌ Error generando QR:', error);
      throw new Error('Error al generar código QR');
    }
  }

  // 📌 Validar y decodificar QR
  validateQRData(encodedData) {
    try {
      // Decodificar desde base64url
      const decodedString = Buffer.from(encodedData, 'base64url').toString('utf8');
      const qrPayload = JSON.parse(decodedString);

      // Verificar campos requeridos
      const requiredFields = ['id', 'cedula', 'ficha', 'exp', 'sig'];
      for (const field of requiredFields) {
        if (!qrPayload[field]) {
          return {
            valid: false,
            error: `QR inválido: falta el campo ${field}`
          };
        }
      }

      // Verificar firma digital
      const expectedSignature = this.createSignature(qrPayload);
      if (qrPayload.sig !== expectedSignature) {
        return {
          valid: false,
          error: 'QR inválido: firma digital no coincide'
        };
      }

      // Verificar vencimiento del QR
      const now = Date.now();
      if (now > qrPayload.exp) {
        return {
          valid: false,
          error: 'QR vencido',
          expired: true,
          expiredDate: new Date(qrPayload.exp)
        };
      }

      return {
        valid: true,
        data: qrPayload
      };

    } catch (error) {
      return {
        valid: false,
        error: 'QR inválido: formato incorrecto'
      };
    }
  }

  // 📌 Generar QR con URL de verificación web
  async generateWebVerificationQR(carnetRecord, options = {}) {
    const verificationUrl = `${this.baseUrl}/verify?id=${carnetRecord.id}`;
    
    return await this.generateQRImage(verificationUrl, {
      size: 100,
      ...options
    });
  }

  // 📌 Generar QR con ruta API
  generateAPIVerificationURL(carnetRecord) {
    const qrPayload = this.generateQRData(carnetRecord);
    return `${this.baseUrl}/api/carnet/verify/${qrPayload.qrData}`;
  }

  // 📌 Generar QR con ruta web amigable
  generateFriendlyVerificationURL(carnetRecord) {
    return `${this.baseUrl}/carnet/verificar/${carnetRecord.id}`;
  }

  // 📌 Generar QR con página de verificación completa
  generateFullVerificationURL(carnetRecord) {
    return `${this.baseUrl}/verificar-carnet?c=${carnetRecord.cedula}&id=${carnetRecord.id}`;
  }
}

export default new QRService();