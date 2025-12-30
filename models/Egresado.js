import mongoose from 'mongoose';

// 📌 Esquema OPTIMIZADO para egresados en MongoDB (solo campos necesarios para carnets)
const egresadoSchema = new mongoose.Schema({
  // 🎯 Campos ESENCIALES para carnets
  numeroDocumento: { 
    type: String, 
    required: true, 
    index: true,
    trim: true
  },
  ficha: { 
    type: String, 
    required: true,
    index: true,
    trim: true
  },
  nombreAprendiz: { 
    type: String, 
    required: true,
    // index se declara por separado abajo
    trim: true
  },
  denominacionPrograma: { 
    type: String, 
    required: true,
    trim: true
  },
  fechaCertificacion: { 
    type: Date,
    index: true 
  },
  
  // 🏢 Campos de ubicación (extraídos automáticamente)
  regional: {
    type: String,
    default: 'Regional Cauca',
    trim: true
  },
  centro: {
    type: String,
    trim: true
  },
  
  // 📊 Metadatos mínimos
  fechaImportacion: { 
    type: Date, 
    default: Date.now 
  },
  estado: {
    type: String,
    enum: ['activo', 'inactivo'],
    default: 'activo'
  }
}, {
  timestamps: true, // Solo createdAt y updatedAt
  collection: 'egresados',
  // Optimizaciones de MongoDB
  versionKey: false, // Eliminar campo __v
  minimize: false // Mantener campos vacíos
});

// 📌 Índices OPTIMIZADOS para búsquedas frecuentes
egresadoSchema.index({ numeroDocumento: 1, ficha: 1 }, { unique: true });
egresadoSchema.index({ nombreAprendiz: 1 });
egresadoSchema.index({ denominacionPrograma: 1 });
egresadoSchema.index({ fechaCertificacion: -1 });
egresadoSchema.index({ estado: 1 }); // Para filtros de estado

// 📌 Métodos del modelo optimizados
egresadoSchema.statics.findByCredentials = function(cedula, ficha) {
  return this.findOne({ 
    numeroDocumento: cedula, 
    ficha: ficha,
    estado: 'activo'
  }).lean(); // Usar lean() para mejor rendimiento
};

// Buscar solo por cédula (último registro)
egresadoSchema.statics.findByCedula = function(cedula) {
  return this.findOne({ 
    numeroDocumento: cedula,
    estado: 'activo'
  }).sort({ fechaCertificacion: -1 }).lean();
};

egresadoSchema.statics.searchByName = function(nombre) {
  return this.find({
    nombreAprendiz: { $regex: nombre, $options: 'i' },
    estado: 'activo'
  }).lean();
};

egresadoSchema.statics.getStatsByProgram = function() {
  return this.aggregate([
    { $match: { estado: 'activo' } },
    { $group: { 
        _id: '$denominacionPrograma', 
        count: { $sum: 1 } 
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// 📌 Middleware pre-save OPTIMIZADO para extraer regional y centro
egresadoSchema.pre('save', function(next) {
  // Solo establecer valores por defecto si están vacíos
  if (this.isNew || this.isModified('denominacionPrograma')) {
    
    // Establecer valores por defecto solo si no existen
    if (!this.regional) {
      this.regional = 'Regional Cauca';
    }
    if (!this.centro) {
      this.centro;
    }
  }
  
  next();
});

const Egresado = mongoose.model('Egresado', egresadoSchema);

export default Egresado;
