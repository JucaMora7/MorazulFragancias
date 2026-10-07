// Categorías y configuración general (rutas protegidas).
const express = require('express');
const { Categoria, Configuracion } = require('../modelos');
const { noEncontrado, validacion } = require('../utilidades/errores');
const { booleano, cuerpo } = require('../utilidades/validar');

const categorias = express.Router();
categorias.get('/', async (_req, res) => {
  const filas = await Categoria.findAll({ order: [['id_categoria', 'ASC']], raw: true });
  res.json({ categorias: filas });
});

// Solo se pueden cambiar las claves de esta lista.
const CLAVES_BOOLEANAS = ['mostrar_inspirada_en'];

const configuracion = express.Router();
configuracion.get('/', async (_req, res) => {
  const filas = await Configuracion.findAll({ order: [['clave', 'ASC']], raw: true });
  res.json({ configuracion: filas });
});

configuracion.put('/:clave', async (req, res) => {
  const { clave } = req.params;
  if (!CLAVES_BOOLEANAS.includes(clave)) throw noEncontrado('Esa configuración no existe o no se puede modificar');
  const b = cuerpo(req);
  const valor = booleano(b.valor, 'valor');
  if (valor === undefined) throw validacion('valor es obligatorio');
  const fila = await Configuracion.findByPk(clave);
  if (!fila) throw noEncontrado('Esa configuración no existe');
  await fila.update({ valor: String(valor) });
  res.json({ configuracion: { clave, valor: fila.valor, descripcion: fila.descripcion } });
});

module.exports = { categorias, configuracion };
