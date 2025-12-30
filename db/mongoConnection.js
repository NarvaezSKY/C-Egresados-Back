import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

class MongoConnection {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
  }

  // 🔌 Conectar a MongoDB Atlas (optimizado para serverless)
  async connect() {
    // En serverless, reusar conexión si ya existe
    if (mongoose.connection.readyState === 1) {
      console.log('✅ Reutilizando conexión existente a MongoDB');
      this.isConnected = true;
      return true;
    }

    if (mongoose.connection.readyState === 2) {
      console.log('⏳ Conexión a MongoDB en progreso, esperando...');
      await this.waitForConnection();
      return true;
    }

    try {
      this.connectionAttempts++;
      
      const mongoUri = process.env.MONGODB_URI;
      
      if (!mongoUri) {
        throw new Error('MONGODB_URI no está definida en las variables de entorno');
      }

      console.log('🔌 Conectando a MongoDB Atlas...');

      const options = {
        serverSelectionTimeoutMS: 10000, // 10 segundos (reducido para serverless)
        socketTimeoutMS: 45000,
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 1, // Reducido para serverless
        maxIdleTimeMS: 10000, // Reducido para serverless
      };

      await mongoose.connect(mongoUri, options);
      
      this.isConnected = true;
      console.log('✅ Conectado a MongoDB Atlas');
      
      return true;
    } catch (error) {
      console.error(`❌ Error conectando a MongoDB Atlas:`, error.message);
      
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`🔄 Reintentando conexión (${this.connectionAttempts}/${this.maxRetries})...`);
        await this.delay(2000);
        return this.connect();
      } else {
        throw new Error(`No se pudo conectar a MongoDB Atlas después de ${this.maxRetries} intentos: ${error.message}`);
      }
    }
  }

  // ⏳ Esperar a que se complete la conexión
  async waitForConnection(timeout = 10000) {
    const startTime = Date.now();
    while (mongoose.connection.readyState === 2) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout esperando conexión a MongoDB');
      }
      await this.delay(100);
    }
    if (mongoose.connection.readyState === 1) {
      this.isConnected = true;
      return true;
    }
    throw new Error('Error en conexión a MongoDB');
  }

  // 🔌 Desconectar de MongoDB
  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.disconnect();
        this.isConnected = false;
      }
    } catch (error) {
      console.error('❌ Error desconectando de MongoDB:', error.message);
    }
  }

  // ✅ Verificar estado de conexión
  getConnectionStatus() {
    const readyState = mongoose.connection.readyState;
    return {
      isConnected: readyState === 1,
      readyState: readyState,
      readyStateText: this.getReadyStateText(readyState),
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
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      console.error('🔴 Error en MongoDB:', error.message);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
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
