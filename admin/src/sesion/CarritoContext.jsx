import { createContext, useContext, useMemo, useReducer } from 'react';
import { carritoReducer, carritoVacio, totalCarrito, unidadesCarrito } from '../util/carrito.js';

const CarritoContext = createContext(null);

// El carrito vive mientras el panel está abierto, para no perder la venta al cambiar de pantalla.
export function CarritoProvider({ children }) {
  const [carrito, despachar] = useReducer(carritoReducer, carritoVacio);

  const valor = useMemo(
    () => ({
      carrito,
      total: totalCarrito(carrito),
      unidades: unidadesCarrito(carrito),
      agregar: (producto) => despachar({ tipo: 'agregar', producto }),
      cambiar: (id_producto, delta) => despachar({ tipo: 'cambiar', id_producto, delta }),
      quitar: (id_producto) => despachar({ tipo: 'quitar', id_producto }),
      vaciar: () => despachar({ tipo: 'vaciar' }),
    }),
    [carrito]
  );
  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const contexto = useContext(CarritoContext);
  if (!contexto) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return contexto;
}
