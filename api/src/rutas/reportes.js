// Reportes descriptivos. Los días son los de Bogotá, como en las vistas de la base de datos.
// Si no se indica rango, se usan los últimos 30 días contando hoy.
const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../modelos');
const cajaServicio = require('../servicios/caja');
const { validacion } = require('../utilidades/errores');
const { entero, booleano, opcion, fecha } = require('../utilidades/validar');

const router = express.Router();

const DIAS_POR_DEFECTO = 30;
const MAX_DIAS = 366;
const DIA_MS = 24 * 60 * 60 * 1000;

const aMs = (f) => Date.parse(`${f}T00:00:00Z`);
const restarDias = (f, n) => new Date(aMs(f) - n * DIA_MS).toISOString().slice(0, 10);

async function leerRango(query) {
  const hoy = await cajaServicio.fechaHoy();
  const hasta = query.hasta !== undefined ? fecha(query.hasta, 'hasta') : hoy;
  const desde = query.desde !== undefined ? fecha(query.desde, 'desde') : restarDias(hasta, DIAS_POR_DEFECTO - 1);
  if (desde > hasta) throw validacion('La fecha "desde" no puede ser posterior a "hasta"');
  const dias = (aMs(hasta) - aMs(desde)) / DIA_MS + 1;
  if (dias > MAX_DIAS) throw validacion(`El rango no puede superar ${MAX_DIAS} días`);
  return { desde, hasta, dias };
}

const dinero = (v) => Number(v ?? 0);
const DIA_BOGOTA = "CAST(v.fecha_hora AT TIME ZONE 'America/Bogota' AS date)";

// Más y menos vendido, por producto o por fragancia (hoy cada fragancia tiene un solo producto).
//  · "mas": solo lo que se vendió en el rango, de mayor a menor (incluye productos hoy inactivos).
//  · "menos": productos activos con existencias, de menos a más vendido; los que no se vendieron
//    nada salen primero, con su stock, que es lo que está parado. Con solo_con_ventas=true se
//    descartan los que no tuvieron ninguna venta.
function rankingVentas(modo) {
  return async (req, res) => {
    const q = req.query;
    const { desde, hasta } = await leerRango(q);
    const limite = entero(q.limite ?? '10', 'limite', { min: 1, max: 100 });
    const agrupar = opcion(q.agrupar ?? 'producto', 'agrupar', ['producto', 'fragancia']);
    const soloConVentas = q.solo_con_ventas !== undefined && booleano(q.solo_con_ventas, 'solo_con_ventas');
    const reemplazos = { desde, hasta, limite };
    const filtros = [];
    if (q.categoria !== undefined) {
      reemplazos.categoria = entero(q.categoria, 'categoria', { min: 1 });
      filtros.push('p.id_categoria = :categoria');
    }
    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

    const ventas = `
      WITH ventas AS (
        SELECT id_producto, SUM(unidades_vendidas)::int AS unidades, SUM(ingresos) AS ingresos
          FROM v_ventas_producto_dia
         WHERE fecha BETWEEN CAST(:desde AS date) AND CAST(:hasta AS date)
         GROUP BY id_producto)`;

    let sql;
    if (agrupar === 'producto') {
      const condicion = modo === 'mas'
        ? 'COALESCE(v.unidades, 0) > 0'
        : `p.estado = 'activo' AND p.existencias > 0${soloConVentas ? ' AND COALESCE(v.unidades, 0) > 0' : ''}`;
      const orden = modo === 'mas'
        ? 'unidades_vendidas DESC, ingresos DESC, nombre'
        : 'unidades_vendidas ASC, existencias DESC, nombre';
      sql = `${ventas}
        SELECT p.id_producto, p.codigo, p.nombre, p.presentacion_ml, p.categoria, p.existencias,
               COALESCE(v.unidades, 0) AS unidades_vendidas, COALESCE(v.ingresos, 0) AS ingresos
          FROM v_producto p LEFT JOIN ventas v USING (id_producto)
          ${donde ? `${donde} AND` : 'WHERE'} ${condicion}
         ORDER BY ${orden} LIMIT :limite`;
    } else {
      const condicion = modo === 'mas'
        ? 'unidades_vendidas > 0'
        : `existencias > 0${soloConVentas ? ' AND unidades_vendidas > 0' : ''}`;
      const orden = modo === 'mas'
        ? 'unidades_vendidas DESC, ingresos DESC, nombre'
        : 'unidades_vendidas ASC, existencias DESC, nombre';
      sql = `${ventas},
        por_fragancia AS (
          SELECT p.id_fragancia, p.codigo, p.fragancia AS nombre, p.categoria,
                 COALESCE(SUM(v.unidades), 0)::int AS unidades_vendidas,
                 COALESCE(SUM(v.ingresos), 0) AS ingresos,
                 COALESCE(SUM(p.existencias) FILTER (WHERE p.estado = 'activo'), 0)::int AS existencias
            FROM v_producto p LEFT JOIN ventas v USING (id_producto)
            ${donde}
           GROUP BY p.id_fragancia, p.codigo, p.fragancia, p.categoria)
        SELECT * FROM por_fragancia WHERE ${condicion} ORDER BY ${orden} LIMIT :limite`;
    }

    const filas = await sequelize.query(sql, { replacements: reemplazos, type: QueryTypes.SELECT });
    res.json({
      desde,
      hasta,
      agrupar,
      ranking: filas.map((f, i) => ({ posicion: i + 1, ...f, ingresos: dinero(f.ingresos) })),
    });
  };
}

router.get('/mas-vendidos', rankingVentas('mas'));
router.get('/menos-vendidos', rankingVentas('menos'));

