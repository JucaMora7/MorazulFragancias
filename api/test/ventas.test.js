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

const producto = async (codigo, ml) => (await api.get(`/api/productos?q=${codigo}&presentacion=${ml}`)).body.productos[0];
const entrada = (id, cantidad) => api.post('/api/inventario/movimientos').send({ id_producto: id, tipo: 'entrada', cantidad });
const vender = (items) => api.post('/api/ventas').send({ items });
const estadoDe = async () => {
  const [[x]] = await sequelize.query(
    'SELECT (SELECT COUNT(*) FROM venta)::int AS ventas, (SELECT COUNT(*) FROM detalle_venta)::int AS detalles, (SELECT COUNT(*) FROM movimiento_inventario)::int AS movimientos, (SELECT COUNT(*) FROM movimiento_caja)::int AS movs_caja, (SELECT COALESCE(SUM(existencias),0) FROM producto)::int AS unidades'
  );
  return x;
};

test('sin caja abierta no se puede vender', async () => {
  const p = await producto('CAB-001', 30);
  await entrada(p.id_producto, 10);
  const r = await vender([{ id_producto: p.id_producto, cantidad: 1 }]);
  assert.equal(r.status, 422);
  assert.match(r.body.error.mensaje, /Abre la caja/);
});

test('registra una venta: total con precios de la base, salida de inventario, ingreso en caja y auditoría', async () => {
  await api.post('/api/caja/abrir').send({ saldo_apertura: 20000 });
  const a = await producto('CAB-001', 30);
  const b = await producto('CAB-002', 60);
  await entrada(b.id_producto, 5);

  const r = await vender([
    { id_producto: a.id_producto, cantidad: 2 },
    { id_producto: b.id_producto, cantidad: 1 },
  ]);
  assert.equal(r.status, 201);
  const v = r.body.venta;
  assert.equal(v.total, 2 * 20000 + 40000);
  assert.equal(v.usuario, 'Administrador de prueba');
  assert.deepEqual(v.items.map((i) => [i.id_producto, i.cantidad, i.precio_unitario, i.subtotal]), [
    [a.id_producto, 2, 20000, 40000],
    [b.id_producto, 1, 40000, 40000],
  ]);

  assert.equal((await producto('CAB-001', 30)).existencias, 8);
  assert.equal((await producto('CAB-002', 60)).existencias, 4);

  const caja = await api.get('/api/caja/hoy');
  assert.equal(caja.body.caja.ingresos, 80000);
  assert.equal(caja.body.caja.saldo_esperado, 100000);
  assert.ok(caja.body.movimientos.some((m) => m.id_venta === v.id_venta && m.valor === 80000 && m.productos === 2));
  assert.equal(caja.body.movimientos.find((m) => m.id_venta === null)?.productos ?? 0, 0);

  const libro = await api.get(`/api/inventario/movimientos?tipo=venta&producto=${a.id_producto}`);
  assert.equal(libro.body.movimientos[0].cantidad, -2);
  assert.equal(libro.body.movimientos[0].motivo, `Venta #${v.id_venta}`);

  const [[aud]] = await sequelize.query("SELECT detalle, id_usuario FROM auditoria WHERE entidad = 'venta' AND id_registro = :id", { replacements: { id: v.id_venta } });
  assert.equal(aud.detalle.total, 80000);
  assert.equal(aud.id_usuario, ctx.admin.id_usuario);
});

test('si se repite un producto, las cantidades se suman en un solo renglón', async () => {
  const p = await producto('CAB-001', 30);
  const r = await vender([
    { id_producto: p.id_producto, cantidad: 1 },
    { id_producto: p.id_producto, cantidad: 2 },
  ]);
  assert.equal(r.status, 201);
  assert.equal(r.body.venta.items.length, 1);
  assert.equal(r.body.venta.items[0].cantidad, 3);
  assert.equal(r.body.venta.total, 60000);
});

test('el precio lo pone el servidor: un precio enviado por el cliente se rechaza', async () => {
  const p = await producto('CAB-001', 30);
  const antes = await estadoDe();
  const r = await vender([{ id_producto: p.id_producto, cantidad: 1, precio_unitario: 1 }]);
  assert.equal(r.status, 400);
  const total = await api.post('/api/ventas').send({ items: [{ id_producto: p.id_producto, cantidad: 1 }], total: 1 });
  assert.equal(total.status, 400);
  assert.deepEqual(await estadoDe(), antes);
});

