import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

class MongoConnection {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
  }

  // 🔌 Conectar a MongoDB Atlas
  async connect() {
    try {
      this.connectionAttempts++;
      
      const mongoUri = process.env.MONGODB_URI;
      
      if (!mongoUri) {
        throw new Error('MONGODB_URI no está definida en las variables de entorno');
      }

      console.log(`📡 Conectando a MongoDB Atlas... (Intento ${this.connectionAttempts})`);

      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000, // 30 segundos
        socketTimeoutMS: 45000, // 45 segundos
        bufferCommands: false,
        maxPoolSize: 10, // Mantiene hasta 10 conexiones socket
        minPoolSize: 2,  // Mantiene mínimo 2 conexiones socket
        maxIdleTimeMS: 30000, // Cierra conexiones después de 30 segundos de inactividad
        family: 4 // Use IPv4, skip trying IPv6
      };

      await mongoose.connect(mongoUri, options);
      
      this.isConnected = true;
      console.log('✅ Conectado exitosamente a MongoDB Atlas');
      
      return true;
    } catch (error) {
      console.error(`❌ Error conectando a MongoDB Atlas:`, error.message);
      
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`⏳ Reintentando en 5 segundos... (${this.connectionAttempts}/${this.maxRetries})`);
        await this.delay(5000);
        return this.connect();
      } else {
        throw new Error(`No se pudo conectar a MongoDB Atlas después de ${this.maxRetries} intentos`);
      }
    }
  }

  // 🔌 Desconectar de MongoDB
  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('📴 Desconectado de MongoDB Atlas');
      }
    } catch (error) {
      console.error('❌ Error desconectando de MongoDB:', error.message);
    }
  }

  // ✅ Verificar estado de conexión
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      readyStateText: this.getReadyStateText(mongoose.connection.readyState),
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  // 📊 Obtener información de la base de datos
  async getDatabaseInfo() {
    try {
      if (!this.isConnected) {
        throw new Error('No hay conexión a MongoDB');
      }

      const admin = mongoose.connection.db.admin();
      const stats = await mongoose.connection.db.stats();
      
      return {
        databaseName: mongoose.connection.name,
        collections: stats.collections,
        documents: stats.objects,
        dataSize: this.formatBytes(stats.dataSize),
        storageSize: this.formatBytes(stats.storageSize),
        indexes: stats.indexes,
        indexSize: this.formatBytes(stats.indexSize)
      };
    } catch (error) {
      console.error('❌ Error obteniendo información de la base de datos:', error.message);
      throw error;
    }
  }

  // 🧪 Probar conexión con ping
  async ping() {
    try {
      await mongoose.connection.db.admin().ping();
      return { success: true, message: 'Conexión activa' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // 🔄 Configurar listeners de eventos
  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      console.log('🟢 MongoDB Atlas conectado');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      console.error('🔴 Error en MongoDB Atlas:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🟡 MongoDB Atlas desconectado');
      this.isConnected = false;
    });

    // Reconexión automática en caso de pérdida de conexión
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB Atlas reconectado');
      this.isConnected = true;
    });
  }

  // 🔧 Métodos auxiliares
  getReadyStateText(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[state] || 'unknown';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 📦 Exportar instancia singleton
const mongoConnection = new MongoConnection();

// Configurar listeners de eventos
mongoConnection.setupEventListeners();

export default mongoConnection;
