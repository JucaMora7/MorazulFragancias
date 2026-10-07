import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const AvisosContext = createContext(null);

// Avisos breves (confirmaciones). Los errores que bloquean se muestran dentro del formulario.
export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const siguiente = useRef(1);

  const quitar = useCallback((id) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);
  const mostrar = useCallback(
    (texto) => {
      const id = siguiente.current++;
      setAvisos((lista) => [...lista, { id, texto }]);
      setTimeout(() => quitar(id), 5000);
    },
    [quitar]
  );

  const valor = useMemo(() => ({ mostrar }), [mostrar]);
  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="aviso">
            <span>{a.texto}</span>
            <button type="button" onClick={() => quitar(a.id)}>
              Cerrar
            </button>
          </div>
        ))}
      </div>
    </AvisosContext.Provider>
  );
}

export function useAvisos() {
  const contexto = useContext(AvisosContext);
  if (!contexto) throw new Error('useAvisos debe usarse dentro de AvisosProvider');
  return contexto;
}
