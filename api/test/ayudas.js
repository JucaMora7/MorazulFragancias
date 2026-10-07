// Ayudas compartidas por las pruebas. Siempre trabajan sobre la base morazul_test.
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
const config = require('../src/config');

// En Windows sharp mantiene abiertos los archivos que lee; se desactiva su caché en las pruebas.
sharp.cache(false);
const { sequelize } = require('../src/modelos');
const { crearApp } = require('../src/app');
const { crearAdministrador } = require('../src/servicios/usuarios');

const RAIZ = path.join(__dirname, '..', '..');
const CORREO = 'admin@morazul.test';
const CONTRASENA = 'contrasena-de-prueba-1';

// Reconstruye la base de pruebas desde cero: modelo v1 y migraciones de db/.
async function reconstruirBase() {
  if (!/_test$/.test(config.db.nombre)) {
    throw new Error(`Se niega a borrar la base "${config.db.nombre}": solo se reconstruyen bases que terminan en _test`);
  }
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const archivos = [
    path.join(RAIZ, 'db', 'morazul_modelo_relacional_v1.sql'),
    ...fs
      .readdirSync(path.join(RAIZ, 'db', 'migrations'))
      .filter((f) => /^\d{3}_.*\.sql$/.test(f))
      .sort()
      .map((f) => path.join(RAIZ, 'db', 'migrations', f)),
  ];
  for (const archivo of archivos) await sequelize.query(fs.readFileSync(archivo, 'utf8'));
}

// Prepara base limpia, aplicación y un administrador con sesión iniciada.
async function preparar({ conAdmin = true } = {}) {
  await reconstruirBase();
  const app = crearApp();
  const ctx = { app, token: null, admin: null };
  if (conAdmin) {
    ctx.admin = await crearAdministrador({ nombre: 'Administrador de prueba', correo: CORREO, contrasena: CONTRASENA });
    const r = await request(app).post('/api/auth/login').send({ correo: CORREO, contrasena: CONTRASENA });
    ctx.token = r.body.token;
  }
  return ctx;
}

const conSesion = (ctx) => ({
  get: (url) => request(ctx.app).get(url).set('Authorization', `Bearer ${ctx.token}`),
  post: (url) => request(ctx.app).post(url).set('Authorization', `Bearer ${ctx.token}`),
  patch: (url) => request(ctx.app).patch(url).set('Authorization', `Bearer ${ctx.token}`),
  put: (url) => request(ctx.app).put(url).set('Authorization', `Bearer ${ctx.token}`),
  delete: (url) => request(ctx.app).delete(url).set('Authorization', `Bearer ${ctx.token}`),
});

async function cerrar() {
  await sequelize.close();
}

module.exports = { request, sequelize, preparar, conSesion, cerrar, CORREO, CONTRASENA };
