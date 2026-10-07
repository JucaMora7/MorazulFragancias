// Consultas de fragancias con sus presentaciones, para el panel de administración.
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../modelos');
const almacenamiento = require('./almacenamiento');

const SELECCION = `
  SELECT f.id_fragancia, f.codigo, f.nombre, f.id_categoria, c.nombre AS categoria,
         f.inspirada_en, f.es_arabe, f.color_caja, f.nota, f.imagen_url, f.activa,
         COALESCE(json_agg(json_build_object(
             'id_producto', p.id_producto,
             'presentacion_ml', p.presentacion_ml,
             'precio_venta', p.precio_venta,
             'existencias', p.existencias,
             'umbral_minimo', p.umbral_minimo,
             'estado', p.estado,
             'visible_landing', p.visible_landing) ORDER BY p.presentacion_ml)
             FILTER (WHERE p.id_producto IS NOT NULL), CAST('[]' AS json)) AS presentaciones
    FROM fragancia f
    JOIN categoria c USING (id_categoria)
    LEFT JOIN producto p USING (id_fragancia)`;

const serializar = (f) => ({ ...f, imagen_url: almacenamiento.url(f.imagen_url) });

async function listar({ condiciones = [], reemplazos = {}, limite, desplazamiento }) {
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = await sequelize.query(
    `${SELECCION} ${donde} GROUP BY f.id_fragancia, c.nombre ORDER BY f.codigo LIMIT :limite OFFSET :desplazamiento`,
    { replacements: { ...reemplazos, limite, desplazamiento }, type: QueryTypes.SELECT }
  );
  const [{ total }] = await sequelize.query(
    `SELECT COUNT(*)::int AS total FROM fragancia f ${donde}`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  return { total, fragancias: filas.map(serializar) };
}

async function obtener(id, transaccion) {
  const [fila] = await sequelize.query(`${SELECCION} WHERE f.id_fragancia = :id GROUP BY f.id_fragancia, c.nombre`, {
    replacements: { id },
    type: QueryTypes.SELECT,
    transaction: transaccion,
  });
  return fila ? serializar(fila) : null;
}

// Siguiente código libre dentro de la categoría, tomando el prefijo de sus fragancias (CAB-049, ...).
async function siguienteCodigo(idCategoria, transaccion) {
  const [existente] = await sequelize.query('SELECT codigo FROM fragancia WHERE id_categoria = :idCategoria LIMIT 1', {
    replacements: { idCategoria },
    type: QueryTypes.SELECT,
    transaction: transaccion,
  });
  if (!existente) return null;
  const prefijo = existente.codigo.split('-')[0];
  const [{ maximo }] = await sequelize.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM '[0-9]+$') AS integer)), 0) AS maximo
       FROM fragancia WHERE codigo LIKE :patron`,
    { replacements: { patron: `${prefijo}-%` }, type: QueryTypes.SELECT, transaction: transaccion }
  );
  return `${prefijo}-${String(maximo + 1).padStart(3, '0')}`;
}

module.exports = { listar, obtener, siguienteCodigo };