// Totales del periodo y su serie diaria (con ceros en los días sin ventas) para gráficas.
router.get('/ventas', async (req, res) => {
  const { desde, hasta } = await leerRango(req.query);
  const reemplazos = { desde, hasta };
  const rango = `${DIA_BOGOTA} BETWEEN CAST(:desde AS date) AND CAST(:hasta AS date)`;

  const [totales] = await sequelize.query(
    `SELECT COUNT(DISTINCT v.id_venta)::int AS ventas,
            COALESCE(SUM(dv.cantidad), 0)::int AS unidades,
            COALESCE(SUM(dv.subtotal), 0) AS ingresos,
            COUNT(DISTINCT dv.id_producto)::int AS productos_vendidos
       FROM venta v JOIN detalle_venta dv USING (id_venta) WHERE ${rango}`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  // Productos activos con existencias que no vendieron nada en el periodo (inventario parado).
  const [{ sin_ventas: productosSinVentas }] = await sequelize.query(
    `SELECT COUNT(*)::int AS sin_ventas
       FROM producto p
      WHERE p.estado = 'activo' AND p.existencias > 0
        AND NOT EXISTS (
            SELECT 1 FROM detalle_venta dv JOIN venta v USING (id_venta)
             WHERE dv.id_producto = p.id_producto AND ${rango})`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  const serie = await sequelize.query(
    `SELECT to_char(d.dia, 'YYYY-MM-DD') AS fecha,
            COALESCE(x.ventas, 0) AS ventas, COALESCE(x.unidades, 0) AS unidades, COALESCE(x.ingresos, 0) AS ingresos
       FROM generate_series(CAST(:desde AS date), CAST(:hasta AS date), INTERVAL '1 day') AS d(dia)
       LEFT JOIN (
            SELECT ${DIA_BOGOTA} AS dia, COUNT(DISTINCT v.id_venta)::int AS ventas,
                   SUM(dv.cantidad)::int AS unidades, SUM(dv.subtotal) AS ingresos
              FROM venta v JOIN detalle_venta dv USING (id_venta)
             WHERE ${rango} GROUP BY 1) x ON x.dia = CAST(d.dia AS date)
      ORDER BY d.dia`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  const porCategoria = await sequelize.query(
    `SELECT p.categoria, SUM(dv.cantidad)::int AS unidades, SUM(dv.subtotal) AS ingresos
       FROM venta v JOIN detalle_venta dv USING (id_venta) JOIN v_producto p USING (id_producto)
      WHERE ${rango} GROUP BY p.categoria ORDER BY SUM(dv.subtotal) DESC, p.categoria`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );

  const ingresos = dinero(totales.ingresos);
  res.json({
    desde,
    hasta,
    totales: {
      ventas: totales.ventas,
      unidades: totales.unidades,
      productos_vendidos: totales.productos_vendidos,
      productos_sin_ventas: productosSinVentas,
      ingresos,
      ticket_promedio: totales.ventas ? Math.round((ingresos / totales.ventas) * 100) / 100 : 0,
    },
    por_dia: serie.map((s) => ({ ...s, ingresos: dinero(s.ingresos) })),
    por_categoria: porCategoria.map((s) => ({ ...s, ingresos: dinero(s.ingresos) })),
  });
});

// Resumen de caja por día, con la diferencia entre lo contado al cerrar y lo esperado.
router.get('/caja', async (req, res) => {
  const { desde, hasta } = await leerRango(req.query);
  const filas = await sequelize.query(
    `SELECT r.id_caja, to_char(r.fecha, 'YYYY-MM-DD') AS fecha, r.estado,
            r.saldo_apertura, r.ingresos, r.egresos, r.saldo_esperado, r.saldo_cierre,
            CASE WHEN r.estado = 'cerrada' THEN r.saldo_cierre - r.saldo_esperado END AS diferencia,
            (SELECT COUNT(*)::int FROM venta v WHERE v.id_caja = r.id_caja) AS ventas,
            (SELECT COALESCE(SUM(m.valor), 0) FROM movimiento_caja m WHERE m.id_caja = r.id_caja AND m.id_venta IS NOT NULL) AS ingresos_por_ventas
       FROM v_resumen_caja r
      WHERE r.fecha BETWEEN CAST(:desde AS date) AND CAST(:hasta AS date)
      ORDER BY r.fecha`,
    { replacements: { desde, hasta }, type: QueryTypes.SELECT }
  );
  const cajas = filas.map((c) => ({
    ...c,
    saldo_apertura: dinero(c.saldo_apertura),
    ingresos: dinero(c.ingresos),
    egresos: dinero(c.egresos),
    saldo_esperado: dinero(c.saldo_esperado),
    saldo_cierre: c.saldo_cierre === null ? null : dinero(c.saldo_cierre),
    diferencia: c.diferencia === null ? null : dinero(c.diferencia),
    ingresos_por_ventas: dinero(c.ingresos_por_ventas),
  }));
  const suma = (campo) => Math.round(cajas.reduce((s, c) => s + c[campo], 0) * 100) / 100;
  res.json({
    desde,
    hasta,
    totales: {
      cajas: cajas.length,
      ventas: cajas.reduce((s, c) => s + c.ventas, 0),
      ingresos: suma('ingresos'),
      ingresos_por_ventas: suma('ingresos_por_ventas'),
      egresos: suma('egresos'),
      diferencia: suma('diferencia'),
      cajas_sin_cerrar: cajas.filter((c) => c.estado === 'abierta').length,
    },
    cajas,
  });
});

module.exports = router;
