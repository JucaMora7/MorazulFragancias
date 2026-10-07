const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { request, sequelize, preparar, cerrar, CORREO, CONTRASENA } = require('./ayudas');
const config = require('../src/config');

let ctx;
before(async () => {
  ctx = await preparar();
});
after(cerrar);

test('login correcto devuelve token y datos del usuario sin la contraseña', async () => {
  const r = await request(ctx.app).post('/api/auth/login').send({ correo: CORREO, contrasena: CONTRASENA });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal(r.body.usuario.correo, CORREO);
  assert.equal(r.body.usuario.rol, 'administrador');
  assert.equal(JSON.stringify(r.body).includes('hash'), false);
});

test('el correo se acepta sin importar mayúsculas', async () => {
  const r = await request(ctx.app).post('/api/auth/login').send({ correo: CORREO.toUpperCase(), contrasena: CONTRASENA });
  assert.equal(r.status, 200);
});

test('contraseña incorrecta y correo inexistente dan el mismo error', async () => {
  const mala = await request(ctx.app).post('/api/auth/login').send({ correo: CORREO, contrasena: 'incorrecta-123' });
  const sinUsuario = await request(ctx.app).post('/api/auth/login').send({ correo: 'nadie@morazul.test', contrasena: 'incorrecta-123' });
  assert.equal(mala.status, 401);
  assert.equal(sinUsuario.status, 401);
  assert.deepEqual(mala.body, sinUsuario.body);
});

test('login sin datos devuelve 400 en español', async () => {
  const r = await request(ctx.app).post('/api/auth/login').send({});
  assert.equal(r.status, 400);
  assert.equal(r.body.error.codigo, 'validacion');
});

test('un usuario inactivo no puede iniciar sesión ni usar un token anterior', async () => {
  const antes = await request(ctx.app).post('/api/auth/login').send({ correo: CORREO, contrasena: CONTRASENA });
  await sequelize.query('UPDATE usuario SET activo = FALSE');
  const login = await request(ctx.app).post('/api/auth/login').send({ correo: CORREO, contrasena: CONTRASENA });
  const yo = await request(ctx.app).get('/api/auth/yo').set('Authorization', `Bearer ${antes.body.token}`);
  await sequelize.query('UPDATE usuario SET activo = TRUE');
  assert.equal(login.status, 401);
  assert.equal(yo.status, 401);
});

test('/api/auth/yo devuelve el usuario con un token válido', async () => {
  const r = await request(ctx.app).get('/api/auth/yo').set('Authorization', `Bearer ${ctx.token}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.usuario.correo, CORREO);
});

test('las rutas protegidas rechazan solicitudes sin token, con token falso o vencido', async () => {
  const rutas = ['/api/categorias', '/api/fragancias', '/api/productos', '/api/configuracion', '/api/auth/yo'];
  for (const ruta of rutas) {
    const sin = await request(ctx.app).get(ruta);
    assert.equal(sin.status, 401, `${ruta} sin token`);
    const falso = await request(ctx.app).get(ruta).set('Authorization', 'Bearer token.falso.xyz');
    assert.equal(falso.status, 401, `${ruta} con token falso`);
  }
  const vencido = jwt.sign({ rol: 'administrador' }, config.jwt.secreto, { subject: '1', expiresIn: -10 });
  assert.equal((await request(ctx.app).get('/api/productos').set('Authorization', `Bearer ${vencido}`)).status, 401);
  const otraLlave = jwt.sign({ rol: 'administrador' }, 'otra-llave-distinta-de-32-caracteres-o-mas', { subject: '1' });
  assert.equal((await request(ctx.app).get('/api/productos').set('Authorization', `Bearer ${otraLlave}`)).status, 401);
  const sinAlgoritmo = jwt.sign({ rol: 'administrador' }, config.jwt.secreto, { subject: '1', algorithm: 'HS512' });
  assert.equal((await request(ctx.app).get('/api/productos').set('Authorization', `Bearer ${sinAlgoritmo}`)).status, 401);
});

test('la contraseña se guarda como hash bcrypt, nunca en texto plano', async () => {
  const [[fila]] = await sequelize.query('SELECT contrasena_hash FROM usuario LIMIT 1');
  assert.match(fila.contrasena_hash, /^\$2[aby]\$\d{2}\$/);
  assert.notEqual(fila.contrasena_hash, CONTRASENA);
});

test('rutas inexistentes y JSON mal formado devuelven errores en el formato común', async () => {
  const noExiste = await request(ctx.app).get('/api/no-existe');
  assert.equal(noExiste.status, 404);
  assert.equal(noExiste.body.error.codigo, 'no_encontrado');
  const malo = await request(ctx.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"correo":');
  assert.equal(malo.status, 400);
  assert.equal(malo.body.error.codigo, 'validacion');
});
