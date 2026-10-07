const { Sequelize } = require('sequelize');
const config = require('./config');

// El esquema lo manejan las migraciones de db/: aquí no se usa sequelize.sync().
const sequelize = new Sequelize(config.db.nombre, config.db.usuario, config.db.clave, {
  host: config.db.host,
  port: config.db.puerto,
  dialect: 'postgres',
  logging: false,
  pool: { max: 10, idle: 10000 },
  define: { freezeTableName: true, timestamps: false },
});

module.exports = sequelize;
