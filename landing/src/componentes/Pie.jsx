import { Link } from 'react-router-dom';
import { useContacto } from '../util/ContactoContext.jsx';
import { numeroLegible } from '../util/whatsapp.js';
import Logo from './Logo.jsx';

export default function Pie() {
  const c = useContacto();
  return (
    <footer className="pie">
      <div className="pie__contenido">
        <div className="pie__marca">
          <Logo oscuro />
          <p>Lociones y perfumes para cada ocasión.</p>
        </div>

        <div className="pie__columna">
          <p className="etiqueta-texto">Contacto</p>
          <p>WhatsApp: {numeroLegible(c.whatsapp)}</p>
          <p>
            <a href={`mailto:${c.correo}`}>{c.correo}</a>
          </p>
          <p>{c.ciudad}</p>
        </div>

        <nav className="pie__columna" aria-label="Explorar">
          <p className="etiqueta-texto">Explorar</p>
          <Link to="/">Inicio</Link>
          <Link to="/catalogo">Catálogo</Link>
          <Link to="/contacto">Contacto</Link>
        </nav>
      </div>
      <hr className="pie__linea" />
      <p className="pequeno">© 2026 Morazul Fragancias. Todos los derechos reservados.</p>
    </footer>
  );
}
