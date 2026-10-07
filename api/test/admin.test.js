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
const publico = (codigo) => request(ctx.app).get(`/api/publico/catalogo/${codigo}`);
const categoria = async (nombre) => (await api.get('/api/categorias')).body.categorias.find((c) => c.nombre === nombre);

// Crea una fragancia nueva: su producto de 30 ml nace en borrador con el precio inicial.
const crearFragancia = async (nombre, extra = {}) => {
  const caballero = await categoria('Caballero');
  const r = await api.post('/api/fragancias').send({ nombre, id_categoria: caballero.id_categoria, ...extra });
  assert.equal(r.status, 201);
  return r.body.fragancia;
};

test('lista categorías y fragancias con su producto de 30 ml', async () => {
  const cats = await api.get('/api/categorias');
  assert.equal(cats.body.categorias.length, 7);

  const r = await api.get('/api/fragancias?q=CAB-001');
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 1);
  const f = r.body.fragancias[0];
  assert.equal(f.presentaciones.length, 1);
  assert.equal(f.presentaciones[0].presentacion_ml, 30);
  assert.equal(f.presentaciones[0].estado, 'activo');
  assert.equal(f.presentaciones[0].precio_venta, 20000);
});

test('publicar un producto sin precio falla con un mensaje claro y no cambia nada', async () => {
  const f = await crearFragancia('prueba sin precio');
  const p = f.presentaciones[0];
  assert.equal(p.estado, 'borrador');
  assert.equal(p.precio_venta, 20000);
  // El administrador puede quitarle el precio mientras está en borrador.
  const sinPrecio = await api.patch(`/api/productos/${p.id_producto}`).send({ precio_venta: null });
  assert.equal(sinPrecio.status, 200);
  assert.equal(sinPrecio.body.producto.precio_venta, null);

  for (const accion of ['publicar', 'activar']) {
    const r = await api.post(`/api/productos/${p.id_producto}/${accion}`);
    assert.equal(r.status, 422);
    assert.equal(r.body.error.codigo, 'regla_de_negocio');
    assert.match(r.body.error.mensaje, /precio/i);
  }
  const despues = await producto(f.codigo);
  assert.equal(despues.estado, 'borrador');
  assert.equal(despues.visible_landing, false);
});

test('fijar el precio y publicar deja el producto visible en la landing con su imagen genérica', async () => {
  const p = await producto('CAB-049');
  const pub = await api.patch(`/api/productos/${p.id_producto}`).send({ precio_venta: 25000, publicar: true });
  assert.equal(pub.status, 200);
  assert.equal(pub.body.producto.precio_venta, 25000);
  assert.equal(pub.body.producto.estado, 'activo');
  assert.equal(pub.body.producto.visible_landing, true);

  const detalle = await publico('CAB-049');
  assert.equal(detalle.status, 200);
  assert.equal(detalle.body.fragancia.presentaciones[0].precio, 25000);
  assert.match(detalle.body.fragancia.presentaciones[0].imagen_url, /generica-30ml\.webp$/);
});

test('despublicar la saca de la landing sin inactivarla; inactivar la saca de todo', async () => {
  const p = await producto('CAB-001');
  const desp = await api.post(`/api/productos/${p.id_producto}/despublicar`);
  assert.equal(desp.body.producto.estado, 'activo');
  assert.equal(desp.body.producto.visible_landing, false);
  assert.equal((await publico('CAB-001')).status, 404);

  await api.post(`/api/productos/${p.id_producto}/publicar`);
  assert.equal((await publico('CAB-001')).status, 200);
  const ina = await api.post(`/api/productos/${p.id_producto}/inactivar`);
  assert.equal(ina.body.producto.estado, 'inactivo');
  assert.equal(ina.body.producto.visible_landing, false);
  assert.equal((await publico('CAB-001')).status, 404);
});

test('un producto activo no puede quedar sin precio ni con precio inválido', async () => {
  const p = await producto('CAB-002');
  assert.equal((await api.patch(`/api/productos/${p.id_producto}`).send({ precio_venta: null })).status, 422);
  for (const malo of [0, -5, 'abc', 10.123, 1e12]) {
    const r = await api.patch(`/api/productos/${p.id_producto}`).send({ precio_venta: malo });
    assert.equal(r.status, 400, `precio ${malo}`);
  }
  assert.equal((await producto('CAB-002')).precio_venta, 20000);
});

test('edita el umbral de stock crítico y rechaza campos que no se pueden cambiar', async () => {
  const p = await producto('CAB-002');
  const ok = await api.patch(`/api/productos/${p.id_producto}`).send({ umbral_minimo: 5 });
  assert.equal(ok.body.producto.umbral_minimo, 5);
  assert.equal((await api.patch(`/api/productos/${p.id_producto}`).send({ umbral_minimo: -1 })).status, 400);
  assert.equal((await api.patch(`/api/productos/${p.id_producto}`).send({ existencias: 999 })).status, 400);
  assert.equal((await api.patch(`/api/productos/${p.id_producto}`).send({ estado: 'activo' })).status, 400);
  assert.equal((await api.patch(`/api/productos/${p.id_producto}`).send({})).status, 400);
  assert.equal((await producto('CAB-002')).existencias, 0);
});

