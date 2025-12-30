import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import mongoConnection from '../db/mongoConnection.js';
import Egresado from '../models/Egresado.js';
// 📌 Mapeo OPTIMIZADO de campos (solo campos esenciales para carnets)
const OPTIMIZED_FIELD_MAPPING = {
  numeroDocumento: "Número Documento",
  ficha: "Ficha", 
  nombreAprendiz: "Nombre Aprendiz",
  denominacionPrograma: "Denominación Programa",
  fechaCertificacion: "Fecha Certificación",
  regional: "Regional"
  // centro NO está en Excel, se infiere del nombre de la hoja
};

// 📌 Mapeo de nombres de hojas a centros de formación
const SHEET_TO_CENTRO = {
  "CTPI": "Centro de Teleinformática y Producción Industrial",
  "AGROPECUARIO": "Centro Agropecuario",
  "COMERCIO Y SERVICIOS": "Centro de Comercio y Servicios"
};

class OptimizedMigrationScript {
  constructor() {
    this.batchSize = 500; // Aumentar tamaño de lote para mejor rendimiento
    this.duplicateCount = 0;
    this.errorCount = 0;
    this.successCount = 0;
    this.logFile = `migration_log_${new Date().toISOString().slice(0,10)}.txt`;
  }

  // 📋 Ejecutar migración completa
  async executeMigration() {
    console.log('🚀 Iniciando migración de Excel a MongoDB Atlas...\n');
    
    try {
      // 1. Conectar a MongoDB
      await this.connectToMongoDB();
      
      // 2. Leer archivo Excel
      const excelData = await this.readExcelFile();
      
      // 3. Validar datos
      const validatedData = await this.validateData(excelData);
      
      // 4. Migrar en lotes
      await this.migrateInBatches(validatedData);
      
      // 5. Generar reporte final
      await this.generateReport();
      
      console.log('\n✅ ¡Migración completada exitosamente!');
      
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
    
    // Verificar conexión
    const status = mongoConnection.getConnectionStatus();
    console.log(`✅ Conectado a: ${status.name} (${status.readyStateText})`);
  }

  // 📖 Leer archivo Excel - TODAS LAS HOJAS
  async readExcelFile() {
    console.log('📖 Leyendo archivo Excel...');
    
    // Usar configuración del .env
    const excelPath = process.env.EXCEL_FILE_PATH || './DBEGRESADOS.xlsx';
    
    console.log(`📁 Archivo: ${excelPath}`);
    
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Archivo no encontrado: ${excelPath}`);
    }
    
    const workbook = xlsx.readFile(excelPath);
    console.log(`📄 Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
    
    // Procesar todas las hojas principales (excluir hojas auxiliares)
    const sheetsToProcess = workbook.SheetNames.filter(name => 
      !name.toLowerCase().includes('aux') && 
      !name.toLowerCase().includes('temp') && 
      !name.toLowerCase().includes('test')
    );
    
    console.log(`🔍 Procesando hojas: ${sheetsToProcess.join(', ')}`);
    
    let allData = [];
    
    for (const sheetName of sheetsToProcess) {
      console.log(`\n📄 Procesando hoja: ${sheetName}`);
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet);
      
      // Agregar información de la hoja de origen
      const dataWithSource = jsonData.map(row => ({
        ...row,
        _sourceSheet: sheetName
      }));
      
      console.log(`✅ Leídos ${dataWithSource.length} registros de "${sheetName}"`);
      allData = allData.concat(dataWithSource);
    }
    
    console.log(`\n📊 Total de registros: ${allData.length}`);
    return allData;
  }

  // ✅ Validar y transformar datos
  async validateData(excelData) {
    console.log('🔍 Validando y transformando datos...');
    
    const validatedData = [];
    
    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      
      try {
        const transformedRow = this.transformRow(row, i + 1);
        
        if (transformedRow) {
          validatedData.push(transformedRow);
        }
      } catch (error) {
        this.logError(`Fila ${i + 1}: ${error.message}`);
        this.errorCount++;
      }
    }
    
