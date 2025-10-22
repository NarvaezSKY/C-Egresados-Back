import XLSX from "xlsx";
import { EXCEL_CONFIG, FIELD_MAPPING } from "../config/fieldMapping.js";

class ExcelConnection {
  constructor() {
    this.egresados = [];
    this.loadData();
  }

  // 📌 Cargar datos del archivo Excel
  loadData() {
    try {
      const workbook = XLSX.readFile(EXCEL_CONFIG.fileName);
      const sheet = workbook.Sheets[EXCEL_CONFIG.sheetName];
      this.egresados = XLSX.utils.sheet_to_json(sheet);
      console.log(`✅ Datos cargados: ${this.egresados.length} egresados encontrados`);
    } catch (error) {
      console.error("❌ Error cargando archivo Excel:", error.message);
      this.egresados = [];
    }
  }

  // 📌 Obtener todos los egresados
  getAllEgresados() {
    return this.egresados;
  }

  // 📌 Recargar datos (útil si el archivo cambia)
  reloadData() {
    this.loadData();
    return this.egresados.length;
  }

  // 📌 Función helper para mapear campos
  mapFields(data, mapping = FIELD_MAPPING) {
    const mapped = {};
    for (const [apiField, excelField] of Object.entries(mapping)) {
      mapped[apiField] = data[excelField];
    }
    return mapped;
  }

  // 📌 Formatear fechas de Excel
  formatDate(excelDate) {
    if (!excelDate) return "N/A";

    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }

    if (typeof excelDate === 'string') {
      const date = new Date(excelDate);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    }

    return excelDate;
  }
}

// Crear instancia única (Singleton)
const excelConnection = new ExcelConnection();

export default excelConnection;