test('stock insuficiente: informa cuánto hay y no registra nada', async () => {
  const p = await producto('CAB-001', 30);
  const antes = await estadoDe();
  const r = await vender([{ id_producto: p.id_producto, cantidad: 999 }]);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.detalles[0].solicitado, 999);
  assert.equal(r.body.error.detalles[0].disponible, 5);
  assert.deepEqual(await estadoDe(), antes);
});

test('es atómica: si una línea falla, no queda ni la venta ni las otras líneas', async () => {
  const bueno = await producto('CAB-002', 60);
  const sinStock = await producto('CAB-003', 60);
  const antes = await estadoDe();
  const r = await vender([
    { id_producto: bueno.id_producto, cantidad: 1 },
    { id_producto: sinStock.id_producto, cantidad: 1 },
    { id_producto: 99999, cantidad: 1 },
  ]);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.detalles.length, 2);
  assert.deepEqual(await estadoDe(), antes);
  assert.equal((await producto('CAB-002', 60)).existencias, 4);
});

test('no se venden productos en borrador, inactivos ni sin precio', async () => {
  const borrador = await producto('CAB-001', 100);
  await entrada(borrador.id_producto, 5);
  const r = await vender([{ id_producto: borrador.id_producto, cantidad: 1 }]);
  assert.equal(r.status, 422);
  assert.match(r.body.error.mensaje, /no está disponible/i);

  const p = await producto('CAB-004', 30);
  await entrada(p.id_producto, 3);
  await api.post(`/api/productos/${p.id_producto}/inactivar`);
  assert.equal((await vender([{ id_producto: p.id_producto, cantidad: 1 }])).status, 422);
});

test('la base también rechaza vender un producto en borrador aunque se salte la API', async () => {
  const borrador = await producto('CAB-001', 100);
  const [[v]] = await sequelize.query('SELECT id_venta FROM venta LIMIT 1');
  await assert.rejects(
    sequelize.query('INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario) VALUES (:v, :p, 1, 1000)', {
      replacements: { v: v.id_venta, p: borrador.id_producto },
    })
  );
});

test('valida la forma de la venta', async () => {
  const p = await producto('CAB-001', 30);
  const casos = [
    [],
    [{ id_producto: p.id_producto, cantidad: 0 }],
    [{ id_producto: p.id_producto, cantidad: -1 }],
    [{ id_producto: p.id_producto, cantidad: 1.5 }],
    [{ id_producto: p.id_producto, cantidad: 'dos' }],
    [{ id_producto: p.id_producto, cantidad: 100000 }],
    [{ id_producto: 'x', cantidad: 1 }],
    [{ cantidad: 1 }],
    ['texto'],
    [null],
  ];
  for (const items of casos) assert.equal((await vender(items)).status, 400, JSON.stringify(items));
  assert.equal((await api.post('/api/ventas').send({})).status, 400);
  assert.equal((await api.post('/api/ventas').send({ items: 'no' })).status, 400);
  assert.equal((await vender(Array.from({ length: 51 }, (_, i) => ({ id_producto: i + 1, cantidad: 1 })))).status, 400);
  assert.equal((await request(ctx.app).post('/api/ventas').send({ items: [{ id_producto: p.id_producto, cantidad: 1 }] })).status, 401);
});

test('dos ventas simultáneas por la última unidad: una se registra y la otra se rechaza', async () => {
  const p = await producto('CAB-005', 60);
  await entrada(p.id_producto, 1);
  const respuestas = await Promise.all(Array.from({ length: 4 }, () => vender([{ id_producto: p.id_producto, cantidad: 1 }])));
  const estados = respuestas.map((r) => r.status).sort();
  assert.deepEqual(estados, [201, 422, 422, 422]);
  assert.equal((await producto('CAB-005', 60)).existencias, 0);
  const [[{ vendidas }]] = await sequelize.query('SELECT COALESCE(SUM(cantidad),0)::int AS vendidas FROM detalle_venta WHERE id_producto = :id', { replacements: { id: p.id_producto } });
  assert.equal(vendidas, 1);
});

