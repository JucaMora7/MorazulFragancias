const jwt = require('jsonwebtoken');
const config = require('../config');
const { Usuario } = require('../modelos');
const { noAutenticado, prohibido } = require('../utilidades/errores');

// Exige un JWT válido en "Authorization: Bearer <token>" y un usuario que siga activo.
async function autenticar(req, _res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) throw noAutenticado();

  let carga;
  try {
    carga = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
  } catch {
    throw noAutenticado('La sesión no es válida o venció');
  }

  const usuario = await Usuario.findByPk(carga.sub);
  if (!usuario || !usuario.activo) throw noAutenticado('La sesión no es válida o venció');

  req.usuario = { id: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol };
  next();
}

// Por ahora todo el panel es del administrador; el rol empleado queda reservado.
function exigirRol(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.usuario.rol)) throw prohibido();
    next();
  };
}

module.exports = { autenticar, exigirRol };
