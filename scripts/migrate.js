import OptimizedMigrationScript from './migrateToMongo.js';

// 🚀 Script de migración rápida OPTIMIZADA
console.log('🚀 Iniciando migración OPTIMIZADA de Excel a MongoDB...\n');

const migration = new OptimizedMigrationScript();

migration.executeMigration()
  .then(() => {
    console.log('\n🎉 ¡Migración OPTIMIZADA completada exitosamente!');
  })
  .catch((error) => {
    console.error('\n❌ Error en la migración:', error.message);
  });
