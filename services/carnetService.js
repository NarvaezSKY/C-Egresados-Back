import Carnet from '../models/Carnet.js';
import { v4 as uuidv4 } from 'uuid';

class CarnetService {
  constructor() {
    // Carnets válidos hasta el 31 de diciembre del año en que se generan
  }

  // 📋 Verificar si puede generar nuevo carnet
  async canGenerateCarnet(cedula) {
    try {
      // Buscar carnet válido existente
      const existingCarnet = await Carnet.findValidCarnet(cedula);
      
      if (existingCarnet) {
        const daysRemaining = Math.ceil((existingCarnet.fechaVencimiento - new Date()) / (1000 * 60 * 60 * 24));
        
        return {
          canGenerate: false,
          reason: 'Ya existe un carnet válido',
          existingCarnet: {
            id: existingCarnet.carnetId,
            fechaVencimiento: existingCarnet.fechaVencimiento,
            daysRemaining: daysRemaining
          }
        };
      }
      
      return {
        canGenerate: true,
        reason: 'No existe carnet válido'
      };
    } catch (error) {
      console.error('❌ Error verificando carnet:', error.message);
      return {
        canGenerate: true,
        reason: 'Error verificando - permitir generación'
      };
    }
  }

  // 📋 Registrar nuevo carnet
  async registerCarnet(cedula, egresadoData, metadata = {}) {
    try {
      // Verificar si puede generar
      const canGenerate = await this.canGenerateCarnet(cedula);
      
      if (!canGenerate.canGenerate) {
        throw new Error(`No se puede generar carnet: ${canGenerate.reason}. Válido hasta: ${canGenerate.existingCarnet.fechaVencimiento.toLocaleDateString('es-ES')}`);
      }

      // Buscar si existe algún carnet previo (válido o inválido)
      const existingCarnet = await Carnet.findOne({ cedula: cedula }).sort({ fechaGeneracion: -1 });
      
      const now = new Date();
      // Establecer fecha de vencimiento al 31 de diciembre del año actual
      const fechaVencimiento = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

      if (existingCarnet) {
        // 🔄 REUTILIZAR carnet existente - actualizarlo en lugar de crear uno nuevo
        existingCarnet.ficha = egresadoData.ficha || existingCarnet.ficha || '';
        existingCarnet.nombreCompleto = egresadoData.nombre || existingCarnet.nombreCompleto || '';
        existingCarnet.programa = egresadoData.programa || existingCarnet.programa || '';
        existingCarnet.fechaGeneracion = now;
        existingCarnet.fechaVencimiento = fechaVencimiento;
        existingCarnet.estado = 'valido';
        
        // Actualizar metadata manteniendo campos previos si existen
        existingCarnet.metadata = {
          userAgent: metadata.userAgent || existingCarnet.metadata?.userAgent || '',
          ip: metadata.ip || existingCarnet.metadata?.ip || '',
          recaptchaScore: metadata.recaptchaScore || 'N/A'
        };

        await existingCarnet.save();

        console.log(`🔄 Carnet reactivado - ${cedula}`);

        return {
          id: existingCarnet.carnetId,
          cedula: cedula,
          fechaGeneracion: now,
          fechaVencimiento: fechaVencimiento,
          estado: 'valido'
        };
      } else {
        // ✨ CREAR nuevo carnet solo si no existe ninguno previo
        const carnetId = uuidv4();

        const nuevoCarnet = new Carnet({
          carnetId: carnetId,
          cedula: cedula,
          ficha: egresadoData.ficha || '',
          nombreCompleto: egresadoData.nombre || '',
          programa: egresadoData.programa || '',
          fechaGeneracion: now,
          fechaVencimiento: fechaVencimiento,
          estado: 'valido',
          metadata: {
            userAgent: metadata.userAgent || '',
            ip: metadata.ip || '',
            recaptchaScore: metadata.recaptchaScore || 'N/A'
          }
        });

        await nuevoCarnet.save();

        console.log(`✨ Carnet creado - ${cedula}`);

        return {
          id: carnetId,
          cedula: cedula,
          fechaGeneracion: now,
          fechaVencimiento: fechaVencimiento,
          estado: 'valido'
        };
      }
      
    } catch (error) {
      console.error('❌ Error registrando carnet:', error.message);
      throw error;
    }
  }

