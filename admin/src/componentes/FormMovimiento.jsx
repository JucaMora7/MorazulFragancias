import { useState } from 'react';
import { api } from '../api/cliente.js';
import { useAvisos } from './Avisos.jsx';
import { Campo } from './Campo.jsx';
import Boton from './Boton.jsx';
import Segmentado from './Segmentado.jsx';
import SelectorProducto from './SelectorProducto.jsx';
import { Mensaje } from './Estados.jsx';

// Entradas y ajustes de inventario. Las salidas por venta solo ocurren al registrar una venta.
export default function FormMovimiento({ productoInicial = null, tipoInicial = 'entrada', onGuardado, onCancelar }) {
  const avisos = useAvisos();
  const [tipo, setTipo] = useState(tipoInicial);
  const [direccion, setDireccion] = useState('restar');
  const [producto, setProducto] = useState(productoInicial);
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!producto) return setError('Elige un producto.');
    if (!/^\d+$/.test(cantidad) || Number(cantidad) < 1) return setError('La cantidad debe ser un número entero mayor que cero.');
    if (tipo === 'ajuste' && motivo.trim().length < 3) return setError('Escribe el motivo del ajuste.');

    const valor = Number(cantidad) * (tipo === 'ajuste' && direccion === 'restar' ? -1 : 1);
    setEnviando(true);
    try {
      const r = await api('/api/inventario/movimientos', {
        metodo: 'POST',
        cuerpo: { id_producto: producto.id_producto, tipo, cantidad: valor, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) },
      });
      const etiquetaTipo = tipo === 'entrada' ? 'Entrada registrada' : 'Ajuste registrado';
      avisos.mostrar(
        `${etiquetaTipo}: ${r.producto.nombre} ahora tiene ${r.producto.existencias} ${r.producto.existencias === 1 ? 'unidad' : 'unidades'}.` +
          (r.alerta_activa ? ' Sigue en stock crítico.' : '')
      );
      setCantidad('');
      setMotivo('');
      setProducto(null);
      onGuardado?.(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Segmentado
        suave
        etiqueta="Tipo de movimiento"
        valor={tipo}
        onCambiar={setTipo}
        opciones={[
          { valor: 'entrada', texto: 'Entrada' },
          { valor: 'ajuste', texto: 'Ajuste' },
        ]}
      />
      <SelectorProducto valor={producto} onElegir={setProducto} />
      {tipo === 'ajuste' && (
        <Segmentado
          suave
          etiqueta="Dirección del ajuste"
          valor={direccion}
          onCambiar={setDireccion}
          opciones={[
            { valor: 'restar', texto: 'Restar unidades' },
            { valor: 'sumar', texto: 'Sumar unidades' },
          ]}
        />
      )}
      <Campo
        etiqueta="Cantidad"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
      />
      <Campo
        etiqueta={tipo === 'ajuste' ? 'Motivo del ajuste' : 'Nota (opcional)'}
        placeholder={tipo === 'ajuste' ? 'Ej.: frasco roto, conteo físico' : 'Ej.: compra al proveedor del 6 de octubre'}
        maxLength={200}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <Mensaje>{error}</Mensaje>
      <div style={{ display: 'flex', gap: 12 }}>
        {onCancelar && (
          <Boton variante="secundario" onClick={onCancelar}>
            Cancelar
          </Boton>
        )}
        <Boton type="submit" bloque={!onCancelar} style={onCancelar ? { flex: 1 } : undefined} disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar movimiento'}
        </Boton>
      </div>
    </form>
  );
}
