// Lógica del carrito de la venta (funciones puras, fáciles de probar).
// El servidor vuelve a validar existencias, estado y precio al confirmar: esto es solo comodidad.

export const MAX_UNIDADES_POR_LINEA = 1000;

export const carritoVacio = { lineas: [] };

function limite(linea) {
  return Math.min(linea.existencias, MAX_UNIDADES_POR_LINEA);
}

export function carritoReducer(estado, accion) {
  switch (accion.tipo) {
    case 'agregar': {
      const p = accion.producto;
      if (!(p.existencias > 0)) return estado;
      const existente = estado.lineas.find((l) => l.id_producto === p.id_producto);
      if (existente) {
        if (existente.cantidad >= limite(existente)) return estado;
        return {
          lineas: estado.lineas.map((l) => (l.id_producto === p.id_producto ? { ...l, cantidad: l.cantidad + 1 } : l)),
        };
      }
      return {
        lineas: [
          ...estado.lineas,
          {
            id_producto: p.id_producto,
            nombre: p.nombre,
            precio: Number(p.precio_venta),
            existencias: p.existencias,
            cantidad: 1,
          },
        ],
      };
    }
    case 'cambiar': {
      return {
        lineas: estado.lineas
          .map((l) => {
            if (l.id_producto !== accion.id_producto) return l;
            const cantidad = Math.min(l.cantidad + accion.delta, limite(l));
            return { ...l, cantidad };
          })
          .filter((l) => l.cantidad > 0),
      };
    }
    case 'quitar':
      return { lineas: estado.lineas.filter((l) => l.id_producto !== accion.id_producto) };
    case 'vaciar':
      return carritoVacio;
    default:
      return estado;
  }
}

// Total en centavos para evitar errores de redondeo con decimales.
export function totalCarrito(estado) {
  const centavos = estado.lineas.reduce((suma, l) => suma + Math.round(l.precio * 100) * l.cantidad, 0);
  return centavos / 100;
}

export function unidadesCarrito(estado) {
  return estado.lineas.reduce((suma, l) => suma + l.cantidad, 0);
}

export function cantidadEnCarrito(estado, idProducto) {
  return estado.lineas.find((l) => l.id_producto === idProducto)?.cantidad ?? 0;
}

// Cuerpo que espera POST /api/ventas: solo ids y cantidades, nunca precios.
export function cuerpoDeVenta(estado) {
  return { items: estado.lineas.map((l) => ({ id_producto: l.id_producto, cantidad: l.cantidad })) };
}
