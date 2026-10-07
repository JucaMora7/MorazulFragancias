import { useState } from 'react';
import { api } from '../api/cliente.js';
import { useCarga } from '../util/ganchos.js';
import { pesos } from '../util/formato.js';
import { useAvisos } from './Avisos.jsx';
import { Campo } from './Campo.jsx';
import Boton from './Boton.jsx';
import Etiqueta from './Etiqueta.jsx';
import Ventana from './Ventana.jsx';
import { Cargando, ErrorCarga, Mensaje } from './Estados.jsx';

const soloDigitos = (t) => t.replace(/[^\d]/g, '').slice(0, 9);

function Dato({ titulo, children }) {
  return (
    <div className="ficha__dato">
      <span className="pequeno tenue">{titulo}</span>
      <span className="cuerpo-fuerte">{children}</span>
    </div>
  );
}

function Contenido({ producto: p, onCambio, onEntrada, onEditarFragancia }) {
  const avisos = useAvisos();
  const [precio, setPrecio] = useState(p.precio_venta === null ? '' : String(p.precio_venta));
  const [umbral, setUmbral] = useState(String(p.umbral_minimo));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const precioNuevo = precio === '' ? null : Number(precio);
  const hayCambios = precioNuevo !== p.precio_venta || Number(umbral || 0) !== p.umbral_minimo;

  async function ejecutar(peticion, mensaje) {
    setError('');
    setEnviando(true);
    try {
      await peticion();
      avisos.mostrar(mensaje);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function guardar(extra = {}, mensaje = 'Cambios guardados.') {
    if (precioNuevo !== null && precioNuevo <= 0) return setError('El precio debe ser mayor que cero.');
    const cuerpo = { ...extra };
    if (precioNuevo !== p.precio_venta) cuerpo.precio_venta = precioNuevo;
    if (Number(umbral || 0) !== p.umbral_minimo) cuerpo.umbral_minimo = Number(umbral || 0);
    if (!Object.keys(cuerpo).length) return setError('No hay cambios para guardar.');
    return ejecutar(() => api(`/api/productos/${p.id_producto}`, { metodo: 'PATCH', cuerpo }), mensaje);
  }

  const accion = (nombre, mensaje) => ejecutar(() => api(`/api/productos/${p.id_producto}/${nombre}`, { metodo: 'POST' }), mensaje);

  const publicado = p.estado === 'activo' && p.visible_landing;

  return (
    <div className="ficha">
      <div className="ficha__datos">
        <Dato titulo="Código">{p.codigo}</Dato>
        <Dato titulo="Categoría">{p.categoria}</Dato>
        <Dato titulo="Presentación">{p.presentacion_ml} ml</Dato>
        <Dato titulo="Existencias">{p.existencias}</Dato>
        <Dato titulo="Estado">
          <Etiqueta estado={p.estado_stock} />
        </Dato>
        <Dato titulo="En la landing">{publicado ? 'Sí' : 'No'}</Dato>
      </div>

      <div className="fila-campos">
        <Campo
          etiqueta="Precio de venta"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Sin precio"
          value={precio}
          onChange={(e) => setPrecio(soloDigitos(e.target.value))}
          ayuda={precio === '' ? 'Sin precio no se puede activar ni publicar.' : pesos(Number(precio))}
        />
        <Campo
          etiqueta="Umbral de stock crítico"
          inputMode="numeric"
          autoComplete="off"
          value={umbral}
          onChange={(e) => setUmbral(soloDigitos(e.target.value).slice(0, 5))}
          ayuda="Con esta cantidad o menos se genera una alerta."
        />
      </div>

      <Mensaje>{error}</Mensaje>
      {hayCambios && <Mensaje tipo="aviso">Hay cambios sin guardar. Guárdalos para poder cambiar el estado del producto.</Mensaje>}

      <div className="ficha__acciones">
        <Boton onClick={() => guardar()} disabled={enviando || !hayCambios}>
          Guardar cambios
        </Boton>
        {p.estado === 'borrador' && (
          <>
            <Boton variante="secundario" disabled={enviando} onClick={() => guardar({ publicar: true }, 'Producto publicado en la landing.')}>
              Guardar y publicar
            </Boton>
            <Boton variante="secundario" disabled={enviando} onClick={() => guardar({ activar: true }, 'Producto activado para la venta.')}>
              Guardar y activar sin publicar
            </Boton>
          </>
        )}
        {p.estado === 'inactivo' && (
          <Boton variante="secundario" disabled={enviando || hayCambios} onClick={() => accion('activar', 'Producto activado.')}>
            Activar
          </Boton>
        )}
        {p.estado === 'activo' && !p.visible_landing && (
          <Boton variante="secundario" disabled={enviando || hayCambios} onClick={() => accion('publicar', 'Producto publicado en la landing.')}>
            Publicar en la landing
          </Boton>
        )}
        {publicado && (
          <Boton variante="secundario" disabled={enviando || hayCambios} onClick={() => accion('despublicar', 'Producto quitado de la landing.')}>
            Quitar de la landing
          </Boton>
        )}
        {p.estado !== 'inactivo' && (
          <Boton variante="secundario" disabled={enviando || hayCambios} onClick={() => accion('inactivar', 'Producto inactivado.')}>
            Inactivar
          </Boton>
        )}
      </div>

      <div className="ficha__acciones">
        {p.estado !== 'inactivo' && (
          <Boton variante="texto" onClick={() => onEntrada({ id_producto: p.id_producto, nombre: p.nombre })}>
            Registrar entrada de inventario
          </Boton>
        )}
        <Boton variante="texto" onClick={() => onEditarFragancia(p.id_fragancia)}>
          Editar la fragancia (nombre, foto, categoría)
        </Boton>
      </div>
    </div>
  );
}

export default function FichaProducto({ idProducto, onCerrar, onCambio, onEntrada, onEditarFragancia }) {
  const carga = useCarga(() => api(`/api/productos/${idProducto}`), [idProducto]);
  return (
    <Ventana titulo={carga.datos ? carga.datos.producto.nombre : 'Producto'} onCerrar={onCerrar} ancha>
      {carga.error ? (
        <ErrorCarga error={carga.error} onReintentar={carga.recargar} />
      ) : !carga.datos ? (
        <Cargando />
      ) : (
        <Contenido
          key={`${carga.datos.producto.id_producto}-${carga.datos.producto.estado}-${carga.datos.producto.visible_landing}-${carga.datos.producto.precio_venta}-${carga.datos.producto.umbral_minimo}`}
          producto={carga.datos.producto}
          onCambio={() => {
            carga.recargar();
            onCambio();
          }}
          onEntrada={onEntrada}
          onEditarFragancia={onEditarFragancia}
        />
      )}
    </Ventana>
  );
}