    console.log(`✅ ${validatedData.length} registros válidos de ${excelData.length} totales`);
    return validatedData;
  }

  // 🔄 Transformar fila de Excel a formato MongoDB OPTIMIZADO
  transformRow(row, rowNumber) {
    const transformed = {};
    
    // Mapear SOLO campos esenciales usando OPTIMIZED_FIELD_MAPPING
    for (const [mongoField, excelField] of Object.entries(OPTIMIZED_FIELD_MAPPING)) {
      let value = row[excelField];
      
      // Limpiar valor
      if (value !== undefined && value !== null) {
        value = String(value).trim();
        if (value === '' || value === 'undefined' || value === 'null') {
          value = null;
        }
      }
      
      // Validaciones específicas OPTIMIZADAS
      if (mongoField === 'numeroDocumento') {
        if (!value) {
          throw new Error('Número de documento es requerido');
        }
        value = this.cleanCedula(value);
        if (!this.isValidCedula(value)) {
          throw new Error(`Cédula inválida: ${value}`);
        }
      }
      
      if (mongoField === 'ficha') {
        if (!value) {
          throw new Error('Ficha es requerida');
        }
        value = String(value);
      }
      
      if (mongoField === 'nombreAprendiz') {
        if (!value) {
          throw new Error('Nombre del aprendiz es requerido');
        }
        value = this.normalizeName(value);
      }
      
      if (mongoField === 'denominacionPrograma') {
        if (!value) {
          throw new Error('Programa es requerido');
        }
        value = value.toUpperCase(); // Normalizar programas
      }
      
      if (mongoField === 'fechaCertificacion' && value) {
        const parsedDate = this.parseDate(value);
        if (parsedDate) {
          value = parsedDate;
        } else {
          // Log para debugging y conservar el valor original como string
          this.logWarning(`Fila ${rowNumber}: No se pudo parsear fecha "${value}", guardando como null`);
          value = null;
        }
      }
      
      transformed[mongoField] = value;
    }
    
    // 🏢 Asignar centro según la hoja de origen
    const sourceSheet = row._sourceSheet;
    transformed.centro = SHEET_TO_CENTRO[sourceSheet] || 'Centro de Teleinformática y Producción Industrial';
    
    // Campos adicionales mínimos
    transformed.fechaImportacion = new Date();
    transformed.estado = 'activo';
    
    return transformed;
  }

  // 📦 Migrar datos en lotes OPTIMIZADO
  async migrateInBatches(validatedData) {
    console.log(`📦 Migrando ${validatedData.length} registros en lotes de ${this.batchSize}...`);
    
    const totalBatches = Math.ceil(validatedData.length / this.batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * this.batchSize;
      const end = start + this.batchSize;
      const batch = validatedData.slice(start, end);
      
      console.log(`\n📝 Procesando lote ${i + 1}/${totalBatches} (${batch.length} registros)...`);
      
      await this.processBatchOptimized(batch, i + 1);
      
      // Progreso
      const processed = Math.min(end, validatedData.length);
      const percentage = ((processed / validatedData.length) * 100).toFixed(1);
      console.log(`📊 Progreso: ${processed}/${validatedData.length} (${percentage}%)`);
    }
  }

  // 🔄 Procesar un lote OPTIMIZADO
  async processBatchOptimized(batch, batchNumber) {
    try {
      // Usar insertMany con ordered: false para mejor rendimiento
      const result = await Egresado.insertMany(batch, { 
        ordered: false, // Continuar aunque algunos fallen
        rawResult: true // Obtener estadísticas detalladas
      });
      
      this.successCount += result.insertedCount || batch.length;
      
      console.log(`✅ Lote ${batchNumber}: ${result.insertedCount || batch.length} registros insertados`);
      
    } catch (error) {
      // Manejar errores de duplicados y otros
      if (error.name === 'BulkWriteError') {
        const insertedCount = error.result.nInserted;
        const duplicateErrors = error.writeErrors.filter(err => err.code === 11000);
        const otherErrors = error.writeErrors.filter(err => err.code !== 11000);
        
        this.successCount += insertedCount;
        this.duplicateCount += duplicateErrors.length;
        this.errorCount += otherErrors.length;
        
        console.log(`📊 Lote ${batchNumber}: ${insertedCount} nuevos, ${duplicateErrors.length} duplicados, ${otherErrors.length} errores`);
        
        if (otherErrors.length > 0) {
          this.logError(`Errores en lote ${batchNumber}: ${otherErrors.map(e => e.errmsg).join(', ')}`);
        }
      } else {
        this.logError(`Error en lote ${batchNumber}: ${error.message}`);
        this.errorCount += batch.length;
      }
    }
  }

  // 📊 Generar reporte final
  async generateReport() {
    console.log('\n📊 Generando reporte final...');
    
    try {
      // Estadísticas de la base de datos
      const totalRegistros = await Egresado.countDocuments();
      const programStats = await Egresado.getStatsByProgram();
      const dbInfo = await mongoConnection.getDatabaseInfo();
      
      const report = `
==========================================================
            📊 REPORTE DE MIGRACIÓN COMPLETA
==========================================================

⏰ Fecha: ${new Date().toLocaleString()}

📈 ESTADÍSTICAS DE MIGRACIÓN:
  ✅ Registros exitosos: ${this.successCount}
  🔄 Duplicados encontrados: ${this.duplicateCount}
  ❌ Errores: ${this.errorCount}
  📊 Total en BD: ${totalRegistros}

💾 INFORMACIÓN DE BASE DE DATOS:
  🗄️  Base de datos: ${dbInfo.databaseName}
  📁 Colecciones: ${dbInfo.collections}
  📄 Documentos: ${dbInfo.documents}
  💽 Tamaño de datos: ${dbInfo.dataSize}
  🗂️  Índices: ${dbInfo.indexes}

🎓 TOP 10 PROGRAMAS:
${programStats.slice(0, 10).map((prog, index) => 
  `  ${index + 1}. ${prog._id}: ${prog.count} egresados`
).join('\n')}

==========================================================
`;
      
      console.log(report);
      
      // Guardar reporte en archivo
      fs.writeFileSync(this.logFile, report);
      console.log(`📄 Reporte guardado en: ${this.logFile}`);
      
    } catch (error) {
      console.error('❌ Error generando reporte:', error.message);
    }
  }

  // 🧹 Métodos de limpieza y validación OPTIMIZADOS
  cleanCedula(cedula) {
    return String(cedula).replace(/['"´`\s.-]/g, '').trim();
  }

  isValidCedula(cedula) {
    return /^\d{6,12}$/.test(cedula);
  }

  normalizeName(name) {
    return name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  parseDate(dateValue) {
    if (!dateValue) return null;
    
    // Si ya es una fecha válida
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return dateValue;
    }
    
    // Convertir a string para procesamiento
    const dateStr = String(dateValue).trim();
    
    // Si está vacío o es un valor inválido
    if (!dateStr || dateStr === 'undefined' || dateStr === 'null' || dateStr === '') {
      return null;
    }
    
    // Manejar fechas numéricas de Excel (Serial date number)
    if (typeof dateValue === 'number' && dateValue > 1) {
      // Excel serial date: días desde 1900-01-01 (con ajuste por bug de Excel)
      const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
      if (!isNaN(excelDate.getTime()) && excelDate.getFullYear() > 1900 && excelDate.getFullYear() < 2100) {
        return excelDate;
      }
    }
    
    // Intentar parsear como número (timestamp)
    const numValue = Number(dateStr);
    if (!isNaN(numValue) && numValue > 25569) { // Después del 1900
      const excelDate = new Date((numValue - 25569) * 86400 * 1000);
      if (!isNaN(excelDate.getTime()) && excelDate.getFullYear() > 1900 && excelDate.getFullYear() < 2100) {
        return excelDate;
      }
    }
    
    // Intentar diferentes formatos de string
    const formats = [
      // Formatos ISO
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // 2023-01-15T10:30:00
      /^\d{4}-\d{2}-\d{2}$/,                    // 2023-01-15
      
      // Formatos DD/MM/YYYY
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,             // 15/1/2023 o 15/01/2023
      /^\d{2}\/\d{2}\/\d{4}$/,                 // 15/01/2023
      
      // Formatos MM/DD/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/,               // 1-15-2023 o 01-15-2023
      
      // Formatos DD-MM-YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/,               // 15-1-2023 o 15-01-2023
    ];
    
    // Intentar parsear directamente
    let parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900 && parsedDate.getFullYear() < 2100) {
      return parsedDate;
    }
    
    // Intentar con diferentes formatos manuales
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    
    // Intentar formato DD-MM-YYYY
    const ddmmyyyyDashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyyDashMatch) {
      const [, day, month, year] = ddmmyyyyDashMatch;
      parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    
    console.log(`⚠️ No se pudo parsear fecha: "${dateValue}" (tipo: ${typeof dateValue})`);
    return null;
  }

  // 📝 Logging
  logError(message) {
    const logMessage = `❌ [${new Date().toISOString()}] ${message}`;
    console.error(logMessage);
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  logWarning(message) {
    const logMessage = `⚠️  [${new Date().toISOString()}] ${message}`;
    console.warn(logMessage);
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }
}

// 🚀 Ejecutar si se llama directamente (SOLUCIONADO para Windows)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('migrateToMongo.js')) {
  console.log('🔥 Ejecutando migración desde línea de comandos...');
  console.log(`📋 Configuración: Hoja="${process.env.EXCEL_SHEET_NAME}" Archivo="${process.env.EXCEL_FILE_PATH}"`);
  
  const migration = new OptimizedMigrationScript();
  
  migration.executeMigration()
    .then(() => {
      console.log('\n🎉 ¡Migración OPTIMIZADA completada con éxito!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal en la migración:', error);
      process.exit(1);
    });
} else {
  console.log('📦 Script cargado como módulo (no ejecutando migración)');
}

export default OptimizedMigrationScript;
