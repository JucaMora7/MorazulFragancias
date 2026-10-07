import { Link } from 'react-router-dom';
import { obtener } from '../api/cliente.js';
import { useCarga, useTitulo } from '../util/ganchos.js';
import BotonWhatsApp from '../componentes/BotonWhatsApp.jsx';
import TarjetaProducto from '../componentes/TarjetaProducto.jsx';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados.jsx';
import frascoGenerico from '../assets/frasco-generico.svg';

const RAZONES = [
  { titulo: 'Variedad de aromas', texto: 'Lociones y perfumes para el día, la noche y cada ocasión.' },
  { titulo: 'Presentación práctica', texto: 'Frasco de 30 ml para llevar a todas partes.' },
  { titulo: 'Atención directa', texto: 'Hablas con nosotros por WhatsApp y te ayudamos a elegir.' },
];

// Sin una marca de "destacado" en el negocio, se muestran primero las fragancias con existencias.
export function elegirDestacados(fragancias, cantidad = 4) {
  const hay = (f) => f.presentaciones[0]?.disponibilidad !== 'Agotado';
  return [...fragancias.filter(hay), ...fragancias.filter((f) => !hay(f))].slice(0, cantidad);
}

export default function Inicio() {
  useTitulo(null);
  const catalogo = useCarga(() => obtener('/api/publico/catalogo', { limite: 24 }), []);

  return (
    <>
      <section className="portada" aria-labelledby="titulo-portada">
        <div className="portada__texto">
          <p className="portada__sobretitulo">MORAZUL FRAGANCIAS</p>
          <h1 className="titulo-xl" id="titulo-portada">
            Fragancias con carácter, hechas para ti
          </h1>
          <p className="portada__descripcion">Conoce nuestras lociones y perfumes y escríbenos para hacer tu pedido. Te atendemos de forma directa.</p>
          <div className="portada__acciones">
            <Link to="/catalogo" className="boton boton--blanco">
              Ver catálogo
            </Link>
            <BotonWhatsApp variante="contorno">Escríbenos</BotonWhatsApp>
          </div>
        </div>
        <div className="portada__foto" aria-hidden="true">
          <img src={frascoGenerico} alt="" width="360" height="360" />
        </div>
      </section>

      <section className="seccion" aria-labelledby="titulo-destacados">
        <div className="seccion__cabecera">
          <h2 className="titulo-l" id="titulo-destacados">
            Productos destacados
          </h2>
          <Link to="/catalogo" className="enlace">
            Ver todo el catálogo
          </Link>
        </div>
        {catalogo.error ? (
          <ErrorCarga error={catalogo.error} onReintentar={catalogo.recargar} />
        ) : catalogo.cargando ? (
          <Cargando />
        ) : catalogo.datos.fragancias.length === 0 ? (
          <Vacio>Pronto tendremos productos para ti.</Vacio>
        ) : (
          <div className="cuadricula cuadricula--cuatro">
            {elegirDestacados(catalogo.datos.fragancias).map((f) => (
              <TarjetaProducto key={f.codigo} fragancia={f} />
            ))}
          </div>
        )}
      </section>

      <section className="seccion seccion--gris" aria-labelledby="titulo-razones">
        <h2 className="titulo-l" id="titulo-razones">
          Por qué elegir Morazul
        </h2>
        <ul className="razones">
          {RAZONES.map((r) => (
            <li key={r.titulo} className="razon">
              <h3 className="titulo-s">{r.titulo}</h3>
              <p className="tenue">{r.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="pedir" aria-labelledby="titulo-pedir">
        <h2 className="titulo-l" id="titulo-pedir">
          ¿Listo para hacer tu pedido?
        </h2>
        <p className="tenue">Escríbenos y te confirmamos disponibilidad y entrega.</p>
        <BotonWhatsApp>Escribir por WhatsApp</BotonWhatsApp>
      </section>
    </>
  );
}
