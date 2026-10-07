import { describe, expect, it } from 'vitest';
import { MENSAJE_GENERAL, enlaceWhatsapp, mensajeDeProducto, numeroLegible } from './whatsapp.js';
import { numero, pesos, plural } from './formato.js';

describe('enlaceWhatsapp', () => {
  it('arma el enlace con el mensaje codificado', () => {
    const url = enlaceWhatsapp('573233278897', 'Hola, ¿tienen "ASAD LATTAFA" & más?');
    expect(url.startsWith('https://wa.me/573233278897?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('Hola, ¿tienen "ASAD LATTAFA" & más?');
    expect(url).not.toMatch(/[ "&]/);
  });
  it('deja solo los dígitos del número', () => {
    expect(enlaceWhatsapp('+57 323 327-8897', 'Hola')).toBe('https://wa.me/573233278897?text=Hola');
  });
  it('sin mensaje devuelve solo el enlace del número', () => {
    expect(enlaceWhatsapp('573233278897')).toBe('https://wa.me/573233278897');
  });
  it('no se rompe con un número vacío', () => {
    expect(enlaceWhatsapp(null, 'Hola')).toBe('https://wa.me/?text=Hola');
  });
  it('un mensaje con caracteres especiales no inyecta parámetros', () => {
    const url = enlaceWhatsapp('573233278897', 'x&phone=999#frag');
    expect(new URL(url).searchParams.get('text')).toBe('x&phone=999#frag');
    expect(new URL(url).searchParams.get('phone')).toBeNull();
  });
});

describe('mensajes', () => {
  it('el mensaje general pide un pedido', () => {
    expect(MENSAJE_GENERAL).toMatch(/pedido/);
  });
  it('el mensaje de producto lleva nombre, presentación y precio', () => {
    expect(mensajeDeProducto({ nombre: 'ASAD LATTAFA', presentacion_ml: 30, precio: 20000 })).toBe('Hola, me interesa ASAD LATTAFA de 30 ml ($ 20.000). ¿Está disponible?');
  });
  it('omite lo que no se conoce', () => {
    expect(mensajeDeProducto({ nombre: 'X' })).toBe('Hola, me interesa X. ¿Está disponible?');
  });
});

describe('numeroLegible', () => {
  it('da formato colombiano', () => {
    expect(numeroLegible('573233278897')).toBe('+57 323 327 8897');
  });
  it('si no reconoce el formato, devuelve los dígitos con +', () => {
    expect(numeroLegible('12345')).toBe('+12345');
    expect(numeroLegible('')).toBe('');
  });
});

describe('formato', () => {
  it('escribe pesos con puntos de miles', () => {
    expect(pesos(20000)).toBe('$ 20.000');
    expect(pesos('1500000.00')).toBe('$ 1.500.000');
    expect(pesos(1500.5)).toBe('$ 1.500,50');
    expect(pesos(null)).toBe('—');
  });
  it('plural y números', () => {
    expect(plural(1, 'fragancia', 'fragancias')).toBe('fragancia');
    expect(plural(125, 'fragancia', 'fragancias')).toBe('fragancias');
    expect(numero(1234)).toBe('1.234');
  });
});
