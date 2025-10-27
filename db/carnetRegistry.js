import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class CarnetRegistry {
  constructor() {
    this.registryPath = path.join(process.cwd(), 'data');
    this.registryFile = path.join(this.registryPath, 'carnets_registry.json');
    this.ensureDataDirectory();
    this.loadRegistry();
  }

  // 📌 Asegurar que existe el directorio data
  ensureDataDirectory() {
    if (!fs.existsSync(this.registryPath)) {
      fs.mkdirSync(this.registryPath, { recursive: true });
      console.log('📁 Directorio de datos creado:', this.registryPath);
    }
  }

  // 📌 Cargar registro desde archivo JSON
  loadRegistry() {
    try {
      if (fs.existsSync(this.registryFile)) {
        const data = fs.readFileSync(this.registryFile, 'utf8');
        this.registry = JSON.parse(data);
        console.log(`✅ Registro de carnets cargado: ${this.registry.length} registros`);
      } else {
        this.registry = [];
        console.log('📝 Nuevo registro de carnets creado');
      }
    } catch (error) {
      console.error('❌ Error cargando registro de carnets:', error.message);
      this.registry = [];
    }
  }

  // 📌 Guardar registro en archivo JSON
  saveRegistry() {
    try {
      fs.writeFileSync(this.registryFile, JSON.stringify(this.registry, null, 2));
    } catch (error) {
      console.error('❌ Error guardando registro de carnets:', error.message);
      throw error;
    }
  }

  // 📌 Verificar si puede generar nuevo carnet
  canGenerateCarnet(cedula) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Buscar carnet activo en los últimos 30 días
    const activeCarnet = this.registry.find(carnet => 
      carnet.cedula === cedula &&
      carnet.estado === 'activo' &&
      new Date(carnet.fechaGeneracion) > thirtyDaysAgo
    );

    if (activeCarnet) {
      const daysRemaining = Math.ceil((new Date(activeCarnet.fechaVencimiento) - now) / (24 * 60 * 60 * 1000));
      
      return {
        canGenerate: false,
        message: `Ya tienes un carnet válido generado el ${new Date(activeCarnet.fechaGeneracion).toLocaleDateString('es-ES')}`,
        activeCarnet: activeCarnet,
        daysRemaining: daysRemaining,
        nextAvailableDate: new Date(activeCarnet.fechaVencimiento).toLocaleDateString('es-ES')
      };
    }

    return { canGenerate: true };
  }

  // 📌 Registrar nuevo carnet
  registerCarnet(cedula, egresadoData = {}, metadata = {}) {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const carnetRecord = {
      id: uuidv4(),
      cedula: cedula,
      ficha: egresadoData.ficha || '', // Mantener la ficha en el registro pero opcional
      nombreCompleto: egresadoData.nombre || '',
      programa: egresadoData.programa || '',
      fechaGeneracion: now.toISOString(),
      fechaVencimiento: expirationDate.toISOString(),
      estado: 'activo',
      metadata: {
        userAgent: metadata.userAgent || '',
        ip: metadata.ip || '',
        ...metadata
      }
    };

    // Marcar carnets anteriores como reemplazados
    this.registry.forEach(carnet => {
      if (carnet.cedula === cedula && carnet.estado === 'activo') {
        carnet.estado = 'reemplazado';
        carnet.fechaReemplazo = now.toISOString();
      }
    });

    this.registry.push(carnetRecord);
    this.saveRegistry();

    console.log(`📄 Carnet registrado - ID: ${carnetRecord.id.substring(0, 8)} para ${cedula}`);
    return carnetRecord;
  }

  // 📌 Validar carnet por ID
  validateCarnet(carnetId) {
    const carnet = this.registry.find(c => c.id === carnetId);

    if (!carnet) {
      return {
        valid: false,
        message: 'Carnet no encontrado en los registros',
        status: 'not_found'
      };
    }

    const now = new Date();
    const expirationDate = new Date(carnet.fechaVencimiento);

    // Verificar estado
    if (carnet.estado !== 'activo') {
      return {
        valid: false,
        message: `Carnet ${carnet.estado}${carnet.fechaReemplazo ? ' el ' + new Date(carnet.fechaReemplazo).toLocaleDateString('es-ES') : ''}`,
        status: carnet.estado,
        carnet: carnet
      };
    }

    // Verificar vencimiento
    if (now > expirationDate) {
      // Actualizar estado a vencido
      carnet.estado = 'vencido';
      carnet.fechaVencimiento_real = now.toISOString();
      this.saveRegistry();

      return {
        valid: false,
        message: `Carnet vencido el ${expirationDate.toLocaleDateString('es-ES')}`,
        status: 'expired',
        expiredDate: expirationDate,
        carnet: carnet
      };
    }

    // Carnet válido
    const daysRemaining = Math.ceil((expirationDate - now) / (24 * 60 * 60 * 1000));

    return {
      valid: true,
      message: 'Carnet válido y activo',
      status: 'active',
      carnet: carnet,
      daysRemaining: daysRemaining,
      expiresOn: expirationDate.toLocaleDateString('es-ES')
    };
  }

  // 📌 Obtener carnet por ID
  getCarnet(carnetId) {
    return this.registry.find(c => c.id === carnetId);
  }

  // 📌 Obtener historial de carnets de un usuario
  getUserCarnets(cedula) {
    return this.registry.filter(c => c.cedula === cedula)
                      .sort((a, b) => new Date(b.fechaGeneracion) - new Date(a.fechaGeneracion));
  }

  // 📌 Limpieza de carnets vencidos
  cleanupExpiredCarnets() {
    const now = new Date();
    let cleaned = 0;

    this.registry.forEach(carnet => {
      if (carnet.estado === 'activo' && new Date(carnet.fechaVencimiento) < now) {
        carnet.estado = 'vencido';
        carnet.fechaVencimiento_real = now.toISOString();
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.saveRegistry();
      console.log(`🧹 Carnets vencidos actualizados: ${cleaned}`);
    }

    return cleaned;
  }

  // 📌 Estadísticas
  getStats() {
    const now = new Date();
    const stats = {
      total: this.registry.length,
      activos: 0,
      vencidos: 0,
      reemplazados: 0,
      validosHoy: 0
    };

    this.registry.forEach(carnet => {
      stats[carnet.estado] = (stats[carnet.estado] || 0) + 1;
      
      if (carnet.estado === 'activo' && new Date(carnet.fechaVencimiento) > now) {
        stats.validosHoy++;
      }
    });

    return stats;
  }
}

export default new CarnetRegistry();