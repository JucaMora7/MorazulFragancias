import { vi } from 'vitest';

export function respuesta(cuerpo, estado = 200) {
  return Promise.resolve({ ok: estado >= 200 && estado < 300, status: estado, json: () => Promise.resolve(cuerpo) });
}

// Reemplaza fetch por un enrutador sencillo: { '/api/publico/catalogo': (url) => ({...}) }.
// Cada función recibe la URL completa y devuelve el cuerpo, o [cuerpo, estado].
export function instalarFetch(rutas) {
  const llamadas = [];
  const falso = vi.fn((url) => {
    const { pathname, searchParams } = new URL(url);
    llamadas.push({ ruta: pathname, consulta: Object.fromEntries(searchParams), url });
    const manejador = rutas[pathname];
    if (!manejador) return respuesta({ error: { codigo: 'no_encontrado', mensaje: `Sin ruta de prueba: ${pathname}` } }, 404);
    const resultado = manejador(url);
    return Array.isArray(resultado) ? respuesta(resultado[0], resultado[1]) : respuesta(resultado);
  });
  vi.stubGlobal('fetch', falso);
  return { falso, llamadas };
}

export function fragancia(codigo, nombre, categoria = 'Caballero', disponibilidad = 'Disponible', extra = {}) {
  return {
    codigo,
    nombre,
    categoria,
    es_arabe: false,
    inspirada_en: null,
    desde: 20000,
    imagen_url: null,
    presentaciones: [{ presentacion_ml: 30, precio: 20000, disponibilidad, imagen_url: null }],
    ...extra,
  };
}

export function catalogo(fragancias, extra = {}) {
  return { pagina: 1, limite: 12, total: fragancias.length, total_paginas: 1, fragancias, ...extra };
}

export const CATEGORIAS = {
  categorias: [
    { id_categoria: 1, nombre: 'Caballero', fragancias: 2 },
    { id_categoria: 2, nombre: 'Dama', fragancias: 1 },
  ],
};
