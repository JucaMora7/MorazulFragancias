import { pesos } from './formato.js';

export const MENSAJE_GENERAL = 'Hola, quiero hacer un pedido en Morazul.';

// Enlace de WhatsApp con el mensaje ya escrito. El número se limpia a solo dígitos
// (con indicativo de país, como 573233278897).
export function enlaceWhatsapp(numero, mensaje) {
  const digitos = String(numero ?? '').replace(/\D/g, '');
  const base = `https://wa.me/${digitos}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

// Mensaje para pedir una fragancia concreta: nombre, presentación y precio.
export function mensajeDeProducto({ nombre, presentacion_ml, precio }) {
  const ml = presentacion_ml ? ` de ${presentacion_ml} ml` : '';
  const valor = precio ? ` (${pesos(precio)})` : '';
  return `Hola, me interesa ${nombre}${ml}${valor}. ¿Está disponible?`;
}

// "+57 323 327 8897" a partir de 573233278897 (solo para mostrarlo en pantalla).
export function numeroLegible(numero) {
  const d = String(numero ?? '').replace(/\D/g, '');
  const m = d.match(/^(57)(\d{3})(\d{3})(\d{4})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : d ? `+${d}` : '';
}
