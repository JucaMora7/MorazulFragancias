import { Link } from 'react-router-dom';
import { useTitulo } from '../util/ganchos.js';

export default function NoEncontrada({ texto = 'La página que buscas no existe.' }) {
  useTitulo('No encontrada');
  return (
    <div className="pagina">
      <div className="estado">
        <h1 className="titulo-l">No encontramos lo que buscas</h1>
        <p className="tenue">{texto}</p>
        <Link to="/catalogo" className="boton boton--primario">
          Ver el catálogo
        </Link>
      </div>
    </div>
  );
}
