const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize, Producto, Venta, DetalleVenta, MovimientoInventario, MovimientoCaja } = require('../modelos');
const { auditar } = require('../servicios/auditoria');
const cajaServicio = require('../servicios/caja');
const { ErrorApi, noEncontrado, reglaDeNegocio, validacion } = require('../utilidades/errores');
const { entero, fecha, cuerpo, paginacion } = require('../utilidades/validar');

const router = express.Router();

const MAX_LINEAS = 50;
const MAX_UNIDADES = 1000;

async function obtenerVenta(id, transaccion) {
  const [cabecera] = await sequelize.query(
    `SELECT v.id_venta, v.id_caja, v.fecha_hora, v.total, u.nombre AS usuario
       FROM venta v JOIN usuario u USING (id_usuario) WHERE v.id_venta = :id`,
    { replacements: { id }, type: QueryTypes.SELECT, transaction: transaccion }
  );
  if (!cabecera) return null;
  const items = await sequelize.query(
    `SELECT dv.id_producto, p.nombre, p.presentacion_ml, dv.cantidad, dv.precio_unitario, dv.subtotal
       FROM detalle_venta dv JOIN v_producto p USING (id_producto)
      WHERE dv.id_venta = :id ORDER BY dv.id_detalle`,
    { replacements: { id }, type: QueryTypes.SELECT, transaction: transaccion }
  );
  return {
    ...cabecera,
    total: Number(cabecera.total),
    items: items.map((i) => ({ ...i, precio_unitario: Number(i.precio_unitario), subtotal: Number(i.subtotal) })),
  };
}

// Lee y valida las líneas; si un producto se repite, suma las cantidades.
function leerLineas(b) {
  if (!Array.isArray(b.items) || b.items.length === 0) throw validacion('La venta debe tener al menos un producto');
  if (b.items.length > MAX_LINEAS) throw validacion(`Una venta admite como máximo ${MAX_LINEAS} productos`);
  const pedidos = new Map();
  for (const item of b.items) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) throw validacion('Cada producto de la venta debe ser un objeto');
    const permitidos = ['id_producto', 'cantidad'];
    const extra = Object.keys(item).filter((k) => !permitidos.includes(k));
    // Los precios los pone el servidor: si el cliente envía uno, se rechaza en vez de ignorarlo en silencio.
    if (extra.length) throw validacion(`Campos no permitidos en un producto de la venta: ${extra.join(', ')}`);
    const id = entero(item.id_producto, 'id_producto', { min: 1 });
    const cantidad = entero(item.cantidad, 'La cantidad', { min: 1, max: MAX_UNIDADES });
    pedidos.set(id, (pedidos.get(id) || 0) + cantidad);
  }
  for (const cantidad of pedidos.values()) {
    if (cantidad > MAX_UNIDADES) throw validacion(`No se pueden vender más de ${MAX_UNIDADES} unidades de un mismo producto en una venta`);
  }
  return pedidos;
}

