const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, sequelize, preparar, conSesion, cerrar } = require('./ayudas');

let ctx;
let api;
let hoy;
let ids;

const producto = async (codigo, ml) => (await api.get(`/api/productos?q=${codigo}&presentacion=${ml}`)).body.productos[0];
const entrada = (id, cantidad) => api.post('/api/inventario/movimientos').send({ id_producto: id, tipo: 'entrada', cantidad });
const vender = (items) => api.post('/api/ventas').send({ items });
const diasAntes = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const moverVenta = (id, dias) => sequelize.query("UPDATE venta SET fecha_hora = fecha_hora - make_interval(days => :d) WHERE id_venta = :id", { replacements: { d: dias, id } });

// Datos de la prueba:
//   hoy:        venta 1 = 3 x A (20.000) + 1 x B (40.000)            -> 100.000
//   hace 2 días: venta 2 = 2 x A                                      ->  40.000
//   hace 40 días: venta 3 = 1 x C (40.000), fuera del rango por defecto
//   D y E tienen stock y no se venden; F no tiene stock.
before(async () => {
  ctx = await preparar();
  api = conSesion(ctx);
  const A = await producto('CAB-001', 30);
  const B = await producto('CAB-002', 60);
  const C = await producto('DAM-001', 60);
  const D = await producto('DAM-002', 30);
  const E = await producto('CAB-003', 30);
  const F = await producto('CAB-004', 60);
  ids = { A, B, C, D, E, F };
  for (const [p, n] of [[A, 50], [B, 50], [C, 50], [D, 10], [E, 7]]) await entrada(p.id_producto, n);

  await api.post('/api/caja/abrir').send({ saldo_apertura: 10000 });
  hoy = (await api.get('/api/caja/hoy')).body.fecha;
  const v1 = await vender([{ id_producto: A.id_producto, cantidad: 3 }, { id_producto: B.id_producto, cantidad: 1 }]);
  const v2 = await vender([{ id_producto: A.id_producto, cantidad: 2 }]);
  const v3 = await vender([{ id_producto: C.id_producto, cantidad: 1 }]);
  await moverVenta(v2.body.venta.id_venta, 2);
  await moverVenta(v3.body.venta.id_venta, 40);
});
after(cerrar);

test('más vendidos del periodo por defecto (30 días): ordenados por unidades, sin lo vendido fuera del rango', async () => {
  const r = await api.get('/api/reportes/mas-vendidos');
  assert.equal(r.status, 200);
  assert.equal(r.body.hasta, hoy);
  assert.equal(r.body.desde, diasAntes(hoy, 29));
  assert.equal(r.body.agrupar, 'producto');
  assert.deepEqual(r.body.ranking.map((x) => [x.posicion, x.id_producto, x.unidades_vendidas, x.ingresos]), [
    [1, ids.A.id_producto, 5, 100000],
    [2, ids.B.id_producto, 1, 40000],
  ]);
  assert.equal(r.body.ranking[0].existencias, 45);
});

test('un rango más amplio incluye la venta antigua y respeta el límite', async () => {
  const r = await api.get(`/api/reportes/mas-vendidos?desde=${diasAntes(hoy, 60)}&hasta=${hoy}`);
  assert.equal(r.body.ranking.length, 3);
  assert.equal(r.body.ranking[2].id_producto, ids.C.id_producto);
  const uno = await api.get(`/api/reportes/mas-vendidos?desde=${diasAntes(hoy, 60)}&limite=1`);
  assert.equal(uno.body.ranking.length, 1);
  const soloAyer = await api.get(`/api/reportes/mas-vendidos?desde=${diasAntes(hoy, 1)}&hasta=${diasAntes(hoy, 1)}`);
  assert.deepEqual(soloAyer.body.ranking, []);
});

test('filtra por presentación y por categoría', async () => {
  const sesenta = await api.get('/api/reportes/mas-vendidos?presentacion=60');
  assert.deepEqual(sesenta.body.ranking.map((x) => x.id_producto), [ids.B.id_producto]);
  const cats = (await api.get('/api/categorias')).body.categorias;
  const dama = cats.find((c) => c.nombre === 'Dama');
  const enDama = await api.get(`/api/reportes/mas-vendidos?categoria=${dama.id_categoria}&desde=${diasAntes(hoy, 60)}`);
  assert.deepEqual(enDama.body.ranking.map((x) => x.id_producto), [ids.C.id_producto]);
});

