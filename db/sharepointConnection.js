import XLSX from "xlsx";
import https from "https";
import { SURVEY_CONFIG } from "../config/fieldMapping.js";

class SharePointConnection {
  constructor() {
    this.surveyData = [];
    this.lastUpdate = null;
    this.cacheExpiration = 2 * 30 * 24 * 60 * 60 * 1000; // 2 meses en milisegundos
    this.sharePointUrl = process.env.SHAREPOINT_EXCEL_URL || "";
    this.isLoading = false;
    
    // Cargar datos inicialmente
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

  // 📌 Descargar archivo Excel desde SharePoint
  async downloadExcel() {
    return new Promise((resolve, reject) => {
      if (!this.sharePointUrl) {
        reject(new Error("URL de SharePoint no configurada en .env (SHAREPOINT_EXCEL_URL)"));
        return;
      }

      console.log(`🌐 Descargando Excel desde SharePoint...`);
      
      https.get(this.sharePointUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        // Manejar redirecciones
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          console.log(`↪️ Siguiendo redirección...`);
          
          https.get(redirectUrl, (redirectResponse) => {
            if (redirectResponse.statusCode !== 200) {
              reject(new Error(`Error HTTP: ${redirectResponse.statusCode}`));
              return;
            }

            const chunks = [];
            redirectResponse.on('data', (chunk) => chunks.push(chunk));
            redirectResponse.on('end', () => {
              const buffer = Buffer.concat(chunks);
              console.log(`✅ Excel descargado: ${(buffer.length / 1024).toFixed(2)} KB`);
              resolve(buffer);
            });
          }).on('error', reject);
          
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Error HTTP: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`✅ Excel descargado: ${(buffer.length / 1024).toFixed(2)} KB`);
          resolve(buffer);
        });
      }).on('error', reject);
    });
  }

  // 📌 Verificar si el cache ha expirado
  isCacheExpired() {
    if (!this.lastUpdate) return true;
    const now = Date.now();
    const timeSinceUpdate = now - this.lastUpdate;
    return timeSinceUpdate > this.cacheExpiration;
  }

  // 📌 Cargar datos del archivo de encuesta desde SharePoint
  async loadData() {
    // Evitar múltiples descargas simultáneas
    if (this.isLoading) {
      console.log(`⏳ Ya hay una descarga en curso, esperando...`);
      return;
    }

    // Si el cache no ha expirado, no recargar
    if (!this.isCacheExpired() && this.surveyData.length > 0) {
      console.log(`✅ Usando datos en cache (última actualización: ${new Date(this.lastUpdate).toLocaleString('es-ES')})`);
      return;
    }

    this.isLoading = true;

    try {
      console.log(`📁 Cargando encuesta desde SharePoint...`);
      console.log(`📋 Hoja objetivo: ${SURVEY_CONFIG.sheetName}`);
      
      // Descargar el archivo
      const buffer = await this.downloadExcel();
      
      // Leer el archivo Excel
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      console.log(`📄 Hojas disponibles:`, workbook.SheetNames);
      
      const sheet = workbook.Sheets[SURVEY_CONFIG.sheetName];
      
      if (!sheet) {
        console.error(`❌ Hoja "${SURVEY_CONFIG.sheetName}" no encontrada`);
        this.surveyData = [];
        this.isLoading = false;
        return;
      }
      
      this.surveyData = XLSX.utils.sheet_to_json(sheet);
      this.lastUpdate = Date.now();
      
      console.log(`✅ Datos de encuesta cargados: ${this.surveyData.length} respuestas encontradas`);
      console.log(`🕐 Cache válido hasta: ${new Date(this.lastUpdate + this.cacheExpiration).toLocaleString('es-ES')}`);
      
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
      console.error("❌ Error cargando archivo de encuesta desde SharePoint:", error.message);
      this.surveyData = [];
    } finally {
      this.isLoading = false;
    }
  }

  // 📌 Verificar si un egresado ha contestado la encuesta
  async hasAnsweredSurvey(cedula) {
    // Recargar datos si el cache ha expirado
    if (this.isCacheExpired()) {
      await this.loadData();
    }

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
    const info = {
      totalRows: this.surveyData.length,
      targetField: SURVEY_CONFIG.cedulaField,
      source: "SharePoint",
      lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toLocaleString('es-ES') : 'Nunca',
      cacheExpiration: `${this.cacheExpiration / (30 * 24 * 60 * 60 * 1000)} meses`,
      sheetName: SURVEY_CONFIG.sheetName
    };
    
    if (this.surveyData.length === 0) {
      return {
        message: "No hay datos cargados",
        info: info,
        samples: [],
        availableColumns: []
      };
    }
    
    const firstRow = this.surveyData[0];
    const availableColumns = Object.keys(firstRow);
    
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
      availableColumns: availableColumns.slice(0, 15),
      fieldExists: availableColumns.includes(SURVEY_CONFIG.cedulaField)
    };
  }

  // 📌 Forzar recarga de datos
  async reloadData() {
    console.log(`🔄 Forzando recarga de datos desde SharePoint...`);
    this.lastUpdate = null; // Invalidar cache
    await this.loadData();
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

    const nextUpdate = this.lastUpdate 
      ? new Date(this.lastUpdate + this.cacheExpiration).toLocaleString('es-ES')
      : 'Desconocido';

    return {
      totalRespuestas: total,
      cedulasUnicas: cedulasUnicas.size,
      ultimaActualizacion: this.lastUpdate 
        ? new Date(this.lastUpdate).toLocaleString('es-ES') 
        : 'Nunca',
      proximaActualizacion: nextUpdate,
      cacheStatus: this.isCacheExpired() ? 'Expirado' : 'Válido'
    };
  }

  // 📌 Obtener información del cache
  getCacheInfo() {
    return {
      lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : null,
      cacheExpiration: this.cacheExpiration,
      isExpired: this.isCacheExpired(),
      timeUntilExpiration: this.lastUpdate 
        ? Math.max(0, (this.lastUpdate + this.cacheExpiration) - Date.now())
        : 0,
      dataLoaded: this.surveyData.length > 0
    };
  }
}

// Crear instancia única (Singleton)
const sharepointConnection = new SharePointConnection();

export default sharepointConnection;
