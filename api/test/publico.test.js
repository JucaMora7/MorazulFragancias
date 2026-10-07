const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, sequelize, preparar, cerrar } = require('./ayudas');

let ctx;
const get = (url) => request(ctx.app).get(url);

before(async () => {
  ctx = await preparar({ conAdmin: false });
});
after(cerrar);

test('el catálogo público es abierto y solo trae presentaciones de 30 y 60 ml', async () => {
  const r = await get('/api/publico/catalogo?limite=60');
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 125);
  assert.equal(r.body.fragancias.length, 60);
  assert.equal(r.body.total_paginas, 3);
  for (const f of r.body.fragancias) {
    assert.deepEqual(f.presentaciones.map((p) => p.presentacion_ml), [30, 60]);
    assert.equal(f.desde, 20000);
  }
});

test('no expone existencias, umbrales, estados internos ni identificadores', async () => {
  const r = await get('/api/publico/catalogo/CAB-001');
  assert.equal(r.status, 200);
  const texto = JSON.stringify(r.body);
  for (const prohibido of ['existencias', 'umbral', 'visible_landing', 'estado', 'id_producto', 'id_fragancia', 'creado_en']) {
    assert.equal(texto.includes(prohibido), false, `no debe aparecer "${prohibido}"`);
  }
  assert.deepEqual(Object.keys(r.body.fragancia.presentaciones[0]).sort(), ['disponibilidad', 'imagen_url', 'precio', 'presentacion_ml']);
});

test('los 100 ml en borrador no aparecen y el detalle trae precio, disponibilidad e imagen por presentación', async () => {
  const r = await get('/api/publico/catalogo/CAB-001');
  const f = r.body.fragancia;
  assert.equal(f.nombre, 'ASAD LATTAFA');
  assert.equal(f.presentaciones.length, 2);
  assert.equal(f.presentaciones.find((p) => p.presentacion_ml === 100), undefined);
  assert.equal(f.presentaciones[0].precio, 20000);
  assert.equal(f.presentaciones[1].precio, 40000);
  assert.equal(f.presentaciones[0].disponibilidad, 'Agotado');
  assert.match(f.presentaciones[1].imagen_url, /\/uploads\/genericas\/generica-60ml-azul\.webp$/);
});

test('la marca de referencia está oculta por defecto', async () => {
  const r = await get('/api/publico/catalogo/CAB-002');
  assert.equal(r.body.fragancia.inspirada_en, null);
});

test('filtra por categoría, árabes, presentación y búsqueda', async () => {
  const cats = await get('/api/publico/categorias');
  assert.equal(cats.body.categorias.length, 7);
  const dama = cats.body.categorias.find((c) => c.nombre === 'Dama');
  assert.equal(dama.fragancias, 49);

  const porCategoria = await get(`/api/publico/catalogo?categoria=${dama.id_categoria}&limite=60`);
  assert.equal(porCategoria.body.total, 49);
  assert.ok(porCategoria.body.fragancias.every((f) => f.categoria === 'Dama'));

  const arabes = await get('/api/publico/catalogo?arabes=true&limite=60');
  assert.equal(arabes.body.total, 19);
  assert.ok(arabes.body.fragancias.every((f) => f.es_arabe));

  const busqueda = await get('/api/publico/catalogo?q=lattafa');
  assert.ok(busqueda.body.total >= 1);
  assert.ok(busqueda.body.fragancias.every((f) => /lattafa/i.test(f.nombre)));

  const sin100 = await get('/api/publico/catalogo?presentacion=100');
  assert.equal(sin100.body.total, 0);
  const con60 = await get('/api/publico/catalogo?presentacion=60');
  assert.equal(con60.body.total, 125);
});

test('la búsqueda trata % y _ como texto, no como comodines', async () => {
  const r = await get('/api/publico/catalogo?q=%25');
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 0);
  const guion = await get('/api/publico/catalogo?q=_');
  assert.equal(guion.body.total, 0);
});

test('entradas inválidas devuelven 400 y un código inexistente 404', async () => {
  assert.equal((await get('/api/publico/catalogo?pagina=0')).status, 400);
  assert.equal((await get('/api/publico/catalogo?limite=1000')).status, 400);
  assert.equal((await get('/api/publico/catalogo?presentacion=45')).status, 400);
  assert.equal((await get('/api/publico/catalogo?categoria=abc')).status, 400);
  assert.equal((await get('/api/publico/catalogo?arabes=quizas')).status, 400);
  assert.equal((await get('/api/publico/catalogo/XXX-999')).status, 404);
  assert.equal((await get('/api/publico/catalogo/no-es-un-codigo')).status, 404);
  assert.equal((await get("/api/publico/catalogo?q=%27%3B%20DROP%20TABLE%20producto%3B--")).status, 200);
});

test('una inyección SQL en la búsqueda no daña la base', async () => {
  const [[{ total }]] = await sequelize.query('SELECT COUNT(*)::int AS total FROM producto');
  assert.equal(total, 375);
});

test('el código del detalle no distingue mayúsculas', async () => {
  const r = await get('/api/publico/catalogo/cab-001');
  assert.equal(r.status, 200);
  assert.equal(r.body.fragancia.codigo, 'CAB-001');
});

test('una fragancia inactiva o una presentación inactiva salen del catálogo público', async () => {
  await sequelize.query("UPDATE producto SET estado = 'inactivo', visible_landing = FALSE WHERE id_fragancia = (SELECT id_fragancia FROM fragancia WHERE codigo = 'DAM-001') AND presentacion_ml = 60");
  const detalle = await get('/api/publico/catalogo/DAM-001');
  assert.deepEqual(detalle.body.fragancia.presentaciones.map((p) => p.presentacion_ml), [30]);
  await sequelize.query("UPDATE fragancia SET activa = FALSE WHERE codigo = 'DAM-001'");
  assert.equal((await get('/api/publico/catalogo/DAM-001')).status, 404);
});

test('el contacto trae WhatsApp y correo; horario y dirección quedan por definir', async () => {
  const r = await get('/api/publico/contacto');
  assert.equal(r.status, 200);
  assert.equal(r.body.whatsapp_enlace, `https://wa.me/${r.body.whatsapp}`);
  assert.equal(r.body.ciudad, 'Neiva, Huila');
  assert.equal(r.body.horario, null);
  assert.equal(r.body.direccion, null);
});
