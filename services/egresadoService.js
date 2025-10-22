import excelConnection from "../db/excelConnection.js";
import surveyConnection from "../db/surveyConnection.js";
import carnetRegistry from "../db/carnetRegistry.js";
import qrService from "./qrService.js";

class EgresadoService {
  
  // 📌 Buscar egresado con criterios específicos
  findEgresado(searchCriteria) {
    const egresados = excelConnection.getAllEgresados();
    
    return egresados.find((egresado) => {
      const mappedEgresado = excelConnection.mapFields(egresado);
      return Object.entries(searchCriteria).every(([key, value]) => {
        return mappedEgresado[key] == value;
      });
    });
  }

  // 📌 Verificar credenciales de egresado
  async verifyEgresado(cedula, ficha) {
    if (!cedula || !ficha) {
      throw new Error("Faltan campos requeridos: cedula y ficha");
    }

    const egresado = this.findEgresado({ cedula, ficha });

    if (!egresado) {
      return {
        found: false,
        message: "No encontrado"
      };
    }

    const mappedEgresado = excelConnection.mapFields(egresado);
    
    return {
      found: true,
      message: "Encontrado",
      egresado: mappedEgresado
    };
  }

  // 📌 Obtener datos de egresado para carnet
  async getEgresadoForCarnet(cedula, ficha, metadata = {}) {
    // 1. Verificar si el egresado existe
    const egresado = this.findEgresado({ cedula, ficha });

    if (!egresado) {
      throw new Error("Egresado no encontrado");
    }

    // 2. Verificar si ha contestado la encuesta
    const hasAnsweredSurvey = surveyConnection.hasAnsweredSurvey(cedula);
    
    if (!hasAnsweredSurvey) {
      throw new Error("No has contestado a la encuesta de egresados. Puedes encontrar el enlace arriba, en los pasos de la generación del carnet.");
    }

    // 3. Verificar si puede generar un nuevo carnet (límite de 30 días)
    const canGenerate = carnetRegistry.canGenerateCarnet(cedula, ficha);
    
    if (!canGenerate.canGenerate) {
      throw new Error(`No puedes generar un nuevo carnet. ${canGenerate.message}. Podrás generar uno nuevo el ${canGenerate.nextAvailableDate}`);
    }

    const mappedEgresado = excelConnection.mapFields(egresado);
    
    // Formatear fecha para el carnet
    mappedEgresado.fechaEgreso = excelConnection.formatDate(mappedEgresado.fechaEgreso);
    
    // 4. Registrar el nuevo carnet
    const carnetRecord = carnetRegistry.registerCarnet(cedula, ficha, mappedEgresado, metadata);
    
    // 5. Generar datos del QR
    const qrData = qrService.generateQRData(carnetRecord);
    
    // Agregar información del carnet al egresado
    mappedEgresado.carnetId = carnetRecord.id;
    mappedEgresado.carnetExpires = new Date(carnetRecord.fechaVencimiento).toLocaleDateString('es-ES');
    mappedEgresado.qrData = qrData;
    
    return mappedEgresado;
  }

  // 📌 Obtener todos los egresados (útil para administración)
  async getAllEgresados() {
    const egresados = excelConnection.getAllEgresados();
    return egresados.map(egresado => excelConnection.mapFields(egresado));
  }

  // 📌 Recargar datos del Excel
  async reloadData() {
    const count = excelConnection.reloadData();
    return {
      message: "Datos recargados exitosamente",
      count: count
    };
  }

  // 📌 Verificar si un egresado ha contestado la encuesta
  async checkSurveyStatus(cedula) {
    const hasAnswered = surveyConnection.hasAnsweredSurvey(cedula);
    return {
      cedula: cedula,
      hasAnsweredSurvey: hasAnswered,
      message: hasAnswered ? "Ha contestado la encuesta" : "No ha contestado la encuesta"
    };
  }

  // 📌 Recargar datos de encuesta
  async reloadSurveyData() {
    const count = surveyConnection.reloadData();
    return {
      message: "Datos de encuesta recargados exitosamente",
      count: count
    };
  }

  // 📌 DEBUG: Ver cédulas de la encuesta
  async debugSurveyCedulas() {
    return surveyConnection.debugCedulas(20);
  }

  // 📌 Validar carnet por código QR
  async validateCarnetByQR(encodedQRData) {
    // Validar formato del QR
    const qrValidation = qrService.validateQRData(encodedQRData);
    
    if (!qrValidation.valid) {
      return {
        valid: false,
        message: qrValidation.error,
        type: 'qr_invalid'
      };
    }

    // Validar carnet en el registro
    const carnetValidation = carnetRegistry.validateCarnet(qrValidation.data.id);
    
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

  // 📌 Verificar estado de carnet por cédula
  async checkCarnetStatus(cedula, ficha) {
    const canGenerate = carnetRegistry.canGenerateCarnet(cedula, ficha);
    const userCarnets = carnetRegistry.getUserCarnets(cedula, ficha);

    return {
      canGenerateNew: canGenerate.canGenerate,
      message: canGenerate.message || "Puede generar nuevo carnet",
      activeCarnet: canGenerate.activeCarnet || null,
      daysRemaining: canGenerate.daysRemaining || 0,
      nextAvailableDate: canGenerate.nextAvailableDate || null,
      carnetHistory: userCarnets.slice(0, 5) // Últimos 5 carnets
    };
  }

  // 📌 Obtener estadísticas de carnets
  async getCarnetStats() {
    // Limpiar carnets vencidos antes de generar estadísticas
    const cleaned = carnetRegistry.cleanupExpiredCarnets();
    
    const stats = carnetRegistry.getStats();
    
    return {
      ...stats,
      cleanedUp: cleaned,
      lastCleanup: new Date().toISOString()
    };
  }

  // 📌 Estadísticas básicas
  async getStats() {
    const egresados = excelConnection.getAllEgresados();
    const mappedEgresados = egresados.map(egresado => excelConnection.mapFields(egresado));

    // Agrupar por programa
    const programas = {};
    mappedEgresados.forEach(egresado => {
      const programa = egresado.programa || "Sin programa";
      programas[programa] = (programas[programa] || 0) + 1;
    });

    // Obtener estadísticas de la encuesta
    const surveyStats = surveyConnection.getStats();

    return {
      egresados: {
        total: mappedEgresados.length,
        programas: programas
      },
      encuesta: surveyStats,
      ultimaActualizacion: new Date().toISOString()
    };
  }
}

export default new EgresadoService();