import { Link } from 'react-router-dom';
import { pesos } from '../util/formato.js';
import FotoProducto from './FotoProducto.jsx';
import Disponibilidad from './Disponibilidad.jsx';

// Tarjeta de una fragancia en el catálogo. Hoy cada fragancia se vende solo en 30 ml.
export default function TarjetaProducto({ fragancia }) {
  const p = fragancia.presentaciones[0];
  return (
    <article className="tarjeta-producto">
      <Link to={`/producto/${fragancia.codigo}`} className="tarjeta-producto__foto" tabIndex={-1} aria-hidden="true">
        <FotoProducto src={fragancia.imagen_url} alt={`Frasco de ${fragancia.nombre}`} />
      </Link>
      <div className="tarjeta-producto__datos">
        <p className="etiqueta-texto mudo">{fragancia.categoria.toUpperCase()}</p>
        <h3 className="titulo-s">{fragancia.nombre}</h3>
        <p className="pequeno tenue">Frasco de {p.presentacion_ml} ml</p>
        <div className="tarjeta-producto__precio">
          <span className="titulo-s">{pesos(p.precio)}</span>
          <Disponibilidad valor={p.disponibilidad} ocultarSiDisponible />
        </div>
        <Link to={`/producto/${fragancia.codigo}`} className="boton boton--secundario boton--bloque" aria-label={`Ver detalle de ${fragancia.nombre}`}>
          Ver detalle
        </Link>
      </div>
    </article>
  );
}
