const { QueryTypes } = require('sequelize');
const config = require('./config');
const { sequelize } = require('./modelos');
const { crearApp } = require('./app');

async function iniciar() {
  const app = crearApp();
  await sequelize.authenticate();
  const [{ server_version }] = await sequelize.query("SELECT current_setting('server_version') AS server_version", { type: QueryTypes.SELECT });
  if (!server_version.startsWith('16.')) {
    throw new Error(`La base de datos es PostgreSQL ${server_version} y el proyecto exige la 16. Revisa DB_PORT en .env.`);
  }

  const servidor = app.listen(config.puerto, () => {
    console.log(`API de Morazul escuchando en el puerto ${config.puerto} (PostgreSQL ${server_version})`);
  });

  const cerrar = () => servidor.close(() => sequelize.close().then(() => process.exit(0)));
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

iniciar().catch((err) => {
  console.error('No se pudo iniciar la API:', err.message);
  process.exit(1);
});
