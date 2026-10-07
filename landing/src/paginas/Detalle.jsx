import { Link, useParams } from 'react-router-dom';
import { obtener } from '../api/cliente.js';
import { useCarga, useTitulo } from '../util/ganchos.js';
import { pesos } from '../util/formato.js';
import { mensajeDeProducto } from '../util/whatsapp.js';
import BotonWhatsApp from '../componentes/BotonWhatsApp.jsx';
import Disponibilidad from '../componentes/Disponibilidad.jsx';
import FotoProducto from '../componentes/FotoProducto.jsx';
import TarjetaProducto from '../componentes/TarjetaProducto.jsx';
import { Cargando, ErrorCarga } from '../componentes/Estados.jsx';
import NoEncontrada from './NoEncontrada.jsx';

// Otras fragancias de la misma categoría (hasta tres).
function Relacionados({ categoria, codigoActual }) {
  const carga = useCarga(async () => {
    const { categorias } = await obtener('/api/publico/categorias');
    const c = categorias.find((x) => x.nombre === categoria);
    if (!c) return [];
    const r = await obtener('/api/publico/catalogo', { categoria: c.id_categoria, limite: 4 });
    return r.fragancias.filter((f) => f.codigo !== codigoActual).slice(0, 3);
  }, [categoria, codigoActual]);

  if (!carga.datos?.length) return null;
  return (
    <section className="seccion seccion--gris" aria-labelledby="titulo-relacionados">
      <h2 className="titulo-l" id="titulo-relacionados">
        También te puede gustar
      </h2>
      <div className="cuadricula cuadricula--tres">
        {carga.datos.map((f) => (
          <TarjetaProducto key={f.codigo} fragancia={f} />
        ))}
      </div>
    </section>
  );
}

export default function Detalle() {
  const { codigo } = useParams();
  const carga = useCarga(() => obtener(`/api/publico/catalogo/${encodeURIComponent(codigo)}`), [codigo]);
  const f = carga.datos?.fragancia;
  useTitulo(f ? `${f.nombre} 30 ml` : carga.error?.estado === 404 ? 'Producto no encontrado' : 'Producto');

  if (carga.error?.estado === 404) return <NoEncontrada texto="No encontramos esa fragancia. Puede que ya no esté disponible." />;
  if (carga.error) return <div className="pagina"><ErrorCarga error={carga.error} onReintentar={carga.recargar} /></div>;
  if (!f) return <div className="pagina"><Cargando /></div>;

  const p = f.presentaciones[0];
  const agotado = p.disponibilidad === 'Agotado';

  return (
    <>
      <div className="pagina">
        <nav className="ruta" aria-label="Ruta de navegación">
          <Link to="/catalogo">Catálogo</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{f.nombre}</span>
        </nav>

        <div className="producto">
          <div className="producto__foto">
            <FotoProducto src={f.imagen_url} alt={`Frasco de ${f.nombre}`} />
          </div>
          <div className="producto__info">
            <p className="etiqueta-texto mudo">{f.categoria.toUpperCase()}</p>
            <h1 className="titulo-pagina">{f.nombre}</h1>
            <p className="producto__precio">
              <span className="titulo-l">{pesos(p.precio)}</span>
              <Disponibilidad valor={p.disponibilidad} />
            </p>
            {f.inspirada_en && <p className="tenue">Inspirada en {f.inspirada_en}.</p>}

            <dl className="detalles">
              <div>
                <dt>Presentación</dt>
                <dd>{p.presentacion_ml} ml</dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{f.categoria}</dd>
              </div>
              {f.es_arabe && (
                <div>
                  <dt>Origen</dt>
                  <dd>Árabe</dd>
                </div>
              )}
              <div>
                <dt>Disponibilidad</dt>
                <dd>{p.disponibilidad}</dd>
              </div>
            </dl>

            <div className="producto__acciones">
              <BotonWhatsApp mensaje={mensajeDeProducto({ nombre: f.nombre, presentacion_ml: p.presentacion_ml, precio: p.precio })}>
                {agotado ? 'Preguntar por WhatsApp' : 'Pedir por WhatsApp'}
              </BotonWhatsApp>
              <Link to="/catalogo" className="boton boton--secundario">
                Volver al catálogo
              </Link>
            </div>
            <p className="pequeno tenue">La compra se completa por WhatsApp. Aún no vendemos en línea.</p>
          </div>
        </div>
      </div>
      <Relacionados categoria={f.categoria} codigoActual={f.codigo} />
    </>
  );
}
