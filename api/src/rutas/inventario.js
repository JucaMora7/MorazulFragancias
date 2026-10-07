const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize, Producto, MovimientoInventario } = require('../modelos');
const { noEncontrado, reglaDeNegocio, validacion } = require('../utilidades/errores');
const { texto, entero, opcion, fecha, cuerpo, paginacion } = require('../utilidades/validar');

const router = express.Router();

// Entradas y ajustes manuales. Las salidas por venta solo se crean al registrar una venta.
router.post('/movimientos', async (req, res) => {
  const b = cuerpo(req);
  const extra = Object.keys(b).filter((k) => !['id_producto', 'tipo', 'cantidad', 'motivo'].includes(k));
  if (extra.length) throw validacion(`Campos no permitidos: ${extra.join(', ')}`);

  const idProducto = entero(b.id_producto, 'id_producto', { min: 1 });
  const tipo = opcion(b.tipo, 'El tipo', ['entrada', 'ajuste']);
  const cantidad = entero(b.cantidad, 'La cantidad', { min: -100000, max: 100000 });
  if (cantidad === 0) throw validacion('La cantidad no puede ser cero');
  if (tipo === 'entrada' && cantidad < 0) throw validacion('Una entrada debe sumar unidades: usa un ajuste para restar');
  const motivo = texto(b.motivo, 'El motivo', { min: 3, max: 200, requerido: tipo === 'ajuste', nulable: tipo === 'entrada' });

  const resultado = await sequelize.transaction(async (t) => {
    const p = await Producto.findByPk(idProducto, { transaction: t, lock: t.LOCK.UPDATE });
    if (!p) throw noEncontrado('El producto no existe');
    if (p.estado === 'inactivo') throw reglaDeNegocio('El producto está inactivo: reactívalo antes de mover su inventario');
    if (p.existencias + cantidad < 0) {
      throw reglaDeNegocio(`Existencias insuficientes: hay ${p.existencias} y el movimiento resta ${-cantidad}`);
    }

    const mov = await MovimientoInventario.create(
      { id_producto: idProducto, id_usuario: req.usuario.id, tipo, cantidad, motivo: motivo ?? null },
      { transaction: t }
    );
    const [producto] = await sequelize.query(
      'SELECT id_producto, nombre, existencias, umbral_minimo FROM v_producto WHERE id_producto = :idProducto',
      { replacements: { idProducto }, type: QueryTypes.SELECT, transaction: t }
    );
    const [alerta] = await sequelize.query(
      "SELECT id_alerta FROM alerta_stock WHERE id_producto = :idProducto AND estado = 'activa'",
      { replacements: { idProducto }, type: QueryTypes.SELECT, transaction: t }
    );
    return { id: mov.id_movimiento, producto, alerta_activa: Boolean(alerta) };
  });

  const [movimiento] = await sequelize.query(
    'SELECT id_movimiento, id_producto, tipo, cantidad, existencias_resultantes, motivo, fecha_hora FROM movimiento_inventario WHERE id_movimiento = :id',
    { replacements: { id: resultado.id }, type: QueryTypes.SELECT }
  );
  res.status(201).json({ movimiento, producto: resultado.producto, alerta_activa: resultado.alerta_activa });
});

// Libro de movimientos (kardex), del más reciente al más antiguo.
router.get('/movimientos', async (req, res) => {
  const { pagina, limite, desplazamiento } = paginacion(req.query, { limitePorDefecto: 50, limiteMax: 200 });
  const condiciones = [];
  const reemplazos = { limite, desplazamiento };
  const diaBogota = "CAST((m.fecha_hora AT TIME ZONE 'America/Bogota') AS date)";
  if (req.query.producto !== undefined) {
    reemplazos.producto = entero(req.query.producto, 'producto', { min: 1 });
    condiciones.push('m.id_producto = :producto');
  }
  if (req.query.tipo !== undefined) {
    reemplazos.tipo = opcion(req.query.tipo, 'tipo', ['entrada', 'venta', 'ajuste']);
    condiciones.push('m.tipo = :tipo');
  }
  if (req.query.desde !== undefined) {
    reemplazos.desde = fecha(req.query.desde, 'desde');
    condiciones.push(`${diaBogota} >= :desde`);
  }
  if (req.query.hasta !== undefined) {
    reemplazos.hasta = fecha(req.query.hasta, 'hasta');
    condiciones.push(`${diaBogota} <= :hasta`);
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const movimientos = await sequelize.query(
    `SELECT m.id_movimiento, m.id_producto, p.codigo, p.nombre AS producto, m.tipo, m.cantidad,
            m.existencias_resultantes, m.motivo, m.fecha_hora, u.nombre AS usuario
       FROM movimiento_inventario m
       JOIN v_producto p USING (id_producto)
       JOIN usuario u USING (id_usuario) ${donde}
      ORDER BY m.fecha_hora DESC, m.id_movimiento DESC LIMIT :limite OFFSET :desplazamiento`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  const [{ total }] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM movimiento_inventario m ${donde}`, {
    replacements: reemplazos,
    type: QueryTypes.SELECT,
  });
  res.json({ pagina, limite, total, total_paginas: Math.ceil(total / limite), movimientos });
});

// Conteos para el inicio del panel. Agotado: sin unidades. Crítico: con unidades pero en el umbral o por debajo.
router.get('/resumen', async (_req, res) => {
  const [fila] = await sequelize.query(
    `SELECT COUNT(*) FILTER (WHERE estado = 'activo')::int                                         AS activos,
            COUNT(*) FILTER (WHERE estado = 'activo' AND existencias = 0)::int                     AS agotados,
            COUNT(*) FILTER (WHERE estado = 'activo' AND existencias > 0 AND existencias <= umbral_minimo)::int AS criticos,
            COUNT(*) FILTER (WHERE estado = 'borrador')::int                                       AS borradores,
            COUNT(*) FILTER (WHERE estado = 'inactivo')::int                                       AS inactivos,
            COALESCE(SUM(existencias) FILTER (WHERE estado = 'activo'), 0)::int                    AS unidades_en_stock
       FROM producto`,
    { type: QueryTypes.SELECT }
  );
  const [{ alertas_activas }] = await sequelize.query(
    "SELECT COUNT(*)::int AS alertas_activas FROM alerta_stock WHERE estado = 'activa'",
    { type: QueryTypes.SELECT }
  );
  res.json({ resumen: { ...fila, alertas_activas } });
});

module.exports = router;
