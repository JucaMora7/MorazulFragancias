import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi, api, configurarSesion } from './cliente.js';
import { instalarFetch } from '../test/ayudas.jsx';

let alVencer;
beforeEach(() => {
  alVencer = vi.fn();
  configurarSesion({ token: () => null, alVencer });
});

describe('cliente de la API', () => {
  it('arma la consulta ignorando valores vacíos', async () => {
    const { llamadas } = instalarFetch({ 'GET /api/productos': () => ({ productos: [] }) });
    await api('/api/productos', { consulta: { q: 'asad', categoria: '', estado: undefined, pagina: 2, otro: null } });
    expect(llamadas[0].url).toBe('http://localhost:3000/api/productos?q=asad&pagina=2');
  });

  it('envía el token en la cabecera Authorization', async () => {
    configurarSesion({ token: () => 'abc.def.ghi', alVencer });
    const { falso } = instalarFetch({ 'GET /api/categorias': () => ({ categorias: [] }) });
    await api('/api/categorias');
    expect(falso.mock.calls[0][1].headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('no envía Authorization sin sesión', async () => {
    const { falso } = instalarFetch({ 'GET /api/publico/contacto': () => ({}) });
    await api('/api/publico/contacto');
    expect(falso.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('manda el cuerpo como JSON', async () => {
    const { llamadas } = instalarFetch({ 'POST /api/ventas': () => [{ venta: {} }, 201] });
    await api('/api/ventas', { metodo: 'POST', cuerpo: { items: [{ id_producto: 1, cantidad: 2 }] } });
    expect(llamadas[0].cuerpo).toEqual({ items: [{ id_producto: 1, cantidad: 2 }] });
  });

  it('convierte los errores de la API en ErrorApi con su mensaje en español', async () => {
    instalarFetch({ 'POST /api/ventas': () => [{ error: { codigo: 'regla_de_negocio', mensaje: 'Abre la caja del día antes de vender', detalles: [1] } }, 422] });
    const error = await api('/api/ventas', { metodo: 'POST', cuerpo: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({ estado: 422, codigo: 'regla_de_negocio', message: 'Abre la caja del día antes de vender', detalles: [1] });
  });

  it('da un mensaje claro cuando no hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const error = await api('/api/productos').catch((e) => e);
    expect(error.codigo).toBe('sin_conexion');
    expect(error.message).toMatch(/No se pudo conectar/);
  });

  it('un 401 con sesión iniciada cierra la sesión', async () => {
    configurarSesion({ token: () => 'vencido', alVencer });
    instalarFetch({ 'GET /api/productos': () => [{ error: { codigo: 'no_autenticado', mensaje: 'La sesión no es válida o venció' } }, 401] });
    await expect(api('/api/productos')).rejects.toThrow('La sesión no es válida o venció');
    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  it('un 401 sin sesión (contraseña incorrecta) no cierra nada', async () => {
    instalarFetch({ 'POST /api/auth/login': () => [{ error: { codigo: 'no_autenticado', mensaje: 'Correo o contraseña incorrectos' } }, 401] });
    await expect(api('/api/auth/login', { metodo: 'POST', cuerpo: {} })).rejects.toThrow('Correo o contraseña incorrectos');
    expect(alVencer).not.toHaveBeenCalled();
  });

  it('responde con un mensaje genérico si el servidor devuelve algo inesperado', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('no es json')) })));
    const error = await api('/api/productos').catch((e) => e);
    expect(error).toMatchObject({ estado: 502, codigo: 'error' });
    expect(error.message).toMatch(/inesperado/);
  });
});
