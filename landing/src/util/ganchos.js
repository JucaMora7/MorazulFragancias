import { useEffect, useState } from 'react';

// Carga datos al montar y cuando cambian las dependencias. Ignora respuestas de consultas viejas.
export function useCarga(cargador, dependencias = []) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    cargador()
      .then((datos) => vigente && setEstado({ datos, cargando: false, error: null }))
      .catch((error) => vigente && setEstado({ datos: null, cargando: false, error }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version]);

  return { ...estado, recargar: () => setVersion((v) => v + 1) };
}

export function useRetraso(valor, ms = 350) {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}

// Título de la pestaña por página.
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Morazul Fragancias` : 'Morazul Fragancias · Lociones y perfumes en Neiva';
  }, [titulo]);
}