test('ventas simultáneas con los mismos productos en distinto orden no se bloquean entre sí', async () => {
  const a = await producto('CAB-006', 30);
  const b = await producto('CAB-007', 30);
  await entrada(a.id_producto, 20);
  await entrada(b.id_producto, 20);
  const tandas = [];
  for (let i = 0; i < 6; i++) {
    const items = [{ id_producto: a.id_producto, cantidad: 1 }, { id_producto: b.id_producto, cantidad: 1 }];
    tandas.push(vender(i % 2 ? items : [...items].reverse()));
  }
  const respuestas = await Promise.all(tandas);
  assert.ok(respuestas.every((r) => r.status === 201), respuestas.map((r) => r.status).join(','));
  assert.equal((await producto('CAB-006', 30)).existencias, 14);
  assert.equal((await producto('CAB-007', 30)).existencias, 14);
});

test('un cambio de precio no altera las ventas ya hechas', async () => {
  const p = await producto('CAB-006', 30);
  const venta = await vender([{ id_producto: p.id_producto, cantidad: 1 }]);
  await api.patch(`/api/productos/${p.id_producto}`).send({ precio_venta: 25000 });
  const detalle = await api.get(`/api/ventas/${venta.body.venta.id_venta}`);
  assert.equal(detalle.body.venta.items[0].precio_unitario, 20000);
  assert.equal(detalle.body.venta.total, 20000);
  const nueva = await vender([{ id_producto: p.id_producto, cantidad: 1 }]);
  assert.equal(nueva.body.venta.total, 25000);
});

test('consulta ventas por fecha y caja, con el total vendido', async () => {
  const todas = await api.get('/api/ventas?limite=100');
  assert.equal(todas.status, 200);
  assert.ok(todas.body.total >= 4);
  const suma = todas.body.ventas.reduce((s, v) => s + v.total, 0);
  assert.equal(todas.body.suma_total, suma);
  assert.ok(todas.body.ventas.every((v) => v.unidades >= 1));

  const hoy = (await api.get('/api/caja/hoy')).body.fecha;
  assert.equal((await api.get(`/api/ventas?desde=${hoy}&hasta=${hoy}`)).body.total, todas.body.total);
  assert.equal((await api.get('/api/ventas?desde=2020-01-01&hasta=2020-01-31')).body.total, 0);
  assert.equal((await api.get('/api/ventas/99999')).status, 404);
  assert.equal((await api.get('/api/ventas/abc')).status, 400);
});

test('con la caja cerrada ya no se puede vender, y el cierre cuadra con las ventas', async () => {
  const antes = (await api.get('/api/caja/hoy')).body.caja;
  const cierre = await api.post('/api/caja/hoy/cerrar').send({ saldo_cierre: antes.saldo_esperado });
  assert.equal(cierre.body.diferencia, 0);
  const p = await producto('CAB-006', 30);
  const r = await vender([{ id_producto: p.id_producto, cantidad: 1 }]);
  assert.equal(r.status, 422);
  assert.match(r.body.error.mensaje, /cerrada/i);
});

test('el cierre de caja espera a las ventas en curso: ninguna venta queda fuera del saldo', async () => {
  // La caja cerrada pasa a ayer y se abre una nueva hoy para probar la concurrencia.
  await sequelize.query("UPDATE caja_diaria SET fecha = fecha - 1");
  const abrir = await api.post('/api/caja/abrir').send({ saldo_apertura: 0 });
  assert.equal(abrir.status, 201);
  const p = await producto('CAB-007', 30);
  const ventas = Array.from({ length: 5 }, () => vender([{ id_producto: p.id_producto, cantidad: 1 }]));
  const cierre = api.post('/api/caja/hoy/cerrar').send({ saldo_cierre: 0 });
  const respuestas = await Promise.all([...ventas, cierre]);
  const exitosas = respuestas.slice(0, 5).filter((r) => r.status === 201).length;
  const hoy = await api.get('/api/caja/hoy');
  assert.equal(hoy.body.caja.estado, 'cerrada');
  assert.equal(hoy.body.caja.ingresos, exitosas * 20000, 'el ingreso de la caja coincide con las ventas aceptadas');
  const [[{ total }]] = await sequelize.query('SELECT COALESCE(SUM(total),0)::int AS total FROM venta WHERE id_caja = :c', { replacements: { c: hoy.body.caja.id_caja } });
  assert.equal(total, exitosas * 20000);
});
