import { useRef, useState } from 'react';
import { pesos } from '../util/formato.js';
import { api } from '../api/cliente.js';
import { useCarga } from '../util/ganchos.js';
import { useAvisos } from './Avisos.jsx';
import { Campo, CampoSelect } from './Campo.jsx';
import Boton from './Boton.jsx';
import Ventana from './Ventana.jsx';
import { Cargando, ErrorCarga, Mensaje } from './Estados.jsx';

const MAX_BYTES = 3 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

function validarFoto(archivo) {
  if (!TIPOS.includes(archivo.type)) return 'La foto debe ser JPG, PNG o WebP.';
  if (archivo.size > MAX_BYTES) return 'La foto no puede pesar más de 3 MB.';
  return '';
}

function Formulario({ fragancia, categorias, onCerrar, onGuardada }) {
  const avisos = useAvisos();
  const edicion = Boolean(fragancia);
  const entradaFoto = useRef(null);
  const [nombre, setNombre] = useState(fragancia?.nombre ?? '');
  const [categoria, setCategoria] = useState(fragancia ? String(fragancia.id_categoria) : '');
  const [inspirada, setInspirada] = useState(fragancia?.inspirada_en ?? '');
  const [arabe, setArabe] = useState(fragancia?.es_arabe ?? false);
  const [nota, setNota] = useState(fragancia?.nota ?? '');
  const [codigo, setCodigo] = useState('');
  const [pedirCodigo, setPedirCodigo] = useState(false);
  const [fotoNueva, setFotoNueva] = useState(null);
  const [fotoActual, setFotoActual] = useState(fragancia?.imagen_url ?? null);
  const [activa, setActiva] = useState(fragancia?.activa ?? true);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const subirFoto = async (id, archivo) => {
    const formulario = new FormData();
    formulario.append('imagen', archivo);
    return api(`/api/fragancias/${id}/imagen`, { metodo: 'POST', formulario });
  };

  function elegirFoto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const problema = validarFoto(archivo);
    if (problema) {
      setError(problema);
      e.target.value = '';
      return;
    }
    setError('');
    if (edicion) {
      // En edición la foto se sube de inmediato.
      setEnviando(true);
      subirFoto(fragancia.id_fragancia, archivo)
        .then((r) => {
          setFotoActual(r.fragancia.imagen_url);
          avisos.mostrar('Foto actualizada.');
          onGuardada(false);
        })
        .catch((err) => setError(err.message))
        .finally(() => {
          setEnviando(false);
          e.target.value = '';
        });
    } else {
      setFotoNueva(archivo);
    }
  }

  async function quitarFoto() {
    setError('');
    setEnviando(true);
    try {
      await api(`/api/fragancias/${fragancia.id_fragancia}/imagen`, { metodo: 'DELETE' });
      setFotoActual(null);
      avisos.mostrar('Foto quitada: se usará la imagen genérica.');
      onGuardada(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarActiva() {
    setError('');
    setEnviando(true);
    try {
      await api(`/api/fragancias/${fragancia.id_fragancia}/${activa ? 'inactivar' : 'reactivar'}`, { metodo: 'POST' });
      avisos.mostrar(activa ? 'Fragancia inactivada.' : 'Fragancia reactivada. Su producto quedó en borrador.');
      onGuardada(true);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
      setConfirmando(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (nombre.trim().length < 2) return setError('Escribe el nombre de la fragancia.');
    if (!categoria) return setError('Elige la categoría.');
    const datos = {
      nombre: nombre.trim(),
      id_categoria: Number(categoria),
      inspirada_en: inspirada.trim() || null,
      es_arabe: arabe,
      nota: nota.trim() || null,
    };
    setEnviando(true);
    try {
      if (edicion) {
        await api(`/api/fragancias/${fragancia.id_fragancia}`, { metodo: 'PATCH', cuerpo: datos });
        avisos.mostrar('Fragancia actualizada.');
      } else {
        const r = await api('/api/fragancias', { metodo: 'POST', cuerpo: { ...datos, ...(codigo.trim() ? { codigo: codigo.trim() } : {}) } });
        let mensaje = `Fragancia ${r.fragancia.codigo} creada. Su producto de 30 ml quedó en borrador con precio ${pesos(r.fragancia.presentaciones[0]?.precio_venta)}: publícalo cuando esté listo.`;
        if (fotoNueva) {
          try {
            await subirFoto(r.fragancia.id_fragancia, fotoNueva);
          } catch (err) {
            mensaje += ` La foto no se pudo subir (${err.message}); súbela desde la edición.`;
          }
        }
        avisos.mostrar(mensaje);
      }
      onGuardada(true);
    } catch (err) {
      if (!edicion && /c[oó]digo/i.test(err.message)) setPedirCodigo(true);
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Campo etiqueta="Nombre" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <CampoSelect etiqueta="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        <option value="">Elige una categoría</option>
        {categorias.map((c) => (
          <option key={c.id_categoria} value={c.id_categoria}>
            {c.nombre}
          </option>
        ))}
      </CampoSelect>
      <Campo etiqueta="Inspirada en (marca de referencia)" maxLength={80} value={inspirada} onChange={(e) => setInspirada(e.target.value)} ayuda="Solo se muestra en la landing si lo activas en los ajustes del catálogo." />
      <label className="casilla">
        <input type="checkbox" checked={arabe} onChange={(e) => setArabe(e.target.checked)} />
        <span>Es de origen árabe</span>
      </label>
      <Campo etiqueta="Nota interna (opcional)" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} />
      {pedirCodigo && (
        <Campo etiqueta="Código de la fragancia" placeholder="Ej.: UNI-011" maxLength={10} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} ayuda="Esta categoría aún no tiene fragancias: escribe el código completo (tres letras, guion y tres números)." />
      )}

      <div className="foto-edicion">
        {fotoActual ? <img className="foto" src={fotoActual} alt={`Foto de ${nombre}`} /> : <div className="foto foto--vacia">Sin foto propia: se usa la imagen genérica</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input ref={entradaFoto} type="file" accept="image/jpeg,image/png,image/webp" className="solo-lectores" id="foto-fragancia" onChange={elegirFoto} />
          <Boton variante="secundario" pequeno onClick={() => entradaFoto.current?.click()} disabled={enviando}>
            {fotoActual || fotoNueva ? 'Cambiar foto' : 'Subir foto'}
          </Boton>
          {edicion && fotoActual && (
            <Boton variante="texto" onClick={quitarFoto} disabled={enviando}>
              Quitar foto
            </Boton>
          )}
          {!edicion && fotoNueva && <span className="pequeno tenue">{fotoNueva.name}</span>}
          <span className="pequeno tenue">JPG, PNG o WebP, máximo 3 MB. Usa fotos propias de Morazul.</span>
        </div>
      </div>

      <Mensaje>{error}</Mensaje>

      {edicion && (
        <div style={{ borderTop: '1px solid var(--line-default)', paddingTop: 16 }}>
          {!confirmando ? (
            <Boton variante="secundario" onClick={() => setConfirmando(true)}>
              {activa ? 'Inactivar fragancia' : 'Reactivar fragancia'}
            </Boton>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Mensaje tipo="aviso">
                {activa
                  ? 'Saldrá de la landing y de las ventas. El historial se conserva.'
                  : 'Volverá como borrador: tendrás que publicarla de nuevo.'}
              </Mensaje>
              <div style={{ display: 'flex', gap: 12 }}>
                <Boton variante="secundario" onClick={() => setConfirmando(false)}>
                  No, volver
                </Boton>
                <Boton onClick={cambiarActiva} disabled={enviando}>
                  {activa ? 'Sí, inactivar' : 'Sí, reactivar'}
                </Boton>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ventana__pie" style={{ margin: '0 -20px -20px', padding: 16 }}>
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear fragancia'}
        </Boton>
      </div>
    </form>
  );
}

export default function FormFragancia({ idFragancia = null, onCerrar, onGuardada }) {
  const categorias = useCarga(() => api('/api/categorias'), []);
  const fragancia = useCarga(() => (idFragancia ? api(`/api/fragancias/${idFragancia}`) : Promise.resolve(null)), [idFragancia]);
  const error = categorias.error || fragancia.error;
  const lista = categorias.datos && (!idFragancia || fragancia.datos);

  return (
    <Ventana titulo={idFragancia ? 'Editar fragancia' : 'Nueva fragancia'} onCerrar={onCerrar} ancha>
      {error ? (
        <ErrorCarga error={error} onReintentar={() => { categorias.recargar(); fragancia.recargar(); }} />
      ) : !lista ? (
        <Cargando />
      ) : (
        <Formulario
          fragancia={fragancia.datos?.fragancia ?? null}
          categorias={categorias.datos.categorias}
          onCerrar={onCerrar}
          onGuardada={(cerrar) => {
            onGuardada();
            if (cerrar) onCerrar();
          }}
        />
      )}
    </Ventana>
  );
}
