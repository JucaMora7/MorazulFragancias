import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { obtener } from '../api/cliente.js';
import { useCarga, useRetraso, useTitulo } from '../util/ganchos.js';
import { numero, plural } from '../util/formato.js';
import TarjetaProducto from '../componentes/TarjetaProducto.jsx';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados.jsx';

const POR_PAGINA = 12;

export default function Catalogo() {
  useTitulo('Catálogo');
  const [params, setParams] = useSearchParams();
  const categoria = params.get('categoria') || '';
  const arabes = params.get('arabes') === '1';
  const q = params.get('q') || '';
  const pagina = Math.max(1, Number.parseInt(params.get('pagina') || '1', 10) || 1);

  // La búsqueda se escribe en el campo y se aplica a la dirección con una pequeña espera.
  const [texto, setTexto] = useState(q);
  const textoRetrasado = useRetraso(texto.trim(), 350);
  useEffect(() => setTexto(q), [q]);

  const cambiar = (cambios) => {
    const nuevos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === '' || v === null || v === undefined || v === false) nuevos.delete(k);
      else nuevos.set(k, v === true ? '1' : String(v));
    }
    if (!('pagina' in cambios)) nuevos.delete('pagina');
    setParams(nuevos, { replace: true });
  };

  useEffect(() => {
    if (textoRetrasado !== q) cambiar({ q: textoRetrasado });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoRetrasado]);

  const categorias = useCarga(() => obtener('/api/publico/categorias'), []);
  const lista = useCarga(
    () => obtener('/api/publico/catalogo', { categoria, arabes: arabes ? 'true' : undefined, q: q || undefined, pagina, limite: POR_PAGINA }),
    [categoria, arabes, q, pagina]
  );

  const d = lista.datos;
  const hayFiltros = Boolean(categoria || arabes || q);

  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Catálogo</h1>
      <p className="tenue">Explora nuestras lociones y perfumes. Los pedidos se hacen por WhatsApp.</p>

      <div className="filtros">
        <div className="chips" role="group" aria-label="Filtrar por categoría">
          <button type="button" className="chip" aria-pressed={!categoria && !arabes} onClick={() => cambiar({ categoria: '', arabes: false })}>
            Todos
          </button>
          {categorias.datos?.categorias.map((c) => (
            <button key={c.id_categoria} type="button" className="chip" aria-pressed={categoria === String(c.id_categoria)} onClick={() => cambiar({ categoria: c.id_categoria, arabes: false })}>
              {c.nombre}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={arabes} onClick={() => cambiar({ arabes: !arabes, categoria: '' })}>
            Árabes
          </button>
        </div>
        <div className="buscador">
          <label className="solo-lectores" htmlFor="buscar-catalogo">
            Buscar fragancia por nombre
          </label>
          <input id="buscar-catalogo" type="search" className="entrada" placeholder="Buscar por nombre" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" maxLength={80} />
        </div>
      </div>

      {lista.error ? (
        <ErrorCarga error={lista.error} onReintentar={lista.recargar} />
      ) : !d ? (
        <Cargando />
      ) : d.fragancias.length === 0 ? (
        <Vacio>
          <p>No encontramos fragancias con esos filtros.</p>
          {hayFiltros && (
            <button type="button" className="boton boton--secundario" onClick={() => { setTexto(''); setParams({}, { replace: true }); }}>
              Ver todo el catálogo
            </button>
          )}
        </Vacio>
      ) : (
        <>
          <p className="pequeno tenue" role="status">
            {numero(d.total)} {plural(d.total, 'fragancia', 'fragancias')}
          </p>
          <div className="cuadricula cuadricula--tres">
            {d.fragancias.map((f) => (
              <TarjetaProducto key={f.codigo} fragancia={f} />
            ))}
          </div>
          {d.total_paginas > 1 && (
            <nav className="paginacion" aria-label="Páginas del catálogo">
              <button type="button" className="boton boton--secundario" disabled={pagina <= 1} onClick={() => cambiar({ pagina: pagina - 1 })}>
                Anterior
              </button>
              <span className="tenue">
                Página {d.pagina} de {d.total_paginas}
              </span>
              <button type="button" className="boton boton--secundario" disabled={pagina >= d.total_paginas} onClick={() => cambiar({ pagina: pagina + 1 })}>
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
