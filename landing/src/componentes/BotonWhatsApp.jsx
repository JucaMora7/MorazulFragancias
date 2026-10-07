import { useContacto } from '../util/ContactoContext.jsx';
import { MENSAJE_GENERAL, enlaceWhatsapp } from '../util/whatsapp.js';

// Enlace que abre WhatsApp con el mensaje ya escrito. No hay compra en línea: todo pedido pasa por aquí.
export default function BotonWhatsApp({ mensaje = MENSAJE_GENERAL, variante = 'primario', bloque = false, children = 'Escribir por WhatsApp' }) {
  const { whatsapp } = useContacto();
  return (
    <a
      className={`boton boton--${variante}${bloque ? ' boton--bloque' : ''}`}
      href={enlaceWhatsapp(whatsapp, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <span className="solo-lectores"> (se abre en una pestaña nueva)</span>
    </a>
  );
}
