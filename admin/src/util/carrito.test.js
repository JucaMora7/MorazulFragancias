import { describe, expect, it } from 'vitest';
import { cantidadEnCarrito, carritoReducer, carritoVacio, cuerpoDeVenta, totalCarrito, unidadesCarrito } from './carrito.js';

const brisa = { id_producto: 1, nombre: 'BRISA AZUL 100 ml', precio_venta: 42000, existencias: 4 };
const vainilla = { id_producto: 2, nombre: 'VAINILLA SUAVE 100 ml', precio_venta: '36000.00', existencias: 18 };
const agotado = { id_producto: 3, nombre: 'NOCHE VIOLETA 50 ml', precio_venta: 55000, existencias: 0 };

const aplicar = (estado, ...acciones) => acciones.reduce(carritoReducer, estado);

describe('carrito', () => {
  it('agrega un producto con cantidad 1 y suma si se repite', () => {
    const e = aplicar(carritoVacio, { tipo: 'agregar', producto: brisa }, { tipo: 'agregar', producto: brisa });
    expect(e.lineas).toHaveLength(1);
    expect(e.lineas[0]).toMatchObject({ id_producto: 1, cantidad: 2, precio: 42000 });
  });

  it('convierte el precio de texto (como llega de la base) a número', () => {
    const e = aplicar(carritoVacio, { tipo: 'agregar', producto: vainilla });
    expect(e.lineas[0].precio).toBe(36000);
  });

  it('no agrega productos agotados', () => {
    expect(aplicar(carritoVacio, { tipo: 'agregar', producto: agotado })).toBe(carritoVacio);
  });

  it('no pasa de las existencias', () => {
    let e = carritoVacio;
    for (let i = 0; i < 10; i++) e = carritoReducer(e, { tipo: 'agregar', producto: brisa });
    expect(e.lineas[0].cantidad).toBe(4);
    e = carritoReducer(e, { tipo: 'cambiar', id_producto: 1, delta: 5 });
    expect(e.lineas[0].cantidad).toBe(4);
  });

  it('restar hasta cero quita la línea', () => {
    let e = aplicar(carritoVacio, { tipo: 'agregar', producto: brisa }, { tipo: 'agregar', producto: brisa });
    e = carritoReducer(e, { tipo: 'cambiar', id_producto: 1, delta: -1 });
    expect(e.lineas[0].cantidad).toBe(1);
    e = carritoReducer(e, { tipo: 'cambiar', id_producto: 1, delta: -1 });
    expect(e.lineas).toHaveLength(0);
  });

  it('quita y vacía', () => {
    let e = aplicar(carritoVacio, { tipo: 'agregar', producto: brisa }, { tipo: 'agregar', producto: vainilla });
    e = carritoReducer(e, { tipo: 'quitar', id_producto: 1 });
    expect(e.lineas.map((l) => l.id_producto)).toEqual([2]);
    expect(carritoReducer(e, { tipo: 'vaciar' }).lineas).toEqual([]);
  });

  it('calcula total y unidades', () => {
    const e = aplicar(
      carritoVacio,
      { tipo: 'agregar', producto: brisa },
      { tipo: 'agregar', producto: brisa },
      { tipo: 'agregar', producto: vainilla }
    );
    expect(totalCarrito(e)).toBe(2 * 42000 + 36000);
    expect(unidadesCarrito(e)).toBe(3);
    expect(cantidadEnCarrito(e, 1)).toBe(2);
    expect(cantidadEnCarrito(e, 99)).toBe(0);
  });

  it('suma en centavos sin errores de redondeo', () => {
    const barato = { id_producto: 9, nombre: 'X', precio_venta: 0.1, existencias: 10 };
    let e = carritoVacio;
    for (let i = 0; i < 3; i++) e = carritoReducer(e, { tipo: 'agregar', producto: barato });
    expect(totalCarrito(e)).toBe(0.3);
  });

  it('el cuerpo de la venta lleva solo ids y cantidades, nunca precios', () => {
    const e = aplicar(carritoVacio, { tipo: 'agregar', producto: brisa }, { tipo: 'agregar', producto: brisa }, { tipo: 'agregar', producto: vainilla });
    expect(cuerpoDeVenta(e)).toEqual({
      items: [
        { id_producto: 1, cantidad: 2 },
        { id_producto: 2, cantidad: 1 },
      ],
    });
  });

  it('ignora acciones desconocidas', () => {
    expect(carritoReducer(carritoVacio, { tipo: 'otra' })).toBe(carritoVacio);
  });
});
