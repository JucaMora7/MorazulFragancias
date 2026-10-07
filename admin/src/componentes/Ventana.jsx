import { useEffect, useRef } from 'react';
import Icono from './Icono.jsx';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Ventana modal accesible: se cierra con Escape o tocando el fondo, mantiene el foco dentro
// y lo devuelve al elemento que la abrió. En móvil se muestra como hoja inferior.
export default function Ventana({ titulo, onCerrar, ancha = false, pie, children }) {
  const contenedor = useRef(null);
  const anterior = useRef(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    anterior.current = document.activeElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const primero = contenedor.current?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    (primero || contenedor.current?.querySelector(ENFOCABLES))?.focus();

    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar.current();
      }
      if (e.key === 'Tab' && contenedor.current) {
        const lista = [...contenedor.current.querySelectorAll(ENFOCABLES)];
        if (!lista.length) return;
        const primeroLista = lista[0];
        const ultimo = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === primeroLista) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeroLista.focus();
        }
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = original;
      anterior.current?.focus?.();
    };
  }, []);

  return (
    <div className="ventana-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={contenedor} className={`ventana${ancha ? ' ventana--ancha' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="ventana__encabezado">
          <h2 className="titulo-s">{titulo}</h2>
          <button type="button" className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="x" />
          </button>
        </div>
        <div className="ventana__cuerpo">{children}</div>
        {pie && <div className="ventana__pie">{pie}</div>}
      </div>
    </div>
  );
}
