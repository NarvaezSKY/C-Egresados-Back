import xlsx from 'xlsx';
import fs from 'fs';
import mongoConnection from '../db/mongoConnection.js';
import RespuestaEncuesta from '../models/RespuestaEncuesta.js';
import { SURVEY_CONFIG } from '../config/fieldMapping.js';

class SurveyMigrationScript {
  constructor() {
    this.batchSize = 1000;
    this.duplicateCount = 0;
    this.errorCount = 0;
    this.successCount = 0;
    this.logFile = `survey_migration_log_${new Date().toISOString().slice(0,10)}.txt`;
  }

  // 📋 Ejecutar migración de encuesta
  async executeMigration() {
    console.log('🚀 Iniciando migración de Encuesta a MongoDB...\n');
    
    try {
      // 1. Conectar a MongoDB
      await this.connectToMongoDB();
      
      // 2. Leer archivo Excel de encuesta
      const surveyData = await this.readSurveyFile();
      
      // 3. Extraer cédulas únicas
      const cedulas = this.extractUniqueCedulas(surveyData);
      
      // 4. Migrar a MongoDB
      await this.migrateToMongo(cedulas);
      
      // 5. Generar reporte
      await this.generateReport();
      
      console.log('\n✅ ¡Migración de encuesta completada exitosamente!');
      
    } catch (error) {
      console.error('\n❌ Error en la migración:', error.message);
      throw error;
    } finally {
      await mongoConnection.disconnect();
    }
  }

  // 🔌 Conectar a MongoDB
  async connectToMongoDB() {
    console.log('📡 Conectando a MongoDB Atlas...');
    await mongoConnection.connect();
    
    const status = mongoConnection.getConnectionStatus();
    console.log(`✅ Conectado a: ${status.name}`);
  }

  // 📖 Leer archivo Excel de encuesta
  async readSurveyFile() {
    console.log('📖 Leyendo archivo de encuesta...');
    
    const excelPath = SURVEY_CONFIG.fileName;
    console.log(`📁 Archivo: ${excelPath}`);
    
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Archivo no encontrado: ${excelPath}`);
    }
    
    const workbook = xlsx.readFile(excelPath);
    console.log(`📄 Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
    
    const worksheet = workbook.Sheets[SURVEY_CONFIG.sheetName];
    if (!worksheet) {
      throw new Error(`Hoja "${SURVEY_CONFIG.sheetName}" no encontrada`);
    }
    
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    console.log(`✅ Leídas ${jsonData.length} respuestas`);
    
    return jsonData;
  }

  // 🔍 Extraer cédulas únicas
  extractUniqueCedulas(surveyData) {
    console.log('🔍 Extrayendo cédulas únicas...');
    
    const cedulaField = SURVEY_CONFIG.cedulaField;
    const cedulasSet = new Set();
    
    for (const row of surveyData) {
      let cedula = row[cedulaField];
      
      if (!cedula) continue;
      
      // Limpiar cédula
      cedula = String(cedula).trim();
      
      // Remover apostrofe inicial si existe
      if (cedula.startsWith("'")) {
        cedula = cedula.substring(1);
      }
      
      if (cedula) {
        cedulasSet.add(cedula);
      }
    }
    
    const cedulas = Array.from(cedulasSet);
    console.log(`✅ ${cedulas.length} cédulas únicas encontradas`);
    
    return cedulas;
  }

  // 📦 Migrar a MongoDB
  async migrateToMongo(cedulas) {
    console.log(`📦 Migrando ${cedulas.length} cédulas a MongoDB...`);
    
    const totalBatches = Math.ceil(cedulas.length / this.batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * this.batchSize;
      const end = start + this.batchSize;
      const batch = cedulas.slice(start, end);
      
      console.log(`\n📝 Procesando lote ${i + 1}/${totalBatches} (${batch.length} cédulas)...`);
      
      await this.processBatch(batch);
      
      const processed = Math.min(end, cedulas.length);
      const percentage = ((processed / cedulas.length) * 100).toFixed(1);
      console.log(`📊 Progreso: ${processed}/${cedulas.length} (${percentage}%)`);
    }
  }

  // 🔄 Procesar un lote
  async processBatch(batch) {
    const documents = batch.map(cedula => ({
      numeroDocumento: cedula,
      fechaRespuesta: new Date(),
      fechaImportacion: new Date()
    }));
    
    try {
      const result = await RespuestaEncuesta.insertMany(documents, { 
        ordered: false,
        rawResult: true
      });
      
      this.successCount += result.insertedCount || batch.length;
      console.log(`✅ ${result.insertedCount || batch.length} cédulas insertadas`);
      
    } catch (error) {
      if (error.name === 'MongoBulkWriteError') {
        const insertedCount = error.result.nInserted;
        const duplicateErrors = error.writeErrors.filter(err => err.code === 11000);
        const otherErrors = error.writeErrors.filter(err => err.code !== 11000);
        
        this.successCount += insertedCount;
        this.duplicateCount += duplicateErrors.length;
        this.errorCount += otherErrors.length;
        
        console.log(`📊 ${insertedCount} nuevas, ${duplicateErrors.length} duplicadas, ${otherErrors.length} errores`);
      } else {
        this.logError(`Error en lote: ${error.message}`);
        this.errorCount += batch.length;
      }
    }
  }

  // 📊 Generar reporte
  async generateReport() {
    console.log('\n📊 Generando reporte final...');
    
    try {
      const totalRegistros = await RespuestaEncuesta.countDocuments();
      
      const report = `
==========================================================
      📊 REPORTE DE MIGRACIÓN DE ENCUESTA
==========================================================

⏰ Fecha: ${new Date().toLocaleString('es-ES')}

📈 ESTADÍSTICAS:
  ✅ Cédulas nuevas: ${this.successCount}
  🔄 Duplicadas: ${this.duplicateCount}
  ❌ Errores: ${this.errorCount}
  📊 Total en BD: ${totalRegistros}

==========================================================
`;
      
      console.log(report);
      
      fs.writeFileSync(this.logFile, report);
      console.log(`📄 Reporte guardado en: ${this.logFile}`);
      
    } catch (error) {
      console.error('❌ Error generando reporte:', error.message);
    }
  }

  // 📝 Logging
  logError(message) {
    const logMessage = `❌ [${new Date().toISOString()}] ${message}`;
    console.error(logMessage);
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }
}

// 🚀 Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('migrateSurveyToMongo.js')) {
  console.log('🔥 Ejecutando migración de encuesta...');
  
  const migration = new SurveyMigrationScript();
  
  migration.executeMigration()
    .then(() => {
      console.log('\n🎉 ¡Migración de encuesta completada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export default SurveyMigrationScript;
