import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Encabezado from './Encabezado.jsx';
import Pie from './Pie.jsx';

export default function Estructura() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <Encabezado />
      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
      <Pie />
    </>
  );
}
