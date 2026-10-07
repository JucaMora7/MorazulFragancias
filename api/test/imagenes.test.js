const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { request, preparar, conSesion, cerrar } = require('./ayudas');
const config = require('../src/config');

let ctx;
let api;
let idFragancia;

const png = (ancho = 1600, alto = 1200) =>
  sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 10, g: 4, b: 73 } } }).png().toBuffer();

const archivoEnDisco = (url) => path.join(config.imagenes.carpeta, new URL(url).pathname.replace(/^\/uploads\//, ''));

before(async () => {
  ctx = await preparar();
  api = conSesion(ctx);
  const r = await api.get('/api/fragancias?q=CAB-001');
  idFragancia = r.body.fragancias[0].id_fragancia;
});
after(async () => {
  fs.rmSync(path.join(config.imagenes.carpeta, 'fragancias'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  await cerrar();
});

test('sube una foto, la reduce a 800 px, la convierte a WebP y reemplaza la imagen genérica', async () => {
  const r = await api.post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', await png(), 'foto.png');
  assert.equal(r.status, 200);
  const url = r.body.fragancia.imagen_url;
  assert.match(url, /\/uploads\/fragancias\/cab-001-\d+\.webp$/);

  const guardada = await sharp(archivoEnDisco(url)).metadata();
  assert.equal(guardada.format, 'webp');
  assert.equal(guardada.width, 800);
  assert.equal(guardada.height, 600);

  const publico = await request(ctx.app).get('/api/publico/catalogo/CAB-001');
  assert.ok(publico.body.fragancia.presentaciones.every((p) => p.imagen_url === url));
  assert.equal(publico.body.fragancia.imagen_url, url);

  const servida = await request(ctx.app).get(new URL(url).pathname);
  assert.equal(servida.status, 200);
  assert.match(servida.headers['content-type'], /image\/webp/);
});

test('no agranda imágenes pequeñas', async () => {
  const r = await api.post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', await png(300, 200), 'chica.png');
  assert.equal(r.status, 200);
  const meta = await sharp(archivoEnDisco(r.body.fragancia.imagen_url)).metadata();
  assert.equal(meta.width, 300);
});

test('al reemplazar la foto se borra la anterior del disco', async () => {
  const primera = await api.get(`/api/fragancias/${idFragancia}`);
  const rutaVieja = archivoEnDisco(primera.body.fragancia.imagen_url);
  assert.ok(fs.existsSync(rutaVieja));
  await new Promise((r) => setTimeout(r, 5));
  const nueva = await api.post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', await png(900, 900), 'otra.png');
  assert.equal(nueva.status, 200);
  assert.equal(fs.existsSync(rutaVieja), false);
  assert.ok(fs.existsSync(archivoEnDisco(nueva.body.fragancia.imagen_url)));
});

test('rechaza un ejecutable renombrado como .jpg aunque declare tipo image/jpeg', async () => {
  const falso = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2000, 0x90)]);
  const r = await api.post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', falso, { filename: 'foto.jpg', contentType: 'image/jpeg' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.codigo, 'validacion');
});

test('rechaza SVG, texto y HTML disfrazados de imagen', async () => {
  const casos = [
    ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'x.png', 'image/png'],
    ['<html><script>alert(1)</script></html>', 'x.webp', 'image/webp'],
    ['solo texto', 'x.jpg', 'image/jpeg'],
  ];
  for (const [contenido, filename, contentType] of casos) {
    const r = await api.post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', Buffer.from(contenido), { filename, contentType });
    assert.equal(r.status, 400, filename);
  }
});

test('rechaza un archivo con cabecera de imagen pero contenido dañado', async () => {
  const sano = await png(200, 200);
  const dañado = Buffer.concat([sano.subarray(0, 60), Buffer.alloc(40, 0xff)]);
  const r = await api.post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', dañado, 'rota.png');
  assert.equal(r.status, 400);
});

test('rechaza archivos de más de 3 MB y solicitudes sin archivo', async () => {
  const grande = Buffer.concat([await png(100, 100), Buffer.alloc(config.imagenes.maxBytes + 1024)]);
  const r = await api.post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', grande, 'enorme.png');
  assert.equal(r.status, 413);
  assert.equal(r.body.error.codigo, 'archivo_muy_grande');
  const sin = await api.post(`/api/fragancias/${idFragancia}/imagen`);
  assert.equal(sin.status, 400);
});

test('subir imagen exige sesión y una fragancia existente', async () => {
  const sinSesion = await request(ctx.app).post(`/api/fragancias/${idFragancia}/imagen`).attach('imagen', await png(100, 100), 'a.png');
  assert.equal(sinSesion.status, 401);
  const noExiste = await api.post('/api/fragancias/99999/imagen').attach('imagen', await png(100, 100), 'a.png');
  assert.equal(noExiste.status, 404);
});

test('quitar la foto propia vuelve a la imagen genérica y borra el archivo', async () => {
  const actual = await api.get(`/api/fragancias/${idFragancia}`);
  const ruta = archivoEnDisco(actual.body.fragancia.imagen_url);
  const r = await api.delete(`/api/fragancias/${idFragancia}/imagen`);
  assert.equal(r.status, 200);
  assert.equal(r.body.fragancia.imagen_url, null);
  assert.equal(fs.existsSync(ruta), false);
  const publico = await request(ctx.app).get('/api/publico/catalogo/CAB-001');
  assert.match(publico.body.fragancia.presentaciones[0].imagen_url, /genericas\/generica-30ml\.webp$/);
});

test('no se pueden leer archivos fuera de la carpeta de imágenes', async () => {
  for (const ruta of ['/uploads/../package.json', '/uploads/%2e%2e/package.json', '/uploads/..%2f..%2f.env']) {
    const r = await request(ctx.app).get(ruta);
    assert.notEqual(r.status, 200, ruta);
    assert.equal(/"name"|DB_PASSWORD/.test(r.text), false, ruta);
  }
});
