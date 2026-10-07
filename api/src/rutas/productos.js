// Productos = presentaciones vendibles (30, 60 o 100 ml) de cada fragancia.
const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize, Producto, Fragancia } = require('../modelos');
const { auditar } = require('../servicios/auditoria');
const { noEncontrado, reglaDeNegocio, validacion } = require('../utilidades/errores');
const { texto, entero, booleano, opcion, precio, cuerpo, paginacion, patronBusqueda } = require('../utilidades/validar');

const router = express.Router();

const ESTADOS = ['borrador', 'activo', 'inactivo'];
const COLUMNAS = `id_producto, id_fragancia, codigo, nombre, fragancia, presentacion_ml, id_categoria, categoria,
                  precio_venta, existencias, umbral_minimo, estado, visible_landing,
                  CASE WHEN estado = 'inactivo' THEN 'Inactivo'
                       WHEN estado = 'borrador' THEN 'Borrador'
                       WHEN existencias = 0 THEN 'Agotado'
                       WHEN existencias <= umbral_minimo THEN 'Crítico'
                       ELSE 'Normal' END AS estado_stock`;

// Filtros por situación de stock (solo productos activos).
const FILTROS_STOCK = {
  normal: "estado = 'activo' AND existencias > umbral_minimo",
  critico: "estado = 'activo' AND existencias > 0 AND existencias <= umbral_minimo",
  agotado: "estado = 'activo' AND existencias = 0",
};

const serializar = (p) => ({ ...p, precio_venta: p.precio_venta === null ? null : Number(p.precio_venta) });

async function obtener(id, transaccion) {
  const [fila] = await sequelize.query(`SELECT ${COLUMNAS} FROM v_producto WHERE id_producto = :id`, {
    replacements: { id },
    type: QueryTypes.SELECT,
    transaction: transaccion,
  });
  return fila ? serializar(fila) : null;
}

const idDe = (req) => entero(req.params.id, 'id', { min: 1 });

async function cargar(id, transaccion) {
  const p = await Producto.findByPk(id, { transaction: transaccion, lock: transaccion.LOCK.UPDATE });
  if (!p) throw noEncontrado('El producto no existe');
  return p;
}

