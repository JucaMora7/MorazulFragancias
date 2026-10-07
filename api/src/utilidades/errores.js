// Error de la API con código HTTP, un código estable para el cliente y un mensaje en español.
class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const noAutenticado = (mensaje = 'Debes iniciar sesión') => new ErrorApi(401, 'no_autenticado', mensaje);
const prohibido = (mensaje = 'No tienes permiso para esta acción') => new ErrorApi(403, 'prohibido', mensaje);
const noEncontrado = (mensaje = 'No se encontró el recurso') => new ErrorApi(404, 'no_encontrado', mensaje);
const conflicto = (mensaje) => new ErrorApi(409, 'conflicto', mensaje);
const reglaDeNegocio = (mensaje) => new ErrorApi(422, 'regla_de_negocio', mensaje);
const validacion = (mensaje, detalles) => new ErrorApi(400, 'validacion', mensaje, detalles);

module.exports = { ErrorApi, noAutenticado, prohibido, noEncontrado, conflicto, reglaDeNegocio, validacion };
