import excelConnection from "../db/excelConnection.js";

class EgresadoService {
  
  // 📌 Buscar egresado con criterios específicos
  findEgresado(searchCriteria) {
    const egresados = excelConnection.getAllEgresados();
    
    return egresados.find((egresado) => {
      const mappedEgresado = excelConnection.mapFields(egresado);
      return Object.entries(searchCriteria).every(([key, value]) => {
        return mappedEgresado[key] == value;
      });
    });
  }

  // 📌 Verificar credenciales de egresado
  async verifyEgresado(cedula, ficha) {
    if (!cedula || !ficha) {
      throw new Error("Faltan campos requeridos: cedula y ficha");
    }

    const egresado = this.findEgresado({ cedula, ficha });

    if (!egresado) {
      return {
        found: false,
        message: "No encontrado"
      };
    }

    const mappedEgresado = excelConnection.mapFields(egresado);
    
    return {
      found: true,
      message: "Encontrado",
      egresado: mappedEgresado
    };
  }

  // 📌 Obtener datos de egresado para carnet
  async getEgresadoForCarnet(cedula, ficha) {
    const egresado = this.findEgresado({ cedula, ficha });

    if (!egresado) {
      throw new Error("Egresado no encontrado");
    }

    const mappedEgresado = excelConnection.mapFields(egresado);
    
    // Formatear fecha para el carnet
    mappedEgresado.fechaEgreso = excelConnection.formatDate(mappedEgresado.fechaEgreso);
    
    return mappedEgresado;
  }

  // 📌 Obtener todos los egresados (útil para administración)
  async getAllEgresados() {
    const egresados = excelConnection.getAllEgresados();
    return egresados.map(egresado => excelConnection.mapFields(egresado));
  }

  // 📌 Recargar datos del Excel
  async reloadData() {
    const count = excelConnection.reloadData();
    return {
      message: "Datos recargados exitosamente",
      count: count
    };
  }

  // 📌 Estadísticas básicas
  async getStats() {
    const egresados = excelConnection.getAllEgresados();
    const mappedEgresados = egresados.map(egresado => excelConnection.mapFields(egresado));

    // Agrupar por programa
    const programas = {};
    mappedEgresados.forEach(egresado => {
      const programa = egresado.programa || "Sin programa";
      programas[programa] = (programas[programa] || 0) + 1;
    });

    return {
      total: mappedEgresados.length,
      programas: programas,
      ultimaActualizacion: new Date().toISOString()
    };
  }
}

export default new EgresadoService();