import { useState } from 'react';
import { api } from '../api/cliente.js';
import { useCarga } from '../util/ganchos.js';
import { fechaConHora } from '../util/formato.js';
import Boton from '../componentes/Boton.jsx';
import Etiqueta from '../componentes/Etiqueta.jsx';
import Icono from '../componentes/Icono.jsx';
import Segmentado from '../componentes/Segmentado.jsx';
import VentanaEntrada from '../componentes/VentanaEntrada.jsx';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados.jsx';

export default function Alertas() {
  const [vista, setVista] = useState('activa');
  const [entrada, setEntrada] = useState(null);
  const pendientes = useCarga(() => api('/api/alertas', { consulta: { estado: 'activa', limite: 100 } }), []);
  const atendidas = useCarga(() => api('/api/alertas', { consulta: { estado: 'resuelta', limite: 30 } }), []);

  const actual = vista === 'activa' ? pendientes : atendidas;
  const totalPendientes = pendientes.datos?.total ?? 0;

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1 className="titulo-l">Alertas de stock</h1>
          <p className="tenue">Se generan solas cuando un producto baja de su umbral y se resuelven al reponerlo.</p>
        </div>
        <Segmentado
          etiqueta="Estado de las alertas"
          valor={vista}
          onCambiar={setVista}
          opciones={[
            { valor: 'activa', texto: `Pendientes (${totalPendientes})` },
            { valor: 'resuelta', texto: 'Atendidas' },
          ]}
        />
      </div>

      <section className="tarjeta" aria-label={vista === 'activa' ? 'Alertas pendientes' : 'Alertas atendidas'}>
        {actual.error ? (
          <ErrorCarga error={actual.error} onReintentar={actual.recargar} />
        ) : actual.cargando && !actual.datos ? (
          <Cargando />
        ) : actual.datos.alertas.length === 0 ? (
          <Vacio>{vista === 'activa' ? 'No hay alertas pendientes. Todo el inventario está sobre su umbral.' : 'Todavía no hay alertas atendidas.'}</Vacio>
        ) : (
          actual.datos.alertas.map((a) => {
            const agotado = a.existencias_actuales === 0;
            return (
              <div key={a.id_alerta} className="alerta-fila">
                {vista === 'activa' && <Icono nombre="alert" className={agotado ? 'icono--peligro' : 'icono--aviso'} />}
                <div className="alerta-fila__datos">
                  <span className="cuerpo-fuerte">{a.producto}</span>
                  <span className="pequeno tenue">
                    {vista === 'activa'
                      ? `Existencias: ${a.existencias_actuales} · Umbral: ${a.umbral_actual} · ${fechaConHora(a.generada_en)}`
                      : `Generada ${fechaConHora(a.generada_en)} con ${a.existencias_al_generar} ${a.existencias_al_generar === 1 ? 'unidad' : 'unidades'} · Resuelta ${fechaConHora(a.resuelta_en)}`}
                  </span>
                </div>
                {vista === 'activa' ? (
                  <>
                    <Etiqueta estado={agotado ? 'Agotado' : 'Crítico'} />
                    <Boton variante="secundario" onClick={() => setEntrada({ id_producto: a.id_producto, nombre: a.producto })}>
                      Registrar entrada
                    </Boton>
                  </>
                ) : (
                  <span className="etiqueta etiqueta--normal">Atendida</span>
                )}
              </div>
            );
          })
        )}
      </section>

      {entrada && (
        <VentanaEntrada
          producto={entrada}
          onCerrar={() => setEntrada(null)}
          onGuardado={() => {
            pendientes.recargar();
            atendidas.recargar();
          }}
        />
      )}
    </div>
  );
}
