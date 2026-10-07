const bcrypt = require('bcrypt');
const { fn, col, where } = require('sequelize');
const config = require('../config');
const { Usuario } = require('../modelos');
const { conflicto } = require('../utilidades/errores');
const { texto } = require('../utilidades/validar');

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buscarPorCorreo(correo) {
  return Usuario.findOne({ where: where(fn('lower', col('correo')), correo.toLowerCase()) });
}

// Crea un administrador. La contraseña se guarda solo como hash bcrypt.
async function crearAdministrador({ nombre, correo, contrasena }) {
  const nombreLimpio = texto(nombre, 'El nombre', { max: 100 });
  const correoLimpio = texto(correo, 'El correo', { max: 150 }).toLowerCase();
  if (!CORREO_VALIDO.test(correoLimpio)) throw new Error('El correo no es válido');
  if (typeof contrasena !== 'string' || contrasena.length < 10) {
    throw new Error('La contraseña debe tener al menos 10 caracteres');
  }
  if (await buscarPorCorreo(correoLimpio)) throw conflicto('Ya existe un usuario con ese correo');

  const contrasena_hash = await bcrypt.hash(contrasena, config.bcryptCosto);
  const usuario = await Usuario.create({ nombre: nombreLimpio, correo: correoLimpio, contrasena_hash, rol: 'administrador', activo: true });
  return { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol };
}

module.exports = { buscarPorCorreo, crearAdministrador };
