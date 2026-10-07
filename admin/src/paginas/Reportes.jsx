import { useState } from 'react';
import { api } from '../api/cliente.js';
import { useCarga } from '../util/ganchos.js';
import { diaMesCorto, hoyISO, numero, pesos, plural, rangoTexto, sumarDias } from '../util/formato.js';
import Segmentado from '../componentes/Segmentado.jsx';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados.jsx';

const PERIODOS = { hoy: 0, '7': 6, '30': 29 };

function Indicador({ titulo, valor, detalle }) {
  return (
    <div className="tarjeta indicador">
      <p className="pequeno tenue">{titulo}</p>
      <p className="numero-grande">{valor}</p>
      <p className="pequeno tenue">{detalle}</p>
    </div>
  );
}

function Ranking({ titulo, id, filas, maximo, tenue = false, detalle }) {
  return (
    <section className="tarjeta" aria-labelledby={id}>
      <div className="tarjeta__encabezado">
        <h2 className="titulo-s" id={id}>
          {titulo}
        </h2>
      </div>
      {filas.length === 0 ? (
        <Vacio>No hay productos para mostrar en este periodo.</Vacio>
      ) : (
        <ol className="ranking">
          {filas.map((f) => (
            <li key={`${f.id_producto ?? f.id_fragancia}`} className="ranking__fila">
              <div className="ranking__datos">
                <span>
                  {f.nombre}
                  {detalle && <span className="pequeno tenue" style={{ display: 'block' }}>{detalle(f)}</span>}
                </span>
                <span className="tenue" style={{ whiteSpace: 'nowrap' }}>
                  {numero(f.unidades_vendidas)} {plural(f.unidades_vendidas, 'unidad', 'unidades')}
                </span>
              </div>
              <div className="ranking__barra" aria-hidden="true">
                <div className={`ranking__relleno${tenue ? ' ranking__relleno--tenue' : ''}`} style={{ width: `${maximo ? Math.max((f.unidades_vendidas / maximo) * 100, 0) : 0}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function GraficaDiaria({ dias }) {
  const maximo = Math.max(...dias.map((d) => d.ingresos), 0);
  const resumen = `Ventas por día del ${dias[0].fecha} al ${dias[dias.length - 1].fecha}`;
  return (
    <div>
      <div className="grafica" role="img" aria-label={resumen}>
        {dias.map((d) => (
          <div
            key={d.fecha}
            className={`grafica__columna${d.ingresos === 0 ? ' grafica__columna--vacia' : ''}`}
            style={{ height: d.ingresos === 0 ? '3px' : `${Math.max((d.ingresos / maximo) * 100, 3)}%` }}
            title={`${diaMesCorto(d.fecha)}: ${pesos(d.ingresos)} (${d.ventas} ${plural(d.ventas, 'venta', 'ventas')})`}
          />
        ))}
      </div>
      <div className="grafica__eje pequeno tenue">
        <span>{diaMesCorto(dias[0].fecha)}</span>
        <span>{diaMesCorto(dias[dias.length - 1].fecha)}</span>
      </div>
    </div>
  );
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState('30');
  const hasta = hoyISO();
  const desde = sumarDias(hasta, -PERIODOS[periodo]);
  const rango = { desde, hasta };

  const ventas = useCarga(() => api('/api/reportes/ventas', { consulta: rango }), [desde, hasta]);
  const mas = useCarga(() => api('/api/reportes/mas-vendidos', { consulta: { ...rango, limite: 5 } }), [desde, hasta]);
  const menos = useCarga(() => api('/api/reportes/menos-vendidos', { consulta: { ...rango, limite: 5 } }), [desde, hasta]);

  const todas = [ventas, mas, menos];
  const error = todas.find((c) => c.error)?.error;

  const maximo = Math.max(...(mas.datos?.ranking ?? []).map((f) => f.unidades_vendidas), ...(menos.datos?.ranking ?? []).map((f) => f.unidades_vendidas), 0);
  const t = ventas.datos?.totales;

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1 className="titulo-l">Reporte de ventas</h1>
          <p className="tenue">{rangoTexto(desde, hasta)}</p>
        </div>
        <div className="pagina__acciones">
          <Segmentado
            etiqueta="Periodo"
            valor={periodo}
            onCambiar={setPeriodo}
            opciones={[
              { valor: 'hoy', texto: 'Hoy' },
              { valor: '7', texto: '7 días' },
              { valor: '30', texto: '30 días' },
            ]}
          />
        </div>
      </div>

      {error ? (
        <ErrorCarga error={error} onReintentar={() => todas.forEach((c) => c.recargar())} />
      ) : !ventas.datos || !mas.datos || !menos.datos ? (
        <Cargando />
      ) : (
        <>
          <div className="indicadores indicadores--tres">
            <Indicador titulo="Ventas del periodo" valor={pesos(t.ingresos)} detalle={`${numero(t.ventas)} ${plural(t.ventas, 'venta', 'ventas')} · ticket promedio ${pesos(t.ticket_promedio)}`} />
            <Indicador titulo="Unidades vendidas" valor={numero(t.unidades)} detalle={`en ${numero(t.productos_vendidos)} ${plural(t.productos_vendidos, 'producto', 'productos')}`} />
            <Indicador
              titulo="Productos sin ventas"
              valor={numero(t.productos_sin_ventas)}
              detalle={t.productos_sin_ventas === 0 ? 'todos los que tienen existencias vendieron algo' : 'con existencias y sin ninguna venta'}
            />
          </div>

          <section className="tarjeta" aria-labelledby="titulo-dias">
            <div className="tarjeta__encabezado">
              <h2 className="titulo-s" id="titulo-dias">
                Ventas por día
              </h2>
            </div>
            <div className="tarjeta__cuerpo">
              {t.ventas === 0 ? <Vacio>No hay ventas en este periodo.</Vacio> : <GraficaDiaria dias={ventas.datos.por_dia} />}
            </div>
          </section>

          <div className="columnas columnas--iguales">
            <Ranking titulo="Más vendidos" id="titulo-mas" filas={mas.datos.ranking} maximo={maximo} />
            <Ranking
              titulo="Menos vendidos"
              id="titulo-menos"
              filas={menos.datos.ranking}
              maximo={maximo}
              tenue
              detalle={(f) => `${numero(f.existencias)} en stock`}
            />
          </div>
        </>
      )}
    </div>
  );
}
