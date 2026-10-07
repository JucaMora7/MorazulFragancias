const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, sequelize, preparar, conSesion, cerrar } = require('./ayudas');

let ctx;
let api;

before(async () => {
  ctx = await preparar();
  api = conSesion(ctx);
});
after(cerrar);

const producto = async (codigo) => (await api.get(`/api/productos?q=${codigo}`)).body.productos[0];
const mover = (id, datos) => api.post('/api/inventario/movimientos').send({ id_producto: id, ...datos });
const crearFragancia = async (nombre) => {
  const caballero = (await api.get('/api/categorias')).body.categorias.find((c) => c.nombre === 'Caballero');
  const r = await api.post('/api/fragancias').send({ nombre, id_categoria: caballero.id_categoria });
  assert.equal(r.status, 201);
  return r.body.fragancia;
};

test('una entrada suma existencias y deja el movimiento en el libro con quién lo hizo', async () => {
  const p = await producto('CAB-001');
  const r = await mover(p.id_producto, { tipo: 'entrada', cantidad: 10, motivo: 'Compra al proveedor' });
  assert.equal(r.status, 201);
  assert.equal(r.body.movimiento.cantidad, 10);
  assert.equal(r.body.movimiento.existencias_resultantes, 10);
  assert.equal(r.body.producto.existencias, 10);
  assert.equal((await producto('CAB-001')).existencias, 10);

  const libro = await api.get(`/api/inventario/movimientos?producto=${p.id_producto}`);
  assert.equal(libro.body.total, 1);
  assert.equal(libro.body.movimientos[0].usuario, 'Administrador de prueba');
  assert.equal(libro.body.movimientos[0].tipo, 'entrada');
});

test('el motivo es opcional en entradas y obligatorio en ajustes', async () => {
  const p = await producto('CAB-001');
  assert.equal((await mover(p.id_producto, { tipo: 'entrada', cantidad: 1 })).status, 201);
  const sinMotivo = await mover(p.id_producto, { tipo: 'ajuste', cantidad: -1 });
  assert.equal(sinMotivo.status, 400);
  const conMotivo = await mover(p.id_producto, { tipo: 'ajuste', cantidad: -1, motivo: 'Frasco roto' });
  assert.equal(conMotivo.status, 201);
  assert.equal(conMotivo.body.producto.existencias, 10);
});

test('no deja las existencias en negativo y no cambia nada al rechazar', async () => {
  const p = await producto('CAB-001');
  const r = await mover(p.id_producto, { tipo: 'ajuste', cantidad: -11, motivo: 'Conteo' });
  assert.equal(r.status, 422);
  assert.match(r.body.error.mensaje, /insuficientes/i);
  assert.equal((await producto('CAB-001')).existencias, 10);
});

test('valida tipo, cantidad y campos de un movimiento', async () => {
  const p = await producto('CAB-001');
  assert.equal((await mover(p.id_producto, { tipo: 'venta', cantidad: -1, motivo: 'x' })).status, 400);
  assert.equal((await mover(p.id_producto, { tipo: 'entrada', cantidad: 0 })).status, 400);
  assert.equal((await mover(p.id_producto, { tipo: 'entrada', cantidad: -3 })).status, 400);
  assert.equal((await mover(p.id_producto, { tipo: 'entrada', cantidad: 1.5 })).status, 400);
  assert.equal((await mover(p.id_producto, { tipo: 'entrada', cantidad: 'muchas' })).status, 400);
  assert.equal((await mover(p.id_producto, { tipo: 'entrada', cantidad: 1, existencias_resultantes: 999 })).status, 400);
  assert.equal((await mover(99999, { tipo: 'entrada', cantidad: 1 })).status, 404);
  assert.equal((await request(ctx.app).post('/api/inventario/movimientos').send({ id_producto: p.id_producto, tipo: 'entrada', cantidad: 1 })).status, 401);
});

test('no se mueve el inventario de un producto inactivo, pero sí el de uno en borrador', async () => {
  const f = await crearFragancia('prueba en borrador');
  const borrador = f.presentaciones[0];
  assert.equal(borrador.estado, 'borrador');
  assert.equal((await mover(borrador.id_producto, { tipo: 'entrada', cantidad: 4 })).status, 201);

  const p = await producto('CAB-002');
  await api.post(`/api/productos/${p.id_producto}/inactivar`);
  const r = await mover(p.id_producto, { tipo: 'entrada', cantidad: 5 });
  assert.equal(r.status, 422);
});

test('la alerta de stock crítico se crea al llegar al umbral y se resuelve al reponer', async () => {
  const p = await producto('CAB-003');
  await api.patch(`/api/productos/${p.id_producto}`).send({ umbral_minimo: 3 });
  await mover(p.id_producto, { tipo: 'entrada', cantidad: 10 });
  assert.equal((await api.get('/api/alertas?estado=activa')).body.alertas.filter((a) => a.id_producto === p.id_producto).length, 0);

  const baja = await mover(p.id_producto, { tipo: 'ajuste', cantidad: -7, motivo: 'Venta fuera del sistema' });
  assert.equal(baja.body.alerta_activa, true);
  let activas = (await api.get('/api/alertas?estado=activa')).body.alertas.filter((a) => a.id_producto === p.id_producto);
  assert.equal(activas.length, 1);
  assert.equal(activas[0].existencias_al_generar, 3);
  assert.equal(activas[0].umbral_al_generar, 3);

  await mover(p.id_producto, { tipo: 'ajuste', cantidad: -1, motivo: 'Otro ajuste' });
  activas = (await api.get('/api/alertas?estado=activa')).body.alertas.filter((a) => a.id_producto === p.id_producto);
  assert.equal(activas.length, 1, 'no se duplica la alerta');

  const repone = await mover(p.id_producto, { tipo: 'entrada', cantidad: 20 });
  assert.equal(repone.body.alerta_activa, false);
  // Fijar el umbral con 0 unidades ya había generado una alerta, que se resolvió con la primera entrada.
  const resueltas = (await api.get('/api/alertas?estado=resuelta')).body.alertas.filter((a) => a.id_producto === p.id_producto);
  assert.equal(resueltas.length, 2);
  assert.ok(resueltas.every((a) => a.resuelta_en));
  assert.equal((await api.get('/api/alertas?estado=rara')).status, 400);
});

