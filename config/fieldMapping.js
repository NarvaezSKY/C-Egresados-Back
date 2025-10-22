// 📌 Configuración de mapeo de campos Excel -> API
export const FIELD_MAPPING = {
  cedula: "Número Documento",
  ficha: "Ficha",
  nombre: "Nombre Aprendiz",
  programa: "Denominación Programa",
  fechaEgreso: "Fecha Certificación",
  regional: "Regional",
  centro: "Centro"
};

// 📌 Configuración de la hoja Excel
export const EXCEL_CONFIG = {
  fileName: process.env.EXCEL_FILE_PATH || "./DBEGRESADOS.xlsx",
  sheetName: process.env.EXCEL_SHEET_NAME || "CTPI"
};

// 📌 Configuración de CORS
export const CORS_OPTIONS = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// 📌 Configuración del servidor
export const SERVER_CONFIG = {
  port: process.env.PORT || 4000,
  host: 'localhost'
};