import XLSX from "xlsx";
import { google } from "googleapis";
import { SURVEY_CONFIG } from "../config/fieldMapping.js";
import mongoConnection from "./mongoConnection.js";
import RespuestaEncuesta from "../models/RespuestaEncuesta.js";

const isProduction = process.env.NODE_ENV === "production";
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

class SurveyConnection {
  constructor() {
    this.surveyData = [];
    this.useMongoFallback = true;
    this.googleSheetsCache = [];
    this.googleSheetsLastSync = 0;
    this.googleSheetsCacheTTL = SURVEY_CONFIG.googleCacheTTLms;
    this.loadData();
  }

  sanitizeEnvValue(value) {
    if (!value || typeof value !== "string") return "";
    return value.trim().replace(/^['"]|['"]$/g, "");
  }

  parseGoogleCredentials() {
    try {
      const rawCredentials = this.sanitizeEnvValue(SURVEY_CONFIG.googleCredentials);
      if (rawCredentials) {
        const parsed = JSON.parse(rawCredentials);
        if (parsed.client_email && parsed.private_key) {
          parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
          return parsed;
        }
      }

      const clientEmail = this.sanitizeEnvValue(SURVEY_CONFIG.googleServiceAccountEmail);
      const privateKey = this.sanitizeEnvValue(SURVEY_CONFIG.googlePrivateKey);
      if (clientEmail && privateKey) {
        return {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, "\n")
        };
      }

      return null;
    } catch (error) {
      console.warn("⚠️ GOOGLE_CREDENTIALS no tiene un JSON válido:", error.message);

      const clientEmail = this.sanitizeEnvValue(SURVEY_CONFIG.googleServiceAccountEmail);
      const privateKey = this.sanitizeEnvValue(SURVEY_CONFIG.googlePrivateKey);
      if (clientEmail && privateKey) {
        return {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, "\n")
        };
      }

      return null;
    }
  }

  getGoogleSheetsConfig() {
    const spreadsheetId = this.sanitizeEnvValue(SURVEY_CONFIG.spreadsheetId);
    const sheetName = this.sanitizeEnvValue(SURVEY_CONFIG.googleSheetName);
    const credentials = this.parseGoogleCredentials();

    return {
      enabled: SURVEY_CONFIG.googleEnabled,
      spreadsheetId,
      sheetName,
      credentials,
      ready: Boolean(SURVEY_CONFIG.googleEnabled && spreadsheetId && sheetName && credentials)
    };
  }

  async loadGoogleSheetData(force = false) {
    const config = this.getGoogleSheetsConfig();
    if (!config.ready) {
      return [];
    }

    const now = Date.now();
    const cacheIsValid = !force && this.googleSheetsCache.length > 0 && (now - this.googleSheetsLastSync) < this.googleSheetsCacheTTL;
    if (cacheIsValid) {
      return this.googleSheetsCache;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: config.credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
      });

      const sheets = google.sheets({ version: "v4", auth });
      const range = `${config.sheetName}!A:ZZ`;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        this.googleSheetsCache = [];
        this.googleSheetsLastSync = now;
        return [];
      }

      const [headers, ...dataRows] = rows;
      this.googleSheetsCache = dataRows.map((row) => {
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header] = row[index] || "";
        });
        return rowObject;
      });

      this.googleSheetsLastSync = now;
      return this.googleSheetsCache;
    } catch (error) {
      console.warn("⚠️ Error leyendo Google Sheets:", error.message);
      return [];
    }
  }

  async hasAnsweredSurveyInGoogleSheets(cedula) {
    const cedulaStr = this.cleanCedula(cedula);
    if (!cedulaStr) return false;

    const googleRows = await this.loadGoogleSheetData();
    if (!googleRows.length) return false;

    const exists = googleRows.some((response) => {
      const responseCedula = response[SURVEY_CONFIG.cedulaField];
      if (!responseCedula) return false;

      const cleanResponseCedula = this.cleanCedula(responseCedula);
      return cleanResponseCedula === cedulaStr;
    });

    debugLog(`🔍 Verificación de encuesta (Google Sheets) → ${exists ? 'SÍ' : 'NO'}`);
    return exists;
  }

  async hasAnsweredSurveyInMongo(cedula) {
    const cedulaStr = this.cleanCedula(cedula);
    if (!cedulaStr || !this.useMongoFallback) return false;

    try {
      const status = mongoConnection.getConnectionStatus();
      if (!status.isConnected) {
        return false;
      }

      const exists = await RespuestaEncuesta.hasAnswered(cedulaStr);
      debugLog(`🔍 Verificación de encuesta (MongoDB) → ${exists ? 'SÍ' : 'NO'}`);
      return exists;
    } catch (error) {
      console.warn("⚠️ Error consultando MongoDB para encuesta:", error.message);
      return false;
    }
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
      debugLog(`📁 Cargando archivo de encuesta`);
      debugLog(`📋 Hoja objetivo: ${SURVEY_CONFIG.sheetName}`);
      
      const workbook = XLSX.readFile(SURVEY_CONFIG.fileName);
      debugLog(`📄 Hojas disponibles:`, workbook.SheetNames);
      
      const sheet = workbook.Sheets[SURVEY_CONFIG.sheetName];
      
      if (!sheet) {
        console.error(`❌ Hoja "${SURVEY_CONFIG.sheetName}" no encontrada`);
        this.surveyData = [];
        return;
      }
      
      this.surveyData = XLSX.utils.sheet_to_json(sheet);
      debugLog(`✅ Datos de encuesta cargados: ${this.surveyData.length} respuestas encontradas`);
      
      // Debug: mostrar columnas disponibles
      if (this.surveyData.length > 0) {
        const firstRow = this.surveyData[0];
        const columns = Object.keys(firstRow);
        debugLog(`🔍 Total columnas encontradas: ${columns.length}`);
        debugLog(`📝 Primeras 10 columnas:`, columns.slice(0, 10));
        
        // Buscar la columna objetivo
        const targetField = SURVEY_CONFIG.cedulaField;
        debugLog(`🎯 Buscando campo: "${targetField}"`);
        
        const exactMatch = columns.find(col => col === targetField);
        debugLog(`📍 Coincidencia exacta: ${exactMatch ? 'SÍ' : 'NO'}`);
        
        if (!exactMatch) {
          // Buscar campos similares
          const similarFields = columns.filter(col => 
            col.toLowerCase().includes('documento') || 
            col.toLowerCase().includes('cedula') ||
            col.toLowerCase().includes('identidad')
          );
          debugLog(`🔎 Campos similares encontrados:`, similarFields);
        }
      }
      
    } catch (error) {
      console.error("❌ Error cargando archivo de encuesta:", error.message);
      this.surveyData = [];
    }
  }

  // 📌 Verificar si un egresado ha contestado la encuesta
  async hasAnsweredSurvey(cedula) {
    if (!cedula) return false;

    const existsInGoogleSheets = await this.hasAnsweredSurveyInGoogleSheets(cedula);
    if (existsInGoogleSheets) {
      return true;
    }

    const existsInMongo = await this.hasAnsweredSurveyInMongo(cedula);
    if (existsInMongo) {
      return true;
    }

    return false;
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
    this.googleSheetsCache = [];
    this.googleSheetsLastSync = 0;
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