test('filtros y estado de stock: Normal, Crítico, Agotado, Inactivo y Borrador', async () => {
  const critico = await producto('CAB-004');
  await api.patch(`/api/productos/${critico.id_producto}`).send({ umbral_minimo: 5 });
  await mover(critico.id_producto, { tipo: 'entrada', cantidad: 4 });
  const normal = await producto('CAB-005');
  await mover(normal.id_producto, { tipo: 'entrada', cantidad: 8 });

  assert.equal((await producto('CAB-004')).estado_stock, 'Crítico');
  assert.equal((await producto('CAB-005')).estado_stock, 'Normal');
  assert.equal((await producto('CAB-006')).estado_stock, 'Agotado');
  assert.equal((await producto('CAB-002')).estado_stock, 'Inactivo');
  assert.equal((await producto('CAB-049')).estado_stock, 'Borrador');

  const criticos = await api.get('/api/productos?stock=critico&limite=200');
  assert.ok(criticos.body.productos.some((p) => p.id_producto === critico.id_producto));
  assert.ok(criticos.body.productos.every((p) => p.estado_stock === 'Crítico'));
  const agotados = await api.get('/api/productos?stock=agotado&limite=200');
  assert.ok(agotados.body.productos.every((p) => p.estado_stock === 'Agotado'));
  assert.equal((await api.get('/api/productos?stock=raro')).status, 400);

  // con_stock: solo activos con existencias (lo que se puede vender).
  const conStock = await api.get('/api/productos?con_stock=true&limite=200');
  assert.ok(conStock.body.total >= 2);
  assert.ok(conStock.body.productos.every((p) => p.estado === 'activo' && p.existencias > 0));
  assert.ok(!conStock.body.productos.some((p) => p.id_producto === (agotados.body.productos[0] || {}).id_producto));
  assert.equal((await api.get('/api/productos?con_stock=quizas')).status, 400);
});

test('el resumen cuenta productos activos, críticos, agotados, borradores e inactivos', async () => {
  const r = await api.get('/api/inventario/resumen');
  assert.equal(r.status, 200);
  const x = r.body.resumen;
  assert.equal(x.inactivos, 1);
  assert.equal(x.borradores, 1);
  assert.equal(x.activos + x.borradores + x.inactivos, 126);
  assert.ok(x.criticos >= 1);
  assert.ok(x.agotados >= 1);
  assert.ok(x.unidades_en_stock > 0);
  assert.ok(x.alertas_activas >= 1);
});

test('el libro de movimientos se filtra por tipo y fechas', async () => {
  const entradas = await api.get('/api/inventario/movimientos?tipo=entrada&limite=200');
  assert.ok(entradas.body.movimientos.every((m) => m.tipo === 'entrada'));
  const hoy = new Date().toISOString().slice(0, 10);
  assert.equal((await api.get(`/api/inventario/movimientos?desde=${hoy}`)).status, 200);
  assert.equal((await api.get('/api/inventario/movimientos?desde=2020-01-01&hasta=2020-01-02')).body.total, 0);
  assert.equal((await api.get('/api/inventario/movimientos?desde=ayer')).status, 400);
  assert.equal((await api.get('/api/inventario/movimientos?desde=2026-02-30')).status, 400);
  assert.equal((await api.get('/api/inventario/movimientos?tipo=otro')).status, 400);
});

test('el libro no se puede alterar desde la base: ni editar ni borrar movimientos', async () => {
  await assert.rejects(sequelize.query('UPDATE movimiento_inventario SET cantidad = 99'));
  await assert.rejects(sequelize.query('DELETE FROM movimiento_inventario'));
});

test('poner el precio de un producto en borrador y publicarlo en un solo paso; si falla, no se guarda el precio', async () => {
  const p = await producto('CAB-049');
  const ok = await api.patch(`/api/productos/${p.id_producto}`).send({ precio_venta: 25000, publicar: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.producto.precio_venta, 25000);
  assert.equal(ok.body.producto.estado, 'activo');
  assert.equal(ok.body.producto.visible_landing, true);

  const otra = await crearFragancia('otra prueba en borrador');
  await sequelize.query('UPDATE fragancia SET activa = FALSE WHERE codigo = :codigo', { replacements: { codigo: otra.codigo } });
  const falla = await api.patch(`/api/productos/${otra.presentaciones[0].id_producto}`).send({ precio_venta: 30000, publicar: true });
  assert.equal(falla.status, 422);
  assert.equal((await producto(otra.codigo)).precio_venta, 20000);
  assert.equal((await api.patch(`/api/productos/${p.id_producto}`).send({ publicar: true, activar: true })).status, 400);
});
