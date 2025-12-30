import Egresado from '../models/Egresado.js';
import mongoConnection from '../db/mongoConnection.js';
import surveyConnection from "../db/surveyConnection.js"; // Archivo local
import carnetService from "./carnetService.js";  // Usar el nuevo servicio MongoDB
import qrService from "./qrService.js";

class MongoEgresadoService {
  
  constructor() {
    // Solo usar MongoDB - no más fallback a Excel
    this.mongoOnly = true;
  }

  // 🔗 Verificar conexión a MongoDB
  async ensureMongoConnection() {
    const status = mongoConnection.getConnectionStatus();
    
    // Si no está conectado, intentar conectar
    if (!status.isConnected) {
      console.log('⚠️ MongoDB no conectado, intentando conectar...');
      try {
        await mongoConnection.connect();
        console.log('✅ Conexión a MongoDB establecida');
      } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        throw new Error('MongoDB no está conectado. La generación de carnets requiere base de datos.');
      }
    }
    
    return true;
  }

  // 📌 Buscar egresado por cédula (método principal para carnets)
  async findEgresado(searchCriteria) {
    await this.ensureMongoConnection();
    
    // Si se está buscando solo por cédula, obtener el último registro
    if (Object.keys(searchCriteria).length === 1 && searchCriteria.cedula) {
      const egresado = await Egresado.findByCedula(searchCriteria.cedula);
      return egresado ? this.formatEgresadoForCarnet(egresado) : null;
    }

    // Para otros criterios de búsqueda
    const mongoQuery = this.buildMongoQuery(searchCriteria);
    const egresado = await Egresado.findOne(mongoQuery).lean();
    
    return egresado ? this.formatEgresadoForCarnet(egresado) : null;
  }

  // 🔧 Construir query de MongoDB desde criterios de búsqueda
  buildMongoQuery(searchCriteria) {
    const mongoQuery = { estado: 'activo' };
    
    // Mapear campos de búsqueda a campos de MongoDB
    const fieldMap = {
      cedula: 'numeroDocumento',
      ficha: 'ficha',
      nombre: 'nombreAprendiz',
      programa: 'denominacionPrograma'
    };
    
    for (const [key, value] of Object.entries(searchCriteria)) {
      const mongoField = fieldMap[key] || key;
      mongoQuery[mongoField] = value;
    }
    
    return mongoQuery;
  }

  // 🎯 Formatear egresado de MongoDB para compatibilidad con carnet
  formatEgresadoForCarnet(mongoEgresado) {
    console.log('🔍 DEBUG formatEgresadoForCarnet - Datos de entrada:', {
      centro: mongoEgresado.centro,
      regional: mongoEgresado.regional,
      numeroDocumento: mongoEgresado.numeroDocumento
    });

    return {
      'Número Documento': mongoEgresado.numeroDocumento,
      'Ficha': mongoEgresado.ficha,
      'Nombre Aprendiz': mongoEgresado.nombreAprendiz,
      'Denominación Programa': mongoEgresado.denominacionPrograma,
      'Fecha Certificación': this.formatDateForCarnet(mongoEgresado.fechaCertificacion),
      'Regional': mongoEgresado.regional || 'Regional Cauca',
      'Centro': mongoEgresado.centro || 'Centro de Teleinformática y Producción Industrial'
    };
  }

  // 📅 Formatear fecha para carnet (DD/MM/AAAA)
  formatDateForCarnet(date) {
    if (!date) return 'Fecha no disponible';
    
    try {
      // Si ya es un Date object
      if (date instanceof Date) {
        return date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      // Si es un string, intentar parsearlo
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return 'Fecha no válida';
      }
      
      return parsedDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'Error en fecha';
    }
  }

  // 📌 Verificar credenciales de egresado
  async verifyEgresado(cedula) {
    if (!cedula) {
      throw new Error("Faltan campos requeridos: cedula");
    }

    await this.ensureMongoConnection();
    const egresado = await this.findEgresado({ cedula });

    if (!egresado) {
      return {
        found: false,
        message: "No encontrado"
      };
    }

    const mappedEgresado = await this.mapFieldsOptimized(egresado);
    
    return {
      found: true,
      message: "Encontrado",
      egresado: mappedEgresado
    };
  }

  // 🗺️ Mapear campos optimizado (MongoDB)
  async mapFieldsOptimized(egresado) {
    // Debug: ver qué campos están llegando
    console.log('🔍 DEBUG - Campos del egresado:', {
      centro_mongo: egresado.centro,
      centro_excel: egresado['Centro'],
      regional_mongo: egresado.regional,
      regional_excel: egresado['Regional'],
      todasLasClaves: Object.keys(egresado).filter(k => k.includes('centro') || k.includes('Centro') || k.includes('regional') || k.includes('Regional'))
    });

    const mapped = {
      cedula: egresado.numeroDocumento || egresado['Número Documento'],
      ficha: egresado.ficha || egresado['Ficha'],
      nombre: egresado.nombreAprendiz || egresado['Nombre Aprendiz'],
      programa: egresado.denominacionPrograma || egresado['Denominación Programa'],
      fechaEgreso: egresado.fechaCertificacion || egresado['Fecha Certificación'],
      regional: egresado.regional || egresado['Regional'] || 'Regional Cauca',
      centro: egresado.centro || egresado['Centro'] || 'Centro de Teleinformática y Producción Industrial'
    };

    console.log('✅ DEBUG - Campos mapeados:', {
      centro: mapped.centro,
      regional: mapped.regional
    });

    return mapped;
  }

  // 📋 Obtener egresado para carnet con QR y registro
  async getEgresadoForCarnet(cedula, metadata = {}) {
    if (!cedula) {
      throw new Error("La cédula es requerida para generar el carnet");
    }

    await this.ensureMongoConnection();
    
    // 🔍 VALIDAR QUE HAYA RESPONDIDO LA ENCUESTA (MongoDB o Excel fallback)
    const hasAnsweredSurvey = await surveyConnection.hasAnsweredSurvey(cedula);
    if (!hasAnsweredSurvey) {
      throw new Error("El egresado no ha respondido a la encuesta");
    }
    
    const egresado = await this.findEgresado({ cedula });

    if (!egresado) {
      throw new Error("Egresado no encontrado en la base de datos");
    }

    const mappedEgresado = await this.mapFieldsOptimized(egresado);
    
    // Verificar si ya existe un carnet válido
    const canGenerate = await carnetService.canGenerateCarnet(cedula);
    
    if (!canGenerate.canGenerate) {
      // Si ya existe un carnet válido, lanzar error con información
      const existing = canGenerate.existingCarnet;
      throw new Error(`Ya existe un carnet válido para esta cédula. Válido hasta: ${existing.fechaVencimiento.toLocaleDateString('es-ES')} (${existing.daysRemaining} días restantes)`);
    }
    
    // Registrar nuevo carnet en MongoDB
    const carnetRecord = await carnetService.registerCarnet(cedula, mappedEgresado, metadata);
    
    // Generar QR con datos del carnet (incluye ficha para validación)
    const qrData = {
      id: carnetRecord.id,
      cedula: cedula,
      ficha: mappedEgresado.ficha,
      fechaVencimiento: carnetRecord.fechaVencimiento
    };

    const encodedQR = qrService.generateQRData(qrData);
    
    // Agregar información del carnet al egresado
    mappedEgresado.carnetId = carnetRecord.id;
    mappedEgresado.carnetGenerated = new Date(carnetRecord.fechaGeneracion).toLocaleDateString('es-ES');
    mappedEgresado.carnetExpires = new Date(carnetRecord.fechaVencimiento).toLocaleDateString('es-ES');
    mappedEgresado.qrData = encodedQR;
    
    return mappedEgresado;
  }

  // 📌 Obtener todos los egresados (MongoDB)
  async getAllEgresados() {
    await this.ensureMongoConnection();
    
    try {
      const egresados = await Egresado.find({ estado: 'activo' }).lean();
      return egresados.map(egresado => ({
        cedula: egresado.numeroDocumento,
        ficha: egresado.ficha,
        nombre: egresado.nombreAprendiz,
        programa: egresado.denominacionPrograma,
        fechaEgreso: egresado.fechaCertificacion,
        regional: egresado.regional,
        centro: egresado.centro
      }));
    } catch (error) {
      console.error('❌ Error obteniendo egresados de MongoDB:', error.message);
      throw new Error('Error al obtener egresados de la base de datos');
    }
  }

  // 📊 Estadísticas MongoDB
  async getStats() {
    await this.ensureMongoConnection();
    
    try {
      const [total, programStats] = await Promise.all([
        Egresado.countDocuments({ estado: 'activo' }),
        Egresado.getStatsByProgram()
      ]);

      const programas = {};
      programStats.forEach(stat => {
        programas[stat._id] = stat.count;
      });

      // Obtener estadísticas de la encuesta (desde SharePoint)
      const surveyStats = sharepointConnection.getStats();

      return {
        totalEgresados: total,
        programas: programas,
        encuesta: surveyStats,
        database: {
          type: 'MongoDB',
          connected: true,
          source: 'Atlas Cloud'
        }
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de MongoDB:', error.message);
      throw new Error('Error al obtener estadísticas de la base de datos');
    }
  }

  // 📋 Recargar datos (no aplica para MongoDB)
  async reloadData() {
    return {
      message: "Los datos de MongoDB se actualizan automáticamente",
      count: await Egresado.countDocuments({ estado: 'activo' }),
      source: "MongoDB Atlas"
    };
  }

  // 📊 Estado de encuesta
  async checkSurveyStatus(cedula) {
    const hasAnswered = await sharepointConnection.hasAnsweredSurvey(cedula);
    return {
      cedula: cedula,
      hasAnsweredSurvey: hasAnswered,
      message: hasAnswered ? "Ha contestado la encuesta" : "No ha contestado la encuesta"
    };
  }

  // 📋 Recargar datos de encuesta
  async reloadSurveyData() {
    const count = await sharepointConnection.reloadData();
    return {
      message: "Datos de encuesta recargados exitosamente",
      count: count
    };
  }

  // 🐛 Debug de encuesta
  async debugSurveyCedulas() {
    return sharepointConnection.debugCedulas(20);
  }

  // ✅ Validar carnet por QR
  async validateCarnetByQR(encodedQRData) {
    const qrValidation = qrService.validateQRData(encodedQRData);
    
    if (!qrValidation.valid) {
      return {
        valid: false,
        message: qrValidation.error,
        type: 'qr_invalid'
      };
    }

    const carnetValidation = await carnetService.validateCarnet(qrValidation.data.id);
    
    return {
      valid: carnetValidation.valid,
      message: carnetValidation.message,
      status: carnetValidation.status,
      carnet: carnetValidation.carnet,
      daysRemaining: carnetValidation.daysRemaining,
      expiresOn: carnetValidation.expiresOn,
      type: 'carnet_validation'
    };
  }

  // 📋 Estado de carnet
  async checkCarnetStatus(cedula) {
    const canGenerate = await carnetService.canGenerateCarnet(cedula);
    const userCarnets = await carnetService.getUserCarnets(cedula);

    return {
      cedula: cedula,
      canGenerate: canGenerate.canGenerate,
      reason: canGenerate.reason,
      carnets: userCarnets,
      totalCarnets: userCarnets.length
    };
  }

  // 📊 Estadísticas de carnets
  async getCarnetStats() {
    const stats = await carnetService.getStats();
    return {
      message: "Estadísticas de carnets obtenidas exitosamente",
      data: stats
    };
  }
}

export default new MongoEgresadoService();