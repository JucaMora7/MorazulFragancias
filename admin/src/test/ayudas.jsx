import { vi } from 'vitest';

export function respuesta(cuerpo, estado = 200) {
  return Promise.resolve({
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: () => Promise.resolve(cuerpo),
  });
}

// Reemplaza fetch por un enrutador sencillo: { 'GET /api/caja/hoy': () => ({...}) }.
// Cada función recibe (url, opciones) y devuelve el cuerpo, o [cuerpo, estado].
export function instalarFetch(rutas) {
  const llamadas = [];
  const falso = vi.fn((url, opciones = {}) => {
    const { pathname } = new URL(url);
    const clave = `${opciones.method || 'GET'} ${pathname}`;
    llamadas.push({ clave, url, opciones, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined });
    const manejador = rutas[clave];
    if (!manejador) return respuesta({ error: { codigo: 'no_encontrado', mensaje: `Sin ruta de prueba: ${clave}` } }, 404);
    const resultado = manejador(url, opciones);
    return Array.isArray(resultado) ? respuesta(resultado[0], resultado[1]) : respuesta(resultado);
  });
  vi.stubGlobal('fetch', falso);
  return { falso, llamadas };
}

// Token con vencimiento (solo el payload importa en el cliente).
export function tokenDePrueba({ expiraEn = Date.now() + 3600_000 } = {}) {
  const base64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${base64({ alg: 'HS256' })}.${base64({ sub: '1', rol: 'administrador', exp: Math.floor(expiraEn / 1000) })}.firma`;
}
