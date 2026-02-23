import mongoose from 'mongoose';

// 📌 Esquema para carnets en MongoDB
const carnetSchema = new mongoose.Schema({
  // 🆔 Identificación del carnet
  carnetId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  
  // 👤 Datos del egresado
  cedula: { 
    type: String, 
    required: true,
    index: true
  },
  ficha: { 
    type: String,
    default: ''
  },
  nombreCompleto: { 
    type: String,
    default: ''
  },
  programa: { 
    type: String,
    default: ''
  },
  
  // 📅 Fechas importantes
  fechaGeneracion: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  fechaVencimiento: { 
    type: Date, 
    required: true,
    index: true
  },
  fechaUltimaDescarga: {
    type: Date,
    default: Date.now
  },
  contadorDescargas: {
    type: Number,
    default: 1
  },
  
  // 📊 Estado del carnet
  estado: {
    type: String,
    enum: ['valido', 'expirado', 'revocado'],
    default: 'valido',
    index: true
  },
  
  // 📋 Metadatos de generación
  metadata: {
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    recaptchaScore: { type: String, default: 'N/A' }
  }
}, {
  timestamps: true, // createdAt y updatedAt automáticos
  collection: 'carnets'
});

// 📌 Índices compuestos para optimizar consultas
carnetSchema.index({ cedula: 1, estado: 1 });
carnetSchema.index({ fechaVencimiento: 1, estado: 1 });
carnetSchema.index({ carnetId: 1, estado: 1 });

// 📌 Método para verificar si un carnet está vigente
carnetSchema.methods.isValid = function() {
  const now = new Date();
  return this.estado === 'valido' && this.fechaVencimiento > now;
};

// 📌 Método para marcar como expirado
carnetSchema.methods.markAsExpired = function() {
  this.estado = 'expirado';
  return this.save();
};

// 📌 Método para revocar carnet
carnetSchema.methods.revoke = function() {
  this.estado = 'revocado';
  return this.save();
};

// 📌 Métodos estáticos del modelo
carnetSchema.statics.findValidCarnet = function(cedula) {
  const now = new Date();
  return this.findOne({ 
    cedula: cedula,
    estado: 'valido',
    fechaVencimiento: { $gt: now }
  });
};

carnetSchema.statics.findCarnetById = function(carnetId) {
  return this.findOne({ carnetId: carnetId });
};

carnetSchema.statics.getUserCarnets = function(cedula) {
  return this.find({ cedula: cedula })
    .sort({ fechaGeneracion: -1 })
    .lean();
};

carnetSchema.statics.expireOldCarnets = async function() {
  const now = new Date();
  const result = await this.updateMany(
    { 
      estado: 'valido',
      fechaVencimiento: { $lt: now }
    },
    { 
      $set: { estado: 'expirado' }
    }
  );
  return result.modifiedCount;
};

carnetSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$estado',
        count: { $sum: 1 }
      }
    }
  ]);
};

// 📌 Middleware para actualizar carnets expirados antes de consultas
// NOTA: Comentado para evitar interferencias en consultas
// carnetSchema.pre(/^find/, function() {
//   // Marcar carnets expirados automáticamente
//   const now = new Date();
//   this.updateMany(
//     { 
//       estado: 'valido',
//       fechaVencimiento: { $lt: now }
//     },
//     { 
//       $set: { estado: 'expirado' }
//     }
//   );
// });

const Carnet = mongoose.model('Carnet', carnetSchema);

export default Carnet;