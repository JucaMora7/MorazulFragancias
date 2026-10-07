import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AvisosProvider } from '../componentes/Avisos.jsx';
import { CarritoProvider } from '../sesion/CarritoContext.jsx';
import NuevaVenta from './NuevaVenta.jsx';
import { instalarFetch } from '../test/ayudas.jsx';

const PRODUCTOS = [
  { id_producto: 1, nombre: 'ASAD LATTAFA 30 ml', precio_venta: 20000, existencias: 5, estado_stock: 'Normal' },
  { id_producto: 2, nombre: '212 MEN NYC 60 ml', precio_venta: 40000, existencias: 1, estado_stock: 'Crítico' },
];
const CAJA_ABIERTA = { fecha: '2026-10-07', caja: { id_caja: 1, estado: 'abierta', saldo_esperado: 100000 }, movimientos: [] };

function montar(rutas) {
  const fetch = instalarFetch({
    'GET /api/productos': () => ({ productos: PRODUCTOS, total: 2 }),
    ...rutas,
  });
  render(
    <AvisosProvider>
      <CarritoProvider>
        <MemoryRouter>
          <NuevaVenta />
        </MemoryRouter>
      </CarritoProvider>
    </AvisosProvider>
  );
  return fetch;
}

const agregar = (nombre) => userEvent.click(screen.getByRole('button', { name: `Agregar ${nombre}` }));
const carrito = () => screen.getByRole('heading', { name: 'Venta actual' }).closest('section');

describe('Nueva venta', () => {
  it('arma la venta, calcula el total y envía solo ids y cantidades', async () => {
    const { llamadas } = montar({
      'GET /api/caja/hoy': () => CAJA_ABIERTA,
      'POST /api/ventas': () => [{ venta: { id_venta: 7, total: 80000 } }, 201],
    });
    await screen.findByText('ASAD LATTAFA 30 ml');

    await agregar('ASAD LATTAFA 30 ml');
    await agregar('ASAD LATTAFA 30 ml');
    await agregar('212 MEN NYC 60 ml');

    const c = within(carrito());
    expect(c.getByText('2 productos')).toBeInTheDocument();
    expect(c.getByText('$ 80.000', { selector: '.titulo-l' })).toBeInTheDocument();

    await userEvent.click(c.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(llamadas.some((l) => l.clave === 'POST /api/ventas')).toBe(true));
    const envio = llamadas.find((l) => l.clave === 'POST /api/ventas');
    expect(envio.cuerpo).toEqual({
      items: [
        { id_producto: 1, cantidad: 2 },
        { id_producto: 2, cantidad: 1 },
      ],
    });
    expect(JSON.stringify(envio.cuerpo)).not.toMatch(/precio/);

    expect(await screen.findByText('Venta #0007 registrada por $ 80.000.')).toBeInTheDocument();
    expect(within(carrito()).getByText('0 productos')).toBeInTheDocument();
  });

  it('no deja pasar de las existencias', async () => {
    montar({ 'GET /api/caja/hoy': () => CAJA_ABIERTA });
    await screen.findByText('212 MEN NYC 60 ml');
    await agregar('212 MEN NYC 60 ml');
    expect(screen.getByRole('button', { name: 'Agregar 212 MEN NYC 60 ml' })).toBeDisabled();
  });

  it('los botones de cantidad suman, restan y quitan', async () => {
    montar({ 'GET /api/caja/hoy': () => CAJA_ABIERTA });
    await screen.findByText('ASAD LATTAFA 30 ml');
    await agregar('ASAD LATTAFA 30 ml');
    const c = within(carrito());
    await userEvent.click(c.getByRole('button', { name: 'Sumar una unidad de ASAD LATTAFA 30 ml' }));
    expect(c.getByRole('status')).toHaveTextContent('2');
    await userEvent.click(c.getByRole('button', { name: 'Restar una unidad de ASAD LATTAFA 30 ml' }));
    await userEvent.click(c.getByRole('button', { name: 'Quitar ASAD LATTAFA 30 ml' }));
    expect(c.getByText('Agrega productos de la lista para armar la venta.')).toBeInTheDocument();
  });

  it('con la caja cerrada o sin abrir no permite confirmar y avisa por qué', async () => {
    montar({ 'GET /api/caja/hoy': () => ({ fecha: '2026-10-07', caja: null, movimientos: [] }) });
    await screen.findByText('ASAD LATTAFA 30 ml');
    expect(await screen.findByText(/Abre la caja del día antes de registrar ventas/)).toBeInTheDocument();
    await agregar('ASAD LATTAFA 30 ml');
    expect(within(carrito()).getByRole('button', { name: 'Confirmar venta' })).toBeDisabled();
  });

  it('muestra cada problema que informa el servidor y conserva el carrito', async () => {
    montar({
      'GET /api/caja/hoy': () => CAJA_ABIERTA,
      'POST /api/ventas': () => [
        {
          error: {
            codigo: 'regla_de_negocio',
            mensaje: 'No se pudo registrar la venta: 2 productos con problemas',
            detalles: [
              { id_producto: 1, nombre: 'ASAD LATTAFA 30 ml', motivo: 'Existencias insuficientes', solicitado: 1, disponible: 0 },
              { id_producto: 2, nombre: '212 MEN NYC 60 ml', motivo: 'No está disponible para la venta' },
            ],
          },
        },
        422,
      ],
    });
    await screen.findByText('ASAD LATTAFA 30 ml');
    await agregar('ASAD LATTAFA 30 ml');
    await userEvent.click(within(carrito()).getByRole('button', { name: 'Confirmar venta' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('2 productos con problemas');
    expect(alerta).toHaveTextContent('ASAD LATTAFA 30 ml: pediste 1 y solo quedan 0.');
    expect(alerta).toHaveTextContent('212 MEN NYC 60 ml: No está disponible para la venta.');
    expect(within(carrito()).getByText('1 producto')).toBeInTheDocument();
  });

  it('cancelar la venta vacía el carrito', async () => {
    montar({ 'GET /api/caja/hoy': () => CAJA_ABIERTA });
    await screen.findByText('ASAD LATTAFA 30 ml');
    await agregar('ASAD LATTAFA 30 ml');
    await userEvent.click(within(carrito()).getByRole('button', { name: 'Cancelar venta' }));
    expect(within(carrito()).getByText('0 productos')).toBeInTheDocument();
  });
});