// Registra la venta completa en una sola transacción: si algo falla, no queda nada.
router.post('/', async (req, res) => {
  const b = cuerpo(req);
  const extra = Object.keys(b).filter((k) => k !== 'items');
  if (extra.length) throw validacion(`Campos no permitidos: ${extra.join(', ')}`);
  const pedidos = leerLineas(b);
  const ids = [...pedidos.keys()].sort((a, c) => a - c);

  const idVenta = await sequelize.transaction(async (t) => {
    // 1. La caja de hoy debe estar abierta. Se bloquea en modo compartido: varias ventas a la vez,
    //    pero el cierre de caja espera a que terminen.
    const { caja } = await cajaServicio.buscarHoy(t, 'compartido');
    if (!caja) throw reglaDeNegocio('Abre la caja del día antes de vender');
    if (caja.estado !== 'abierta') throw reglaDeNegocio('La caja de hoy está cerrada: no se pueden registrar ventas');

    // 2. Se bloquean los productos en orden de id (evita bloqueos cruzados entre ventas simultáneas)
    //    y se leen ya bloqueados, con las existencias y precios vigentes.
    const productos = await Producto.findAll({ where: { id_producto: ids }, order: [['id_producto', 'ASC']], lock: t.LOCK.UPDATE, transaction: t });
    const nombres = new Map(
      (
        await sequelize.query('SELECT id_producto, nombre FROM v_producto WHERE id_producto IN (:ids)', {
          replacements: { ids },
          type: QueryTypes.SELECT,
          transaction: t,
        })
      ).map((n) => [n.id_producto, n.nombre])
    );
    const porId = new Map(productos.map((p) => [p.id_producto, p]));

    // 3. Se validan todas las líneas y se informan todos los problemas juntos.
    const problemas = [];
    for (const id of ids) {
      const p = porId.get(id);
      const solicitado = pedidos.get(id);
      if (!p) problemas.push({ id_producto: id, motivo: 'El producto no existe' });
      else if (p.estado !== 'activo' || !(Number(p.precio_venta) > 0)) {
        problemas.push({ id_producto: id, nombre: nombres.get(id), motivo: 'No está disponible para la venta' });
      } else if (p.existencias < solicitado) {
        problemas.push({ id_producto: id, nombre: nombres.get(id), motivo: 'Existencias insuficientes', solicitado, disponible: p.existencias });
      }
    }
    if (problemas.length) {
      const unico = problemas.length === 1 ? `${problemas[0].nombre ? `${problemas[0].nombre}: ` : ''}${problemas[0].motivo}` : null;
      throw new ErrorApi(422, 'regla_de_negocio', unico || `No se pudo registrar la venta: ${problemas.length} productos con problemas`, problemas);
    }

    // 4. El total se calcula aquí con los precios de la base, en centavos para evitar errores de redondeo.
    let centavos = 0;
    for (const id of ids) centavos += Math.round(Number(porId.get(id).precio_venta) * 100) * pedidos.get(id);
    const total = centavos / 100;

    // 5. Venta, detalle con la copia del precio, salida de inventario e ingreso en caja.
    const venta = await Venta.create({ id_caja: caja.id_caja, id_usuario: req.usuario.id, total }, { transaction: t });
    for (const id of ids) {
      const p = porId.get(id);
      const cantidad = pedidos.get(id);
      const detalle = await DetalleVenta.create(
        { id_venta: venta.id_venta, id_producto: id, cantidad, precio_unitario: p.precio_venta },
        { transaction: t }
      );
      await MovimientoInventario.create(
        { id_producto: id, id_usuario: req.usuario.id, id_detalle: detalle.id_detalle, tipo: 'venta', cantidad: -cantidad, motivo: `Venta #${venta.id_venta}` },
        { transaction: t }
      );
    }
    await MovimientoCaja.create(
      { id_caja: caja.id_caja, id_usuario: req.usuario.id, id_venta: venta.id_venta, tipo: 'ingreso', concepto: `Venta #${venta.id_venta}`, valor: total },
      { transaction: t }
    );
    await auditar(t, req.usuario.id, 'venta', venta.id_venta, 'crear', {
      total,
      items: ids.map((id) => ({ id_producto: id, cantidad: pedidos.get(id), precio_unitario: Number(porId.get(id).precio_venta) })),
    });
    return venta.id_venta;
  });

  res.status(201).json({ venta: await obtenerVenta(idVenta) });
});

router.get('/', async (req, res) => {
  const { pagina, limite, desplazamiento } = paginacion(req.query, { limitePorDefecto: 30, limiteMax: 100 });
  const condiciones = [];
  const reemplazos = { limite, desplazamiento };
  const diaBogota = "CAST((v.fecha_hora AT TIME ZONE 'America/Bogota') AS date)";
  if (req.query.desde !== undefined) {
    reemplazos.desde = fecha(req.query.desde, 'desde');
    condiciones.push(`${diaBogota} >= :desde`);
  }
  if (req.query.hasta !== undefined) {
    reemplazos.hasta = fecha(req.query.hasta, 'hasta');
    condiciones.push(`${diaBogota} <= :hasta`);
  }
  if (req.query.caja !== undefined) {
    reemplazos.caja = entero(req.query.caja, 'caja', { min: 1 });
    condiciones.push('v.id_caja = :caja');
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = await sequelize.query(
    `SELECT v.id_venta, v.id_caja, v.fecha_hora, v.total, u.nombre AS usuario,
            (SELECT COALESCE(SUM(cantidad), 0)::int FROM detalle_venta WHERE id_venta = v.id_venta) AS unidades
       FROM venta v JOIN usuario u USING (id_usuario) ${donde}
      ORDER BY v.fecha_hora DESC, v.id_venta DESC LIMIT :limite OFFSET :desplazamiento`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  const [{ total, suma }] = await sequelize.query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(v.total), 0) AS suma FROM venta v ${donde}`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  res.json({
    pagina,
    limite,
    total,
    total_paginas: Math.ceil(total / limite),
    suma_total: Number(suma),
    ventas: filas.map((v) => ({ ...v, total: Number(v.total) })),
  });
});

router.get('/:id', async (req, res) => {
  const venta = await obtenerVenta(entero(req.params.id, 'id', { min: 1 }));
  if (!venta) throw noEncontrado('La venta no existe');
  res.json({ venta });
});

module.exports = router;
