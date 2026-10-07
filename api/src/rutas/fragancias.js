const express = require('express');
const multer = require('multer');
const config = require('../config');
const { sequelize, Fragancia, Producto, Categoria } = require('../modelos');
const { auditar } = require('../servicios/auditoria');
const servicio = require('../servicios/fragancias');
const almacenamiento = require('../servicios/almacenamiento');
const { prepararImagen } = require('../servicios/imagenes');
const { noEncontrado, reglaDeNegocio, validacion } = require('../utilidades/errores');
const { texto, entero, booleano, opcion, cuerpo, paginacion, patronBusqueda } = require('../utilidades/validar');

const router = express.Router();
const subir = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.imagenes.maxBytes, files: 1 } });

const CODIGO = /^[A-Z]{3}-\d{3}$/;
const mayusculas = (s) => (s == null ? s : s.toLocaleUpperCase('es-CO'));

function rechazarDesconocidos(b, permitidos) {
  const extra = Object.keys(b).filter((k) => !permitidos.includes(k));
  if (extra.length) throw validacion(`Campos no permitidos: ${extra.join(', ')}`);
}

// Lee y valida los campos de una fragancia. En la creación nombre y categoría son obligatorios.
function leerDatos(b, { crear }) {
  const datos = {
    nombre: mayusculas(texto(b.nombre, 'El nombre', { max: 80, requerido: crear })),
    id_categoria: entero(b.id_categoria, 'La categoría', { min: 1, requerido: crear }),
    inspirada_en: mayusculas(texto(b.inspirada_en, 'La marca de referencia', { max: 80, requerido: false, nulable: true })),
    es_arabe: booleano(b.es_arabe, 'es_arabe', { requerido: false }),
    color_caja: opcion(b.color_caja, 'El color de caja', ['azul', 'morada'], { requerido: false, nulable: true }),
    nota: texto(b.nota, 'La nota', { max: 200, requerido: false, nulable: true }),
  };
  return Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined));
}

function idDe(req) {
  return entero(req.params.id, 'id', { min: 1 });
}

async function cargar(id, transaccion) {
  const f = await Fragancia.findByPk(id, transaccion ? { transaction: transaccion, lock: transaccion.LOCK.UPDATE } : undefined);
  if (!f) throw noEncontrado('La fragancia no existe');
  return f;
}

async function exigirCategoria(id) {
  if (!(await Categoria.findByPk(id))) throw reglaDeNegocio('La categoría no existe');
}

router.get('/', async (req, res) => {
  const { pagina, limite, desplazamiento } = paginacion(req.query, { limitePorDefecto: 50, limiteMax: 200 });
  const condiciones = [];
  const reemplazos = {};
  if (req.query.categoria !== undefined) {
    reemplazos.categoria = entero(req.query.categoria, 'categoria', { min: 1 });
    condiciones.push('f.id_categoria = :categoria');
  }
  if (req.query.activa !== undefined) {
    reemplazos.activa = booleano(req.query.activa, 'activa');
    condiciones.push('f.activa = :activa');
  }
  if (req.query.arabes !== undefined && booleano(req.query.arabes, 'arabes')) condiciones.push('f.es_arabe');
  if (req.query.q !== undefined) {
    reemplazos.q = patronBusqueda(req.query.q);
    condiciones.push("(f.nombre ILIKE :q ESCAPE '\\' OR f.codigo ILIKE :q ESCAPE '\\')");
  }
  const { total, fragancias } = await servicio.listar({ condiciones, reemplazos, limite, desplazamiento });
  res.json({ pagina, limite, total, total_paginas: Math.ceil(total / limite), fragancias });
});

router.get('/:id', async (req, res) => {
  const f = await servicio.obtener(idDe(req));
  if (!f) throw noEncontrado('La fragancia no existe');
  res.json({ fragancia: f });
});

