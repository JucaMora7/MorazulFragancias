import { useState } from 'react';
import { api } from '../api/cliente.js';
import { useCarga, useRetraso } from '../util/ganchos.js';
import { pesos } from '../util/formato.js';
import Boton from '../componentes/Boton.jsx';
import Etiqueta from '../componentes/Etiqueta.jsx';
import Icono from '../componentes/Icono.jsx';
import Paginacion from '../componentes/Paginacion.jsx';
import FichaProducto from '../componentes/FichaProducto.jsx';
import FormFragancia from '../componentes/FormFragancia.jsx';
import AjustesCatalogo from '../componentes/AjustesCatalogo.jsx';
import VentanaEntrada from '../componentes/VentanaEntrada.jsx';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados.jsx';

const POR_PAGINA = 20;

// El filtro "Estado" mezcla el estado del producto y su situación de stock, como en el diseño.
const FILTROS_ESTADO = {
  normal: { stock: 'normal' },
  critico: { stock: 'critico' },
  agotado: { stock: 'agotado' },
  inactivo: { estado: 'inactivo' },
  borrador: { estado: 'borrador' },
};

export default function Productos() {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState('');
  const [presentacion, setPresentacion] = useState('');
  const [pagina, setPagina] = useState(1);
  const [ventana, setVentana] = useState(null); // { tipo, ... }
  const q = useRetraso(busqueda.trim(), 300);

  const categorias = useCarga(() => api('/api/categorias'), []);
  const lista = useCarga(
    () =>
      api('/api/productos', {
        consulta: { q: q || undefined, categoria, presentacion, ...(FILTROS_ESTADO[estado] ?? {}), pagina, limite: POR_PAGINA },
      }),
    [q, categoria, estado, presentacion, pagina]
  );

  const d = lista.datos;
  const cambiarFiltro = (poner) => (e) => {
    poner(e.target.value);
    setPagina(1);
  };

  return (
    <div className="pagina">
      <h1 className="solo-lectores">Productos</h1>

      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="search" />
          <input
            className="entrada"
            type="search"
            aria-label="Buscar producto por nombre o código"
            placeholder="Buscar producto por nombre"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            autoComplete="off"
          />
        </div>
        <select className="filtro" aria-label="Filtrar por categoría" value={categoria} onChange={cambiarFiltro(setCategoria)}>
          <option value="">Categoría</option>
          {categorias.datos?.categorias.map((c) => (
            <option key={c.id_categoria} value={c.id_categoria}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select className="filtro" aria-label="Filtrar por estado" value={estado} onChange={cambiarFiltro(setEstado)}>
          <option value="">Estado</option>
          <option value="normal">Normal</option>
          <option value="critico">Crítico</option>
          <option value="agotado">Agotado</option>
          <option value="borrador">Borrador</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <select className="filtro" aria-label="Filtrar por presentación" value={presentacion} onChange={cambiarFiltro(setPresentacion)}>
          <option value="">Presentación</option>
          <option value="30">30 ml</option>
          <option value="60">60 ml</option>
          <option value="100">100 ml</option>
        </select>
        <div className="herramientas__fin pagina__acciones">
          <Boton variante="secundario" onClick={() => setVentana({ tipo: 'ajustes' })}>
            Ajustes del catálogo
          </Boton>
          <Boton onClick={() => setVentana({ tipo: 'fragancia', id: null })}>Nueva fragancia</Boton>
        </div>
      </div>

      <section className="tarjeta" aria-label="Lista de productos">
        {lista.error ? (
          <ErrorCarga error={lista.error} onReintentar={lista.recargar} />
        ) : !d ? (
          <Cargando />
        ) : d.productos.length === 0 ? (
          <Vacio>No se encontraron productos con esos filtros.</Vacio>
        ) : (
          <>
            <div className="tabla-envoltura solo-escritorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className="numerico">Precio</th>
                    <th className="numerico">Existencias</th>
                    <th className="numerico">Umbral</th>
                    <th>Estado</th>
                    <th>En landing</th>
                  </tr>
                </thead>
                <tbody>
                  {d.productos.map((p) => (
                    <tr
                      key={p.id_producto}
                      data-clic
                      tabIndex={0}
                      onClick={() => setVentana({ tipo: 'ficha', id: p.id_producto })}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setVentana({ tipo: 'ficha', id: p.id_producto }))}
                      aria-label={`Abrir ${p.nombre}`}
                    >
                      <td className="nombre">{p.nombre}</td>
                      <td>{p.categoria}</td>
                      <td className="numerico">{p.precio_venta === null ? '—' : pesos(p.precio_venta)}</td>
                      <td className="numerico">{p.existencias}</td>
                      <td className="numerico">{p.umbral_minimo}</td>
                      <td>
                        <Etiqueta estado={p.estado_stock} />
                      </td>
                      <td>{p.estado === 'activo' && p.visible_landing ? 'Sí' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="lista solo-movil">
              {d.productos.map((p) => (
                <li key={p.id_producto}>
                  <button type="button" className="lista__fila" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--line-default)', textAlign: 'left' }} onClick={() => setVentana({ tipo: 'ficha', id: p.id_producto })}>
                    <span className="lista__principal">
                      <span className="cuerpo-fuerte">{p.nombre}</span>
                      <span className="pequeno tenue">
                        {p.categoria} · {p.precio_venta === null ? 'Sin precio' : pesos(p.precio_venta)}
                      </span>
                      <span className="pequeno tenue">{p.existencias === 0 ? 'Sin existencias' : `Quedan ${p.existencias}`}</span>
                    </span>
                    <span className="lista__acciones">
                      <Etiqueta estado={p.estado_stock} />
                      <Icono nombre="chevron" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <Paginacion pagina={d.pagina} totalPaginas={d.total_paginas} mostrando={d.productos.length} total={d.total} onCambiar={setPagina} />
          </>
        )}
      </section>

      {ventana?.tipo === 'ficha' && (
        <FichaProducto
          idProducto={ventana.id}
          onCerrar={() => setVentana(null)}
          onCambio={lista.recargar}
          onEntrada={(producto) => setVentana({ tipo: 'entrada', producto })}
          onEditarFragancia={(id) => setVentana({ tipo: 'fragancia', id })}
        />
      )}
      {ventana?.tipo === 'fragancia' && <FormFragancia idFragancia={ventana.id} onCerrar={() => setVentana(null)} onGuardada={lista.recargar} />}
      {ventana?.tipo === 'entrada' && <VentanaEntrada producto={ventana.producto} onCerrar={() => setVentana(null)} onGuardado={lista.recargar} />}
      {ventana?.tipo === 'ajustes' && <AjustesCatalogo onCerrar={() => setVentana(null)} />}
    </div>
  );
}
