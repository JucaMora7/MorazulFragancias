import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api/cliente.js';
import { useRetraso } from '../util/ganchos.js';

// Selector con búsqueda de presentaciones (patrón "combobox" accesible).
// Busca por nombre o código en el servidor; no muestra productos inactivos.
export default function SelectorProducto({ etiqueta = 'Producto', valor, onElegir, placeholder = 'Busca por nombre o código' }) {
  const id = useId();
  const [texto, setTexto] = useState(valor?.nombre ?? '');
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);
  const retrasado = useRetraso(texto, 250);
  const contenedor = useRef(null);

  useEffect(() => setTexto(valor?.nombre ?? ''), [valor]);

  useEffect(() => {
    if (!abierto || valor || retrasado.trim().length < 2) {
      setResultados([]);
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    api('/api/productos', { consulta: { q: retrasado.trim(), limite: 20 } })
      .then((r) => {
        if (!vigente) return;
        setResultados(r.productos.filter((p) => p.estado !== 'inactivo'));
        setActivo(0);
      })
      .catch(() => vigente && setResultados([]))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [retrasado, abierto, valor]);

  useEffect(() => {
    const fuera = (e) => contenedor.current && !contenedor.current.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function elegir(p) {
    onElegir(p);
    setAbierto(false);
  }

  function alTeclear(e) {
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) return setAbierto(true);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && abierto && resultados[activo]) {
      e.preventDefault();
      elegir(resultados[activo]);
    } else if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  }

  const hayBusqueda = abierto && !valor && texto.trim().length >= 2;

  return (
    <div className="campo selector" ref={contenedor}>
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        className="campo__control"
        role="combobox"
        aria-expanded={hayBusqueda}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={hayBusqueda && resultados[activo] ? `${id}-op-${resultados[activo].id_producto}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={texto}
        onChange={(e) => {
          if (valor) onElegir(null);
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
      />
      {hayBusqueda && (
        <ul id={`${id}-lista`} className="selector__lista" role="listbox" aria-label="Productos encontrados">
          {resultados.map((p, i) => (
            <li
              key={p.id_producto}
              id={`${id}-op-${p.id_producto}`}
              role="option"
              aria-selected={i === activo}
              className="selector__opcion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(p)}
            >
              <span className="cuerpo-fuerte">{p.nombre}</span>
              <span className="pequeno tenue">
                {p.codigo} · Quedan {p.existencias} · {p.estado_stock}
              </span>
            </li>
          ))}
          {!resultados.length && <li className="selector__vacio">{cargando ? 'Buscando…' : 'No se encontraron productos.'}</li>}
        </ul>
      )}
    </div>
  );
}
