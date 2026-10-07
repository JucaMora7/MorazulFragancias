// Rutas públicas: solo lectura del catálogo publicado (v_catalogo_publico) y datos de contacto.
// Nunca exponen existencias exactas, umbrales ni datos internos.
const express = require('express');
const config = require('../config');
const { sequelize } = require('../modelos');
const almacenamiento = require('../servicios/almacenamiento');
const { noEncontrado } = require('../utilidades/errores');
const { entero, booleano, opcion, paginacion, patronBusqueda } = require('../utilidades/validar');
const { QueryTypes } = require('sequelize');

const router = express.Router();

const CODIGO = /^[A-Za-z]{3}-\d{3}$/;

const presentacionPublica = (p) => ({
  presentacion_ml: p.presentacion_ml,
  precio: p.precio,
  disponibilidad: p.disponibilidad,
  imagen_url: almacenamiento.url(p.imagen_url),
});

const fragancia = (f) => ({
  codigo: f.codigo,
  nombre: f.fragancia,
  categoria: f.categoria,
  es_arabe: f.es_arabe,
  inspirada_en: f.inspirada_en,
  desde: f.desde === null ? null : Number(f.desde),
  imagen_url: almacenamiento.url(f.presentaciones[0]?.imagen_url),
  presentaciones: f.presentaciones.map(presentacionPublica),
});

const AGRUPAR = `
  SELECT v.codigo, v.fragancia, v.categoria, v.es_arabe, v.inspirada_en,
         MIN(v.precio_venta) AS desde,
         json_agg(json_build_object(
             'presentacion_ml', v.presentacion_ml,
             'precio', v.precio_venta,
             'disponibilidad', v.disponibilidad,
             'imagen_url', v.imagen_url) ORDER BY v.presentacion_ml) AS presentaciones
    FROM v_catalogo_publico v`;
const GRUPOS = 'GROUP BY v.codigo, v.fragancia, v.categoria, v.es_arabe, v.inspirada_en';

// Catálogo agrupado por fragancia, con filtros y paginación.
router.get('/catalogo', async (req, res) => {
  const { pagina, limite, desplazamiento } = paginacion(req.query);
  const condiciones = [];
  const reemplazos = { limite, desplazamiento };

  if (req.query.categoria !== undefined) {
    reemplazos.categoria = entero(req.query.categoria, 'categoria', { min: 1 });
    condiciones.push('v.categoria = (SELECT nombre FROM categoria WHERE id_categoria = :categoria)');
  }
  if (req.query.arabes !== undefined && booleano(req.query.arabes, 'arabes')) {
    condiciones.push('v.es_arabe');
  }
  if (req.query.presentacion !== undefined) {
    reemplazos.presentacion = entero(req.query.presentacion, 'presentacion');
    opcion(reemplazos.presentacion, 'presentacion', [30, 60, 100]);
    condiciones.push('v.codigo IN (SELECT codigo FROM v_catalogo_publico WHERE presentacion_ml = :presentacion)');
  }
  if (req.query.q !== undefined) {
    reemplazos.q = patronBusqueda(req.query.q);
    condiciones.push("v.fragancia ILIKE :q ESCAPE '\\'");
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const filas = await sequelize.query(
    `${AGRUPAR} ${donde} ${GRUPOS} ORDER BY v.fragancia LIMIT :limite OFFSET :desplazamiento`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  const [{ total }] = await sequelize.query(
    `SELECT COUNT(DISTINCT v.codigo)::int AS total FROM v_catalogo_publico v ${donde}`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );

  res.json({ pagina, limite, total, total_paginas: Math.ceil(total / limite), fragancias: filas.map(fragancia) });
});

router.get('/catalogo/:codigo', async (req, res) => {
  if (!CODIGO.test(req.params.codigo)) throw noEncontrado('La fragancia no existe');
  const [fila] = await sequelize.query(`${AGRUPAR} WHERE v.codigo = :codigo ${GRUPOS}`, {
    replacements: { codigo: req.params.codigo.toUpperCase() },
    type: QueryTypes.SELECT,
  });
  if (!fila) throw noEncontrado('La fragancia no existe');
  res.json({ fragancia: fragancia(fila) });
});

// Categorías que tienen al menos una presentación publicada.
router.get('/categorias', async (_req, res) => {
  const filas = await sequelize.query(
    `SELECT c.id_categoria, c.nombre, COUNT(DISTINCT v.codigo)::int AS fragancias
       FROM categoria c
       JOIN v_catalogo_publico v ON v.categoria = c.nombre
      GROUP BY c.id_categoria, c.nombre
      ORDER BY c.id_categoria`,
    { type: QueryTypes.SELECT }
  );
  res.json({ categorias: filas });
});

router.get('/contacto', (_req, res) => {
  const c = config.contacto;
  res.json({
    whatsapp: c.whatsapp,
    whatsapp_enlace: `https://wa.me/${c.whatsapp}`,
    correo: c.correo,
    ciudad: c.ciudad,
    horario: c.horario,
    direccion: c.direccion,
  });
});

module.exports = router;
