import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import BotonWhatsApp from './BotonWhatsApp.jsx';
import iconoMenu from '../assets/iconos/menu.svg?raw';
import iconoX from '../assets/iconos/x.svg?raw';

const ENLACES = [
  { ruta: '/', texto: 'Inicio', fin: true },
  { ruta: '/catalogo', texto: 'Catálogo' },
  { ruta: '/contacto', texto: 'Contacto' },
];

const icono = (svg) => svg.replace(/#5C5B70/gi, 'currentColor');

export default function Encabezado() {
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setAbierto(false), [pathname]);

  return (
    <header className="encabezado">
      <div className="encabezado__barra">
        <Link to="/" aria-label="Morazul Fragancias, ir al inicio">
          <Logo />
        </Link>

        <nav className="encabezado__enlaces" aria-label="Principal">
          {ENLACES.map((e) => (
            <NavLink key={e.ruta} to={e.ruta} end={e.fin}>
              {e.texto}
            </NavLink>
          ))}
        </nav>

        <div className="encabezado__accion">
          <BotonWhatsApp>Escríbenos por WhatsApp</BotonWhatsApp>
        </div>

        <button
          type="button"
          className="encabezado__menu"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setAbierto((a) => !a)}
          dangerouslySetInnerHTML={{ __html: icono(abierto ? iconoX : iconoMenu) }}
        />
      </div>

      {abierto && (
        <nav id="menu-movil" className="encabezado__movil" aria-label="Menú">
          {ENLACES.map((e) => (
            <NavLink key={e.ruta} to={e.ruta} end={e.fin}>
              {e.texto}
            </NavLink>
          ))}
          <BotonWhatsApp bloque>Escríbenos por WhatsApp</BotonWhatsApp>
        </nav>
      )}
    </header>
  );
}
