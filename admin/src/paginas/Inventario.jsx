import { useState } from 'react';
import { api } from '../api/cliente.js';
import { useCarga } from '../util/ganchos.js';
import { fechaHoraCorta } from '../util/formato.js';
import FormMovimiento from '../componentes/FormMovimiento.jsx';
import Paginacion from '../componentes/Paginacion.jsx';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados.jsx';

const TIPOS = { entrada: 'Entrada', venta: 'Venta', ajuste: 'Ajuste' };
const POR_PAGINA = 20;

export default function Inventario() {
  const [pagina, setPagina] = useState(1);
  const historial = useCarga(() => api('/api/inventario/movimientos', { consulta: { pagina, limite: POR_PAGINA } }), [pagina]);
  const d = historial.datos;

  return (
    <div className="pagina">
      <h1 className="solo-lectores">Inventario</h1>
      <div className="columnas columnas--formulario">
        <section className="tarjeta" aria-labelledby="titulo-form">
          <div className="tarjeta__encabezado">
            <h2 className="titulo-s" id="titulo-form">
              Registrar movimiento
            </h2>
          </div>
          <div className="tarjeta__cuerpo">
            <FormMovimiento onGuardado={() => (pagina === 1 ? historial.recargar() : setPagina(1))} />
          </div>
        </section>

        <section className="tarjeta" aria-labelledby="titulo-historial">
          <div className="tarjeta__encabezado">
            <h2 className="titulo-s" id="titulo-historial">
              Historial de movimientos
            </h2>
          </div>
          {historial.error ? (
            <ErrorCarga error={historial.error} onReintentar={historial.recargar} />
          ) : !d ? (
            <Cargando />
          ) : d.movimientos.length === 0 ? (
            <Vacio>Todavía no hay movimientos de inventario.</Vacio>
          ) : (
            <>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Tipo</th>
                      <th className="numerico">Cantidad</th>
                      <th className="numerico">Existencias tras mov.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.movimientos.map((m) => (
                      <tr key={m.id_movimiento}>
                        <td className="nombre" style={{ whiteSpace: 'nowrap' }}>
                          {fechaHoraCorta(m.fecha_hora)}
                        </td>
                        <td>
                          {m.producto}
                          {m.motivo && <span className="pequeno tenue" style={{ display: 'block' }}>{m.motivo}</span>}
                        </td>
                        <td>{TIPOS[m.tipo]}</td>
                        <td className="numerico">{m.cantidad > 0 ? `+${m.cantidad}` : `−${Math.abs(m.cantidad)}`}</td>
                        <td className="numerico">{m.existencias_resultantes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion
                pagina={d.pagina}
                totalPaginas={d.total_paginas}
                mostrando={d.movimientos.length}
                total={d.total}
                unidad="movimientos"
                onCambiar={setPagina}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