  // 📋 Validar carnet por ID
  async validateCarnet(carnetId) {
    try {
      const carnet = await Carnet.findCarnetById(carnetId);
      
      if (!carnet) {
        return {
          valid: false,
          message: 'Carnet no encontrado',
          status: 'not_found'
        };
      }

      const now = new Date();
      const isValid = carnet.isValid();
      
      // Si el carnet expiró, marcarlo como expirado
      if (!isValid && carnet.estado === 'valido') {
        await carnet.markAsExpired();
      }

      const daysRemaining = Math.ceil((carnet.fechaVencimiento - now) / (1000 * 60 * 60 * 24));
      
      return {
        valid: isValid,
        message: isValid ? 'Carnet válido' : 'Carnet expirado',
        status: carnet.estado,
        carnet: {
          id: carnet.carnetId,
          cedula: carnet.cedula,
          ficha: carnet.ficha,
          nombre: carnet.nombreCompleto,
          programa: carnet.programa,
          fechaGeneracion: carnet.fechaGeneracion,
          fechaVencimiento: carnet.fechaVencimiento
        },
        daysRemaining: isValid ? daysRemaining : 0,
        expiresOn: carnet.fechaVencimiento.toLocaleDateString('es-ES')
      };
      
    } catch (error) {
      console.error('❌ Error validando carnet:', error.message);
      return {
        valid: false,
        message: 'Error validando carnet',
        status: 'error'
      };
    }
  }

  // 📋 Obtener carnets de un usuario
  async getUserCarnets(cedula) {
    try {
      const carnets = await Carnet.getUserCarnets(cedula);
      
      return carnets.map(carnet => ({
        id: carnet.carnetId,
        fechaGeneracion: carnet.fechaGeneracion,
        fechaVencimiento: carnet.fechaVencimiento,
        estado: carnet.estado,
        diasRestantes: carnet.estado === 'valido' ? 
          Math.ceil((carnet.fechaVencimiento - new Date()) / (1000 * 60 * 60 * 24)) : 0
      }));
      
    } catch (error) {
      console.error('❌ Error obteniendo carnets de usuario:', error.message);
      return [];
    }
  }

  // 📊 Obtener estadísticas de carnets
  async getStats() {
    try {
      // Primero, marcar carnets expirados
      const expiredCount = await Carnet.expireOldCarnets();
      
      // Obtener estadísticas
      const stats = await Carnet.getStats();
      const totalCarnets = await Carnet.countDocuments();
      
      const statsObject = {
        total: totalCarnets,
        validos: 0,
        expirados: 0,
        revocados: 0,
        expiredUpdated: expiredCount
      };
      
      stats.forEach(stat => {
        statsObject[stat._id] = stat.count;
      });
      
      return statsObject;
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
      return {
        total: 0,
        validos: 0,
        expirados: 0,
        revocados: 0,
        error: error.message
      };
    }
  }

  // 🔄 Limpiar carnets expirados (opcional)
  async cleanupExpiredCarnets() {
    try {
      const expiredCount = await Carnet.expireOldCarnets();
      return expiredCount;
    } catch (error) {
      console.error('❌ Error limpiando carnets expirados:', error.message);
      return 0;
    }
  }

  // 📋 Revocar carnet
  async revokeCarnet(carnetId, reason = 'Revocado por administrador') {
    try {
      const carnet = await Carnet.findCarnetById(carnetId);
      
      if (!carnet) {
        throw new Error('Carnet no encontrado');
      }
      
      await carnet.revoke();
      
      console.log(`🚫 Carnet revocado: ${carnetId.substring(0, 8)} - ${reason}`);
      
      return {
        success: true,
        message: 'Carnet revocado exitosamente',
        carnetId: carnetId
      };
      
    } catch (error) {
      console.error('❌ Error revocando carnet:', error.message);
      throw error;
    }
  }
}

export default new CarnetService();