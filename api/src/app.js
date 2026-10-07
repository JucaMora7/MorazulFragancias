const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { autenticar, exigirRol } = require('./middleware/autenticar');
const { rutaNoEncontrada, manejarErrores } = require('./middleware/errores');

function crearApp() {
  config.validar();
  const app = express();
  app.disable('x-powered-by');

  // Las fotos las consume la landing desde otro origen: se permite embeberlas.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigenes, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/uploads', express.static(config.imagenes.carpeta, { index: false, maxAge: '7d', dotfiles: 'deny' }));

  app.get('/api/salud', (_req, res) => res.json({ estado: 'ok' }));

  app.use('/api/auth', require('./rutas/auth'));
  app.use('/api/publico', require('./rutas/publico'));

  // Todo lo que sigue exige sesión de administrador.
  const admin = [autenticar, exigirRol('administrador')];
  const administracion = require('./rutas/administracion');
  app.use('/api/categorias', admin, administracion.categorias);
  app.use('/api/configuracion', admin, administracion.configuracion);
  app.use('/api/fragancias', admin, require('./rutas/fragancias'));
  app.use('/api/productos', admin, require('./rutas/productos'));
  app.use('/api/inventario', admin, require('./rutas/inventario'));
  app.use('/api/caja', admin, require('./rutas/caja'));
  app.use('/api/ventas', admin, require('./rutas/ventas'));
  app.use('/api/alertas', admin, require('./rutas/alertas'));

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}

module.exports = { crearApp };