router.get('/', async (req, res) => {
  const { pagina, limite, desplazamiento } = paginacion(req.query, { limitePorDefecto: 50, limiteMax: 200 });
  const condiciones = [];
  const reemplazos = { limite, desplazamiento };
  if (req.query.fragancia !== undefined) {
    reemplazos.fragancia = entero(req.query.fragancia, 'fragancia', { min: 1 });
    condiciones.push('id_fragancia = :fragancia');
  }
  if (req.query.categoria !== undefined) {
    reemplazos.categoria = entero(req.query.categoria, 'categoria', { min: 1 });
    condiciones.push('id_categoria = :categoria');
  }
  if (req.query.presentacion !== undefined) {
    reemplazos.presentacion = opcion(entero(req.query.presentacion, 'presentacion'), 'presentacion', [30, 60, 100]);
    condiciones.push('presentacion_ml = :presentacion');
  }
  if (req.query.estado !== undefined) {
    reemplazos.estado = opcion(req.query.estado, 'estado', ESTADOS);
    condiciones.push('estado = :estado');
  }
  if (req.query.stock !== undefined) {
    condiciones.push(FILTROS_STOCK[opcion(req.query.stock, 'stock', Object.keys(FILTROS_STOCK))]);
  }
  if (req.query.q !== undefined) {
    reemplazos.q = patronBusqueda(req.query.q);
    condiciones.push("(nombre ILIKE :q ESCAPE '\\' OR codigo ILIKE :q ESCAPE '\\')");
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = await sequelize.query(
    `SELECT ${COLUMNAS} FROM v_producto ${donde} ORDER BY codigo, presentacion_ml LIMIT :limite OFFSET :desplazamiento`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  const [{ total }] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM v_producto ${donde}`, {
    replacements: reemplazos,
    type: QueryTypes.SELECT,
  });
  res.json({ pagina, limite, total, total_paginas: Math.ceil(total / limite), productos: filas.map(serializar) });
});

router.get('/:id', async (req, res) => {
  const p = await obtener(idDe(req));
  if (!p) throw noEncontrado('El producto no existe');
  res.json({ producto: p });
});

// Precio, umbral de stock crítico y descripción. Un producto activo no puede quedar sin precio.
router.patch('/:id', async (req, res) => {
  const id = idDe(req);
  const b = cuerpo(req);
  const extra = Object.keys(b).filter((k) => !['precio_venta', 'umbral_minimo', 'descripcion', 'activar', 'publicar'].includes(k));
  if (extra.length) throw validacion(`Campos no permitidos: ${extra.join(', ')}`);

  const cambios = {
    precio_venta: precio(b.precio_venta, 'El precio', { requerido: false, nulable: true }),
    umbral_minimo: entero(b.umbral_minimo, 'El umbral mínimo', { min: 0, max: 100000, requerido: false }),
    descripcion: texto(b.descripcion, 'La descripción', { max: 2000, requerido: false, nulable: true }),
  };
  for (const k of Object.keys(cambios)) if (cambios[k] === undefined) delete cambios[k];
  const publicar = booleano(b.publicar, 'publicar', { requerido: false }) === true;
  const activar = booleano(b.activar, 'activar', { requerido: false }) === true;
  if (publicar && activar) throw validacion('Indica solo una: activar o publicar');
  if (!Object.keys(cambios).length && !publicar && !activar) throw validacion('No se envió ningún campo para modificar');

  await sequelize.transaction(async (t) => {
    const p = await cargar(id, t);
    if (cambios.precio_venta === null && p.estado === 'activo') {
      throw reglaDeNegocio('Un producto activo no puede quedar sin precio. Inactívalo o pásalo a borrador primero.');
    }
    const antes = Object.fromEntries(Object.keys(cambios).map((k) => [k, p[k] === null ? null : k === 'precio_venta' ? Number(p[k]) : p[k]]));
    if (Object.keys(cambios).length) {
      await p.update(cambios, { transaction: t });
      await auditar(t, req.usuario.id, 'producto', id, 'editar', { antes, despues: cambios });
    }
    // Poner el precio y activar o publicar en un solo paso (si la regla falla, tampoco se guarda el precio).
    if (publicar || activar) await aplicarTransicion(p, publicar ? 'publicar' : 'activar', t, req.usuario.id);
  });
  res.json({ producto: await obtener(id) });
});

// Transiciones de estado:
//   activar     -> se puede vender en el panel, sin mostrarse en la landing
//   publicar    -> activo y visible en la landing
//   despublicar -> deja de mostrarse en la landing, sigue activo
//   inactivar   -> fuera de venta y de la landing
async function aplicarTransicion(p, accion, t, idUsuario) {
  const antes = { estado: p.estado, visible_landing: p.visible_landing };
  let despues;

  if (accion === 'activar' || accion === 'publicar') {
    if (!(Number(p.precio_venta) > 0)) {
      throw reglaDeNegocio(`Fija el precio de la presentación de ${p.presentacion_ml} ml antes de ${accion === 'publicar' ? 'publicarla' : 'activarla'}`);
    }
    const f = await Fragancia.findByPk(p.id_fragancia, { transaction: t });
    if (!f.activa) throw reglaDeNegocio('La fragancia está inactiva: reactívala primero');
    despues = { estado: 'activo', visible_landing: accion === 'publicar' ? true : p.visible_landing };
  } else if (accion === 'despublicar') {
    despues = { estado: p.estado, visible_landing: false };
  } else {
    despues = { estado: 'inactivo', visible_landing: false };
  }

  await p.update(despues, { transaction: t });
  await auditar(t, idUsuario, 'producto', p.id_producto, accion === 'inactivar' ? 'inactivar' : 'editar', { cambio: accion, antes, despues });
}

async function transicion(req, res, accion) {
  const id = idDe(req);
  await sequelize.transaction(async (t) => {
    const p = await cargar(id, t);
    await aplicarTransicion(p, accion, t, req.usuario.id);
  });
  res.json({ producto: await obtener(id) });
}

for (const accion of ['activar', 'publicar', 'despublicar', 'inactivar']) {
  router.post(`/:id/${accion}`, (req, res) => transicion(req, res, accion));
}

module.exports = router;
