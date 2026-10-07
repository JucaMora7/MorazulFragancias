import { useState } from 'react';
import { api } from '../api/cliente.js';
import { useCarga } from '../util/ganchos.js';
import { useAvisos } from './Avisos.jsx';
import Boton from './Boton.jsx';
import Ventana from './Ventana.jsx';
import { Cargando, ErrorCarga, Mensaje } from './Estados.jsx';

const CLAVE = 'mostrar_inspirada_en';

export default function AjustesCatalogo({ onCerrar }) {
  const avisos = useAvisos();
  const carga = useCarga(() => api('/api/configuracion'), []);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [valor, setValor] = useState(null);

  const actual = valor ?? carga.datos?.configuracion.find((c) => c.clave === CLAVE)?.valor === 'true';

  async function cambiar(e) {
    const nuevo = e.target.checked;
    setError('');
    setEnviando(true);
    try {
      await api(`/api/configuracion/${CLAVE}`, { metodo: 'PUT', cuerpo: { valor: nuevo } });
      setValor(nuevo);
      avisos.mostrar(nuevo ? 'La landing ahora muestra "inspirada en".' : 'La landing ya no muestra "inspirada en".');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Ventana titulo="Ajustes del catálogo" onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Listo</Boton>}>
      {carga.error ? (
        <ErrorCarga error={carga.error} onReintentar={carga.recargar} />
      ) : !carga.datos ? (
        <Cargando />
      ) : (
        <>
          <label className="casilla">
            <input type="checkbox" checked={actual} onChange={cambiar} disabled={enviando} />
            <span>
              <span className="cuerpo-fuerte">Mostrar “inspirada en” en la landing</span>
              <span className="pequeno tenue" style={{ display: 'block' }}>
                Muestra la marca de referencia de cada fragancia en el catálogo público. Está apagado hasta que la dueña del negocio lo apruebe.
              </span>
            </span>
          </label>
          <Mensaje>{error}</Mensaje>
        </>
      )}
    </Ventana>
  );
}
