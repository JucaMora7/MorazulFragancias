import { Link } from 'react-router-dom';
import { useContacto } from '../util/ContactoContext.jsx';
import { useTitulo } from '../util/ganchos.js';
import { numeroLegible } from '../util/whatsapp.js';
import BotonWhatsApp from '../componentes/BotonWhatsApp.jsx';

export default function Contacto() {
  useTitulo('Contacto');
  const c = useContacto();
  // El horario y la dirección solo aparecen cuando el negocio los define.
  const filas = [
    ['WhatsApp', numeroLegible(c.whatsapp)],
    ['Correo', c.correo],
    ['Ciudad', c.ciudad],
    c.direccion && ['Dirección', c.direccion],
    c.horario && ['Horario de atención', c.horario],
  ].filter(Boolean);

  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Contacto</h1>
      <p className="tenue">Cuéntanos qué fragancia buscas y te ayudamos a elegir.</p>

      <div className="contacto">
        <dl className="tarjeta contacto__datos">
          {filas.map(([titulo, valor]) => (
            <div key={titulo}>
              <dt className="etiqueta-texto mudo">{titulo.toUpperCase()}</dt>
              <dd className="cuerpo-fuerte">{titulo === 'Correo' ? <a href={`mailto:${valor}`}>{valor}</a> : valor}</dd>
            </div>
          ))}
        </dl>

        <section className="contacto__pedido" aria-labelledby="titulo-pedido">
          <h2 className="titulo-l" id="titulo-pedido">
            ¿Quieres hacer un pedido?
          </h2>
          <p className="tenue">Escríbenos por WhatsApp con el nombre del producto y la cantidad. Te confirmamos disponibilidad, precio y entrega.</p>
          <div className="contacto__acciones">
            <BotonWhatsApp>Escribir por WhatsApp</BotonWhatsApp>
            <Link to="/catalogo" className="boton boton--secundario">
              Ver catálogo
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
