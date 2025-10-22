import XLSX from "xlsx";
import { SURVEY_CONFIG } from "../config/fieldMapping.js";

class SurveyConnection {
  constructor() {
    this.surveyData = [];
    this.loadData();
  }

  // 📌 Helper para limpiar cédulas (remover apostrofe inicial y espacios)
  cleanCedula(cedula) {
    if (!cedula) return "";
    
    let cleanCedula = cedula.toString().trim();
    
    // Remover apostrofe inicial si existe (formato Excel: '10000000)
    if (cleanCedula.startsWith("'")) {
      cleanCedula = cleanCedula.substring(1);
    }
    
    return cleanCedula;
  }

  // 📌 Cargar datos del archivo de encuesta
  loadData() {
    try {
      console.log(`📁 Cargando archivo: ${SURVEY_CONFIG.fileName}`);
      console.log(`📋 Hoja objetivo: ${SURVEY_CONFIG.sheetName}`);
      
      const workbook = XLSX.readFile(SURVEY_CONFIG.fileName);
      console.log(`📄 Hojas disponibles:`, workbook.SheetNames);
      
      const sheet = workbook.Sheets[SURVEY_CONFIG.sheetName];
      
      if (!sheet) {
        console.error(`❌ Hoja "${SURVEY_CONFIG.sheetName}" no encontrada`);
        this.surveyData = [];
        return;
      }
      
      this.surveyData = XLSX.utils.sheet_to_json(sheet);
      console.log(`✅ Datos de encuesta cargados: ${this.surveyData.length} respuestas encontradas`);
      
      // Debug: mostrar columnas disponibles
      if (this.surveyData.length > 0) {
        const firstRow = this.surveyData[0];
        const columns = Object.keys(firstRow);
        console.log(`🔍 Total columnas encontradas: ${columns.length}`);
        console.log(`📝 Primeras 10 columnas:`, columns.slice(0, 10));
        
        // Buscar la columna objetivo
        const targetField = SURVEY_CONFIG.cedulaField;
        console.log(`🎯 Buscando campo: "${targetField}"`);
        
        const exactMatch = columns.find(col => col === targetField);
        console.log(`📍 Coincidencia exacta: ${exactMatch ? 'SÍ' : 'NO'}`);
        
        if (!exactMatch) {
          // Buscar campos similares
          const similarFields = columns.filter(col => 
            col.toLowerCase().includes('documento') || 
            col.toLowerCase().includes('cedula') ||
            col.toLowerCase().includes('identidad')
          );
          console.log(`🔎 Campos similares encontrados:`, similarFields);
        }
      }
      
    } catch (error) {
      console.error("❌ Error cargando archivo de encuesta:", error.message);
      this.surveyData = [];
    }
  }

  // 📌 Verificar si un egresado ha contestado la encuesta
  hasAnsweredSurvey(cedula) {
    if (!cedula) return false;
    
    // Limpiar la cédula de entrada
    const cedulaStr = this.cleanCedula(cedula);
    
    return this.surveyData.some(response => {
      const responseCedula = response[SURVEY_CONFIG.cedulaField];
      if (!responseCedula) return false;
      
      // Limpiar la cédula de la respuesta
      const cleanResponseCedula = this.cleanCedula(responseCedula);
      
      return cleanResponseCedula === cedulaStr;
    });
  }

  // 📌 Obtener todas las respuestas (para debugging)
  getAllResponses() {
    return this.surveyData;
  }

  // 📌 Debugging: ver cédulas tal como están en el archivo vs limpias
  debugCedulas(limit = 10) {
    // Información general del archivo
    const info = {
      totalRows: this.surveyData.length,
      targetField: SURVEY_CONFIG.cedulaField,
      fileName: SURVEY_CONFIG.fileName,
      sheetName: SURVEY_CONFIG.sheetName
    };
    
    // Si no hay datos, mostrar info básica
    if (this.surveyData.length === 0) {
      return {
        message: "No hay datos cargados",
        info: info,
        samples: [],
        availableColumns: []
      };
    }
    
    // Obtener todas las columnas disponibles
    const firstRow = this.surveyData[0];
    const availableColumns = Object.keys(firstRow);
    
    // Samples de cédulas
    const samples = this.surveyData.slice(0, limit).map((response, index) => {
      const rawCedula = response[SURVEY_CONFIG.cedulaField];
      const cleanCedula = this.cleanCedula(rawCedula);
      return {
        rowIndex: index + 1,
        raw: rawCedula,
        clean: cleanCedula,
        hasApostrophe: rawCedula && rawCedula.toString().startsWith("'"),
        type: typeof rawCedula
      };
    });

    return {
      message: `Muestra de ${samples.length} cédulas del archivo de encuesta`,
      info: info,
      samples: samples,
      availableColumns: availableColumns.slice(0, 15), // Primeras 15 columnas
      fieldExists: availableColumns.includes(SURVEY_CONFIG.cedulaField)
    };
  }

  // 📌 Recargar datos de la encuesta
  reloadData() {
    this.loadData();
    return this.surveyData.length;
  }

  // 📌 Obtener estadísticas de la encuesta
  getStats() {
    const total = this.surveyData.length;
    const cedulasUnicas = new Set();
    
    this.surveyData.forEach(response => {
      const cedula = response[SURVEY_CONFIG.cedulaField];
      if (cedula) {
        const cleanCedula = this.cleanCedula(cedula);
        if (cleanCedula) {
          cedulasUnicas.add(cleanCedula);
        }
      }
    });

    return {
      totalRespuestas: total,
      cedulasUnicas: cedulasUnicas.size,
      ultimaActualizacion: new Date().toISOString()
    };
  }
}

// Crear instancia única (Singleton)
const surveyConnection = new SurveyConnection();

export default surveyConnection;