test('agrupado por fragancia suma todas sus presentaciones', async () => {
  const r = await api.get(`/api/reportes/mas-vendidos?agrupar=fragancia&desde=${diasAntes(hoy, 60)}`);
  assert.equal(r.body.agrupar, 'fragancia');
  assert.deepEqual(r.body.ranking.map((x) => [x.codigo, x.nombre, x.unidades_vendidas]), [
    ['CAB-001', 'ASAD LATTAFA', 5],
    ['CAB-002', '212 MEN NYC', 1],
    ['DAM-001', r.body.ranking[2].nombre, 1],
  ]);
});

test('menos vendidos: primero lo que tiene stock y no se vende, con sus existencias', async () => {
  const r = await api.get('/api/reportes/menos-vendidos?limite=10');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.ranking.map((x) => [x.id_producto, x.unidades_vendidas, x.existencias]), [
    [ids.C.id_producto, 0, 49],
    [ids.D.id_producto, 0, 10],
    [ids.E.id_producto, 0, 7],
    [ids.B.id_producto, 1, 49],
    [ids.A.id_producto, 5, 45],
  ]);
  assert.ok(!r.body.ranking.some((x) => x.id_producto === ids.F.id_producto), 'sin stock no entra');
});

test('menos vendidos: solo los que sí se vendieron, y no incluye borradores ni inactivos', async () => {
  const solo = await api.get('/api/reportes/menos-vendidos?solo_con_ventas=true');
  assert.deepEqual(solo.body.ranking.map((x) => x.id_producto), [ids.B.id_producto, ids.A.id_producto]);

  await api.post(`/api/productos/${ids.D.id_producto}/inactivar`);
  const sinD = await api.get('/api/reportes/menos-vendidos');
  assert.ok(!sinD.body.ranking.some((x) => x.id_producto === ids.D.id_producto));
  const borrador = await producto('CAB-001', 100);
  await api.post('/api/inventario/movimientos').send({ id_producto: borrador.id_producto, tipo: 'entrada', cantidad: 3 });
  const sinBorrador = await api.get('/api/reportes/menos-vendidos?limite=100');
  assert.ok(!sinBorrador.body.ranking.some((x) => x.id_producto === borrador.id_producto));
});

test('menos vendidos agrupado por fragancia', async () => {
  const r = await api.get('/api/reportes/menos-vendidos?agrupar=fragancia&limite=3');
  assert.equal(r.status, 200);
  // Con stock y sin ventas solo hay dos fragancias (DAM-002 está inactivo y no cuenta); la tercera ya vendió 1.
  assert.deepEqual(r.body.ranking.map((x) => [x.codigo, x.unidades_vendidas, x.existencias]), [
    ['DAM-001', 0, 49],
    ['CAB-003', 0, 7],
    ['CAB-002', 1, 49],
  ]);
});

test('un producto que se vendió y hoy está inactivo sigue figurando en lo más vendido', async () => {
  await api.post(`/api/productos/${ids.B.id_producto}/inactivar`);
  const r = await api.get('/api/reportes/mas-vendidos');
  assert.ok(r.body.ranking.some((x) => x.id_producto === ids.B.id_producto));
});

test('resumen de ventas: totales, ticket promedio y serie diaria con ceros', async () => {
  const r = await api.get('/api/reportes/ventas');
  assert.equal(r.status, 200);
  // Vendidos: A y B. Sin ventas: activos con stock que no vendieron (C y E; D y B están inactivos).
  assert.deepEqual(r.body.totales, { ventas: 2, unidades: 6, productos_vendidos: 2, productos_sin_ventas: 2, ingresos: 140000, ticket_promedio: 70000 });
  assert.equal(r.body.por_dia.length, 30);
  assert.equal(r.body.por_dia[0].fecha, diasAntes(hoy, 29));
  assert.equal(r.body.por_dia[29].fecha, hoy);
  const dia = (f) => r.body.por_dia.find((d) => d.fecha === f);
  assert.deepEqual(dia(hoy), { fecha: hoy, ventas: 1, unidades: 4, ingresos: 100000 });
  assert.deepEqual(dia(diasAntes(hoy, 2)), { fecha: diasAntes(hoy, 2), ventas: 1, unidades: 2, ingresos: 40000 });
  assert.deepEqual(dia(diasAntes(hoy, 1)), { fecha: diasAntes(hoy, 1), ventas: 0, unidades: 0, ingresos: 0 });
  assert.equal(r.body.por_dia.reduce((s, d) => s + d.ingresos, 0), 140000);
  assert.deepEqual(r.body.por_presentacion.map((p) => [p.presentacion_ml, p.unidades, p.ingresos]), [[30, 5, 100000], [60, 1, 40000]]);
  assert.equal(r.body.por_categoria[0].categoria, 'Caballero');
  assert.equal(r.body.por_categoria[0].ingresos, 140000);
});