test('productos: filtros y errores de entrada', async () => {
  const activos = await api.get('/api/productos?estado=activo&limite=200');
  assert.ok(activos.body.total >= 124);
  assert.ok(activos.body.productos.every((p) => p.estado === 'activo' && p.presentacion_ml === 30));
  const borradores = await api.get('/api/productos?estado=borrador');
  assert.equal(borradores.body.total, 0);
  assert.equal((await api.get('/api/productos?estado=raro')).status, 400);
  assert.equal((await api.get('/api/productos/99999')).status, 404);
  assert.equal((await api.get('/api/productos/abc')).status, 400);
  assert.equal((await api.post('/api/productos/99999/publicar')).status, 404);
});

test('crea una fragancia con código automático y un solo producto de 30 ml en borrador', async () => {
  const f = await crearFragancia('nueva fragancia de prueba', { inspirada_en: 'marca de ejemplo', es_arabe: true });
  assert.equal(f.codigo, 'CAB-050');
  assert.equal(f.nombre, 'NUEVA FRAGANCIA DE PRUEBA');
  assert.equal(f.inspirada_en, 'MARCA DE EJEMPLO');
  assert.equal(f.activa, true);
  assert.deepEqual(f.presentaciones.map((p) => [p.presentacion_ml, p.precio_venta, p.estado, p.visible_landing]), [[30, 20000, 'borrador', false]]);
  assert.equal((await publico('CAB-050')).status, 404);
});

test('crear: valida datos, rechaza duplicados y categorías inexistentes', async () => {
  const id = (await api.get('/api/categorias')).body.categorias[0].id_categoria;
  assert.equal((await api.post('/api/fragancias').send({ id_categoria: id })).status, 400);
  assert.equal((await api.post('/api/fragancias').send({ nombre: 'X' })).status, 400);
  assert.equal((await api.post('/api/fragancias').send({ nombre: 'Y', id_categoria: id, color_caja: 'rojo' })).status, 400);
  assert.equal((await api.post('/api/fragancias').send({ nombre: 'Y', id_categoria: id, codigo: 'mal' })).status, 400);
  assert.equal((await api.post('/api/fragancias').send({ nombre: 'Y', id_categoria: id, extra: 1 })).status, 400);
  assert.equal((await api.post('/api/fragancias').send({ nombre: 'Y', id_categoria: 9999 })).status, 422);
  const dup = await api.post('/api/fragancias').send({ nombre: 'asad lattafa', id_categoria: id });
  assert.equal(dup.status, 409);
});

test('edita una fragancia y registra el cambio en auditoría', async () => {
  const lista = await api.get('/api/fragancias?q=CAB-002');
  const id = lista.body.fragancias[0].id_fragancia;
  const r = await api.patch(`/api/fragancias/${id}`).send({ nota: 'Revisar con la dueña', es_arabe: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.fragancia.nota, 'Revisar con la dueña');
  assert.equal(r.body.fragancia.es_arabe, true);
  const [[a]] = await sequelize.query(`SELECT accion, id_usuario, detalle FROM auditoria WHERE entidad = 'fragancia' AND id_registro = ${id} ORDER BY id_auditoria DESC LIMIT 1`);
  assert.equal(a.accion, 'editar');
  assert.equal(a.id_usuario, ctx.admin.id_usuario);
  assert.equal(a.detalle.despues.nota, 'Revisar con la dueña');
});

test('inactivar una fragancia la saca del catálogo y reactivar devuelve su producto a borrador', async () => {
  const lista = await api.get('/api/fragancias?q=CAB-003');
  const f = lista.body.fragancias[0];
  const ina = await api.post(`/api/fragancias/${f.id_fragancia}/inactivar`);
  assert.equal(ina.body.fragancia.activa, false);
  assert.ok(ina.body.fragancia.presentaciones.every((p) => p.estado === 'inactivo' && p.visible_landing === false));
  assert.equal((await publico('CAB-003')).status, 404);

  const pub = await api.post(`/api/productos/${f.presentaciones[0].id_producto}/publicar`);
  assert.equal(pub.status, 422);

  const rea = await api.post(`/api/fragancias/${f.id_fragancia}/reactivar`);
  assert.equal(rea.body.fragancia.activa, true);
  assert.ok(rea.body.fragancia.presentaciones.every((p) => p.estado === 'borrador'));
  const pub2 = await api.post(`/api/productos/${f.presentaciones[0].id_producto}/publicar`);
  assert.equal(pub2.status, 200);
});

test('el interruptor "inspirada en" controla lo que muestra la landing', async () => {
  const antes = await publico('CAB-004');
  assert.equal(antes.body.fragancia.inspirada_en, null);

  const on = await api.put('/api/configuracion/mostrar_inspirada_en').send({ valor: true });
  assert.equal(on.status, 200);
  const despues = await publico('CAB-004');
  assert.ok(despues.body.fragancia.inspirada_en);

  await api.put('/api/configuracion/mostrar_inspirada_en').send({ valor: false });
  assert.equal((await publico('CAB-004')).body.fragancia.inspirada_en, null);
  assert.equal((await api.put('/api/configuracion/mostrar_inspirada_en').send({ valor: 'tal vez' })).status, 400);
  assert.equal((await api.put('/api/configuracion/otra_clave').send({ valor: true })).status, 404);
});

test('cada cambio de producto deja registro de auditoría con quién lo hizo', async () => {
  const [[{ total }]] = await sequelize.query("SELECT COUNT(*)::int AS total FROM auditoria WHERE entidad = 'producto' AND id_usuario IS NOT NULL");
  assert.ok(total >= 5);
  const [[inactivar]] = await sequelize.query("SELECT detalle FROM auditoria WHERE entidad = 'producto' AND accion = 'inactivar' LIMIT 1");
  assert.equal(inactivar.detalle.cambio, 'inactivar');
});
