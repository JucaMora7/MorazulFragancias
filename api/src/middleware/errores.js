const multer = require('multer');
const { ErrorApi } = require('../utilidades/errores');
const config = require('../config');

function rutaNoEncontrada(req, _res, next) {
  next(new ErrorApi(404, 'no_encontrado', `No existe la ruta ${req.method} ${req.path}`));
}

// Traduce cualquier error a { error: { codigo, mensaje, detalles? } } sin filtrar datos internos.
// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, _next) {
  let error = err;

  if (err instanceof multer.MulterError) {
    error =
      err.code === 'LIMIT_FILE_SIZE'
        ? new ErrorApi(413, 'archivo_muy_grande', `La imagen supera el máximo de ${config.imagenes.maxBytes / 1024 / 1024} MB`)
        : new ErrorApi(400, 'validacion', 'No se pudo leer el archivo enviado');
  } else if (err.type === 'entity.parse.failed') {
    error = new ErrorApi(400, 'validacion', 'El cuerpo de la solicitud no es un JSON válido');
  } else if (err.type === 'entity.too.large') {
    error = new ErrorApi(413, 'cuerpo_muy_grande', 'La solicitud es demasiado grande');
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    error = new ErrorApi(409, 'conflicto', 'Ya existe un registro con esos datos');
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = new ErrorApi(422, 'regla_de_negocio', 'El registro referenciado no existe o está en uso');
  } else if (err.name === 'SequelizeDatabaseError' && err.parent?.code === '23514') {
    error = new ErrorApi(422, 'regla_de_negocio', 'La operación incumple una regla del negocio');
  }

  if (!(error instanceof ErrorApi)) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({ error: { codigo: 'error_interno', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.' } });
  }

  const cuerpo = { codigo: error.codigo, mensaje: error.message };
  if (error.detalles) cuerpo.detalles = error.detalles;
  return res.status(error.estado).json({ error: cuerpo });
}

module.exports = { rutaNoEncontrada, manejarErrores };
