const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { buscarPorCorreo } = require('../servicios/usuarios');
const { autenticar } = require('../middleware/autenticar');
const { noAutenticado } = require('../utilidades/errores');
const { texto, cuerpo } = require('../utilidades/validar');

const router = express.Router();

// Se compara contra un hash falso cuando el correo no existe, para que el tiempo de
// respuesta no revele si el correo está registrado.
const HASH_FALSO = bcrypt.hashSync('contrasena-falsa', config.bcryptCosto);
const MENSAJE_LOGIN = 'Correo o contraseña incorrectos';

const limitarLogin = rateLimit({
  windowMs: config.limiteLogin.ventanaMs,
  limit: config.limiteLogin.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: { codigo: 'demasiados_intentos', mensaje: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' } }),
});

router.post('/login', limitarLogin, async (req, res) => {
  const b = cuerpo(req);
  const correo = texto(b.correo, 'El correo', { max: 150 }).toLowerCase();
  const contrasena = texto(b.contrasena, 'La contraseña', { max: 200 });

  const usuario = await buscarPorCorreo(correo);
  const coincide = await bcrypt.compare(contrasena, usuario ? usuario.contrasena_hash : HASH_FALSO);
  if (!usuario || !usuario.activo || !coincide) throw noAutenticado(MENSAJE_LOGIN);

  const token = jwt.sign({ rol: usuario.rol }, config.jwt.secreto, {
    algorithm: 'HS256',
    subject: String(usuario.id_usuario),
    expiresIn: config.jwt.expiraEn,
  });
  res.json({
    token,
    usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  });
});

router.get('/yo', autenticar, (req, res) => {
  res.json({ usuario: { id_usuario: req.usuario.id, nombre: req.usuario.nombre, correo: req.usuario.correo, rol: req.usuario.rol } });
});

module.exports = router;