// Crea la fragancia y sus tres presentaciones en borrador (30 y 60 ml con su precio fijo; 100 ml sin precio).
router.post('/', async (req, res) => {
  const b = cuerpo(req);
  rechazarDesconocidos(b, ['nombre', 'id_categoria', 'inspirada_en', 'es_arabe', 'color_caja', 'nota', 'codigo']);
  const datos = leerDatos(b, { crear: true });
  const codigoIndicado = mayusculas(texto(b.codigo, 'El código', { max: 10, requerido: false }));
  if (codigoIndicado && !CODIGO.test(codigoIndicado)) throw validacion('El código debe tener el formato CAB-001');
  await exigirCategoria(datos.id_categoria);

  const id = await sequelize.transaction(async (t) => {
    const codigo = codigoIndicado || (await servicio.siguienteCodigo(datos.id_categoria, t));
    if (!codigo) throw validacion('Indica el código de la fragancia: esta categoría aún no tiene ninguna');
    const f = await Fragancia.create({ es_arabe: false, ...datos, codigo, activa: true }, { transaction: t });
    for (const ml of [30, 60, 100]) {
      await Producto.create(
        {
          id_fragancia: f.id_fragancia,
          presentacion_ml: ml,
          precio_venta: config.preciosIniciales[ml],
          estado: 'borrador',
          visible_landing: false,
          existencias: 0,
          umbral_minimo: 0,
        },
        { transaction: t }
      );
    }
    await auditar(t, req.usuario.id, 'fragancia', f.id_fragancia, 'crear', { codigo, nombre: f.nombre });
    return f.id_fragancia;
  });
  res.status(201).json({ fragancia: await servicio.obtener(id) });
});

router.patch('/:id', async (req, res) => {
  const id = idDe(req);
  const b = cuerpo(req);
  rechazarDesconocidos(b, ['nombre', 'id_categoria', 'inspirada_en', 'es_arabe', 'color_caja', 'nota']);
  const cambios = leerDatos(b, { crear: false });
  if (!Object.keys(cambios).length) throw validacion('No se envió ningún campo para modificar');
  if (cambios.id_categoria) await exigirCategoria(cambios.id_categoria);

  await sequelize.transaction(async (t) => {
    const f = await cargar(id, t);
    const antes = Object.fromEntries(Object.keys(cambios).map((k) => [k, f[k]]));
    await f.update(cambios, { transaction: t });
    await auditar(t, req.usuario.id, 'fragancia', id, 'editar', { antes, despues: cambios });
  });
  res.json({ fragancia: await servicio.obtener(id) });
});

// Una fragancia no se borra: se inactiva y con ella todas sus presentaciones.
router.post('/:id/inactivar', async (req, res) => {
  const id = idDe(req);
  await sequelize.transaction(async (t) => {
    const f = await cargar(id, t);
    await f.update({ activa: false }, { transaction: t });
    await Producto.update({ estado: 'inactivo', visible_landing: false }, { where: { id_fragancia: id }, transaction: t });
    await auditar(t, req.usuario.id, 'fragancia', id, 'inactivar', { codigo: f.codigo });
  });
  res.json({ fragancia: await servicio.obtener(id) });
});

// Reactivar devuelve las presentaciones a borrador: el administrador decide qué vuelve a publicar.
router.post('/:id/reactivar', async (req, res) => {
  const id = idDe(req);
  await sequelize.transaction(async (t) => {
    const f = await cargar(id, t);
    await f.update({ activa: true }, { transaction: t });
    await Producto.update({ estado: 'borrador' }, { where: { id_fragancia: id, estado: 'inactivo' }, transaction: t });
    await auditar(t, req.usuario.id, 'fragancia', id, 'editar', { cambio: 'reactivar', codigo: f.codigo });
  });
  res.json({ fragancia: await servicio.obtener(id) });
});

router.post('/:id/imagen', subir.single('imagen'), async (req, res) => {
  const id = idDe(req);
  if (!req.file) throw validacion('Envía la imagen en el campo "imagen"');
  const webp = await prepararImagen(req.file.buffer);

  const f = await cargar(id);
  const clave = `fragancias/${f.codigo.toLowerCase()}-${Date.now()}.webp`;
  const anterior = f.imagen_url;
  await almacenamiento.guardar(clave, webp);
  try {
    await sequelize.transaction(async (t) => {
      await f.update({ imagen_url: clave }, { transaction: t });
      await auditar(t, req.usuario.id, 'fragancia', id, 'editar', { cambio: 'imagen', imagen_url: clave });
    });
  } catch (err) {
    await almacenamiento.eliminar(clave);
    throw err;
  }
  if (anterior) await almacenamiento.eliminarSiPuede(anterior);
  res.json({ fragancia: await servicio.obtener(id) });
});

// Quitar la foto propia devuelve la fragancia a la imagen genérica de cada presentación.
router.delete('/:id/imagen', async (req, res) => {
  const id = idDe(req);
  const f = await cargar(id);
  const anterior = f.imagen_url;
  if (anterior) {
    await sequelize.transaction(async (t) => {
      await f.update({ imagen_url: null }, { transaction: t });
      await auditar(t, req.usuario.id, 'fragancia', id, 'editar', { cambio: 'imagen', imagen_url: null });
    });
    await almacenamiento.eliminarSiPuede(anterior);
  }
  res.json({ fragancia: await servicio.obtener(id) });
});

module.exports = router;