test('resumen de ventas de un rango sin ventas devuelve ceros y no divide entre cero', async () => {
  const r = await api.get(`/api/reportes/ventas?desde=${diasAntes(hoy, 20)}&hasta=${diasAntes(hoy, 10)}`);
  // Sin ventas en el rango: todos los activos con stock (A, C y E) figuran como sin ventas.
  assert.deepEqual(r.body.totales, { ventas: 0, unidades: 0, productos_vendidos: 0, productos_sin_ventas: 3, ingresos: 0, ticket_promedio: 0 });
  assert.equal(r.body.por_dia.length, 11);
  assert.deepEqual(r.body.por_presentacion, []);
});

test('resumen de caja por día con la diferencia del cierre y totales', async () => {
  await sequelize.query(
    "INSERT INTO caja_diaria (id_usuario, fecha, saldo_apertura, saldo_cierre, estado, cerrada_en) VALUES (:u, CAST(:f AS date), 5000, 4800, 'cerrada', now())",
    { replacements: { u: ctx.admin.id_usuario, f: diasAntes(hoy, 3) } }
  );
  const r = await api.get('/api/reportes/caja');
  assert.equal(r.status, 200);
  assert.equal(r.body.cajas.length, 2);
  const [vieja, actual] = r.body.cajas;
  assert.equal(vieja.fecha, diasAntes(hoy, 3));
  assert.equal(vieja.estado, 'cerrada');
  assert.equal(vieja.diferencia, -200);
  assert.equal(actual.fecha, hoy);
  assert.equal(actual.estado, 'abierta');
  assert.equal(actual.diferencia, null);
  assert.equal(actual.ventas, 3);
  assert.equal(actual.ingresos_por_ventas, 180000);
  assert.equal(actual.saldo_esperado, 190000);
  assert.deepEqual(r.body.totales, {
    cajas: 2,
    ventas: 3,
    ingresos: 180000,
    ingresos_por_ventas: 180000,
    egresos: 0,
    diferencia: -200,
    cajas_sin_cerrar: 1,
  });
  assert.equal((await api.get(`/api/reportes/caja?desde=${diasAntes(hoy, 1)}&hasta=${diasAntes(hoy, 1)}`)).body.cajas.length, 0);
});

test('valida el rango y los parámetros de los reportes', async () => {
  const rutas = ['mas-vendidos', 'menos-vendidos', 'ventas', 'caja'];
  for (const ruta of rutas) {
    assert.equal((await api.get(`/api/reportes/${ruta}?desde=${hoy}&hasta=${diasAntes(hoy, 1)}`)).status, 400, `${ruta} invertido`);
    assert.equal((await api.get(`/api/reportes/${ruta}?desde=${diasAntes(hoy, 400)}&hasta=${hoy}`)).status, 400, `${ruta} muy largo`);
    assert.equal((await api.get(`/api/reportes/${ruta}?desde=ayer`)).status, 400, `${ruta} formato`);
    assert.equal((await api.get(`/api/reportes/${ruta}?hasta=2026-02-30`)).status, 400, `${ruta} fecha inexistente`);
    assert.equal((await request(ctx.app).get(`/api/reportes/${ruta}`)).status, 401, `${ruta} sin sesión`);
  }
  assert.equal((await api.get('/api/reportes/mas-vendidos?limite=0')).status, 400);
  assert.equal((await api.get('/api/reportes/mas-vendidos?limite=101')).status, 400);
  assert.equal((await api.get('/api/reportes/mas-vendidos?agrupar=color')).status, 400);
  assert.equal((await api.get('/api/reportes/mas-vendidos?presentacion=45')).status, 400);
  assert.equal((await api.get('/api/reportes/menos-vendidos?solo_con_ventas=quizas')).status, 400);
  assert.equal((await api.get("/api/reportes/mas-vendidos?categoria=1;DROP TABLE venta")).status, 400);
  const [[{ n }]] = await sequelize.query('SELECT COUNT(*)::int AS n FROM venta');
  assert.equal(n, 3);
});
