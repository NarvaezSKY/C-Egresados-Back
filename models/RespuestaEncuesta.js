import mongoose from 'mongoose';

// 📌 Esquema simple para respuestas de encuesta (solo para validación)
const respuestaEncuestaSchema = new mongoose.Schema({
  numeroDocumento: { 
    type: String, 
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  fechaRespuesta: {
    type: Date,
    default: Date.now
  },
  fechaImportacion: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  collection: 'respuestas_encuesta',
  versionKey: false
});

// Índice para búsquedas rápidas
respuestaEncuestaSchema.index({ numeroDocumento: 1 });

// Método estático para verificar si respondió
respuestaEncuestaSchema.statics.hasAnswered = function(cedula) {
  return this.exists({ numeroDocumento: cedula });
};

const RespuestaEncuesta = mongoose.model('RespuestaEncuesta', respuestaEncuestaSchema);

export default RespuestaEncuesta;
