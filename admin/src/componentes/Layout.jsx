import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext.jsx';
import { CarritoProvider } from '../sesion/CarritoContext.jsx';
import { AvisosProvider } from './Avisos.jsx';
import Icono from './Icono.jsx';
import Logo from './Logo.jsx';

const ITEMS = [
  { ruta: '/', texto: 'Inicio', icono: 'home', fin: true },
  { ruta: '/productos', texto: 'Productos', icono: 'package' },
  { ruta: '/inventario', texto: 'Inventario', icono: 'layers' },
  { ruta: '/vender', texto: 'Nueva venta', icono: 'cart' },
  { ruta: '/caja', texto: 'Caja', icono: 'wallet' },
  { ruta: '/reportes', texto: 'Reportes', icono: 'chart' },
  { ruta: '/alertas', texto: 'Alertas', icono: 'bell' },
];

// Pestañas de la barra inferior en el celular (las demás están en el menú).
const NAV_MOVIL = [
  { ruta: '/', texto: 'Inicio', icono: 'home', fin: true },
  { ruta: '/productos', texto: 'Productos', icono: 'package' },
  { ruta: '/vender', texto: 'Vender', icono: 'cart' },
  { ruta: '/caja', texto: 'Caja', icono: 'wallet' },
  { ruta: '/alertas', texto: 'Alertas', icono: 'bell' },
];

function tituloDe(ruta) {
  if (ruta.startsWith('/vender/carrito')) return 'Venta actual';
  const item = ITEMS.find((i) => (i.fin ? ruta === i.ruta : ruta.startsWith(i.ruta)));
  return item ? item.texto : 'Morazul';
}

export default function Layout() {
  const { usuario, cerrarSesion } = useSesion();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    setMenuAbierto(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const titulo = tituloDe(pathname);
  const inicial = (usuario?.nombre || 'A').trim().charAt(0).toUpperCase();

  return (
    <AvisosProvider>
      <CarritoProvider>
        <div className="app">
          {menuAbierto && <div className="menu__fondo" onClick={() => setMenuAbierto(false)} />}

          <aside className={`menu${menuAbierto ? ' menu--abierto' : ''}`} aria-label="Menú principal">
            <div className="menu__cabecera">
              <div className="menu__logo">
                <Logo />
              </div>
              <button type="button" className="boton-cerrar solo-movil" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
                <Icono nombre="x" />
              </button>
            </div>
            <nav className="menu__nav" aria-label="Secciones">
              {ITEMS.map((i) => (
                <NavLink key={i.ruta} to={i.ruta} end={i.fin} className="menu__item">
                  <Icono nombre={i.icono} />
                  {i.texto}
                </NavLink>
              ))}
            </nav>
            <div className="menu__espacio" />
            <button type="button" className="menu__item" onClick={cerrarSesion}>
              <Icono nombre="logout" />
              Cerrar sesión
            </button>
          </aside>

          <div className="principal">
            <header className="barra">
              <p className="titulo-m">{titulo}</p>
              <div className="barra__usuario">
                <NavLink to="/alertas" className="barra__alertas" aria-label="Ver alertas de stock">
                  <Icono nombre="bell" />
                </NavLink>
                <span className="avatar" aria-hidden="true">
                  {inicial}
                </span>
                <span className="cuerpo-fuerte">{usuario?.nombre}</span>
              </div>
            </header>

            <header className="barra-movil">
              <div className="barra__titulo">
                <button type="button" className="icono-boton" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
                  <Icono nombre="menu" />
                </button>
                <p className="titulo-s">{titulo}</p>
              </div>
              <NavLink to="/alertas" className="barra__alertas" aria-label="Ver alertas de stock">
                <Icono nombre="bell" />
              </NavLink>
            </header>

            <main>
              <Outlet />
            </main>
          </div>

          <nav className="nav-movil" aria-label="Navegación rápida">
            {NAV_MOVIL.map((i) => (
              <NavLink key={i.ruta} to={i.ruta} end={i.fin} className="nav-movil__item">
                <Icono nombre={i.icono} />
                {i.texto}
              </NavLink>
            ))}
          </nav>
        </div>
      </CarritoProvider>
    </AvisosProvider>
  );
}
