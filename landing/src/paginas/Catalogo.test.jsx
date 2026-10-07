import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Catalogo from './Catalogo.jsx';
import { CATEGORIAS, catalogo, fragancia, instalarFetch } from '../test/ayudas.jsx';

const A = fragancia('CAB-001', 'ASAD LATTAFA', 'Caballero', 'Disponible');
const B = fragancia('DAM-001', '212 SEXI', 'Dama', 'Pocas unidades');
const C = fragancia('CAB-002', '212 MEN NYC', 'Caballero', 'Agotado');

function Ubicacion() {
  const { pathname, search } = useLocation();
  return <p data-testid="url">{pathname + search}</p>;
}

function montar(rutas, entrada = '/catalogo') {
  const fetch = instalarFetch({ '/api/publico/categorias': () => CATEGORIAS, ...rutas });
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/catalogo" element={<><Catalogo /><Ubicacion /></>} />
      </Routes>
    </MemoryRouter>
  );
  return fetch;
}

describe('Catálogo', () => {
  it('lista las fragancias con precio, disponibilidad y enlace al detalle', async () => {
    montar({ '/api/publico/catalogo': () => catalogo([A, B, C]) });
    expect(await screen.findByText('ASAD LATTAFA')).toBeInTheDocument();
    expect(screen.getByText('3 fragancias')).toBeInTheDocument();
    expect(screen.getAllByText('$ 20.000')).toHaveLength(3);
    // Solo se avisa cuando no está plenamente disponible.
    expect(screen.getByText('Pocas unidades')).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalle de ASAD LATTAFA' })).toHaveAttribute('href', '/producto/CAB-001');
  });

  it('ofrece filtros por categoría y por origen árabe', async () => {
    montar({ '/api/publico/catalogo': () => catalogo([A]) });
    await screen.findByText('ASAD LATTAFA');
    for (const nombre of ['Todos', 'Caballero', 'Dama', 'Árabes']) expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('al elegir una categoría pide solo esa categoría y lo deja en la dirección', async () => {
    const { llamadas } = montar({ '/api/publico/catalogo': () => catalogo([A]) });
    await screen.findByText('ASAD LATTAFA');
    await userEvent.click(screen.getByRole('button', { name: 'Dama' }));
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/api/publico/catalogo' && l.consulta.categoria === '2')).toBe(true));
    expect(screen.getByTestId('url')).toHaveTextContent('/catalogo?categoria=2');
    expect(screen.getByRole('button', { name: 'Dama' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('el filtro de árabes reemplaza al de categoría', async () => {
    const { llamadas } = montar({ '/api/publico/catalogo': () => catalogo([A]) }, '/catalogo?categoria=2');
    await screen.findByText('ASAD LATTAFA');
    await userEvent.click(screen.getByRole('button', { name: 'Árabes' }));
    await waitFor(() => expect(llamadas.some((l) => l.consulta.arabes === 'true')).toBe(true));
    const ultima = llamadas.filter((l) => l.ruta === '/api/publico/catalogo').at(-1);
    expect(ultima.consulta.categoria).toBeUndefined();
    expect(screen.getByTestId('url')).toHaveTextContent('/catalogo?arabes=1');
  });

  it('busca por nombre después de una pequeña espera', async () => {
    const { llamadas } = montar({ '/api/publico/catalogo': () => catalogo([A]) });
    await screen.findByText('ASAD LATTAFA');
    await userEvent.type(screen.getByLabelText('Buscar fragancia por nombre'), 'asad');
    await waitFor(() => expect(llamadas.some((l) => l.consulta.q === 'asad')).toBe(true), { timeout: 3000 });
    expect(screen.getByTestId('url')).toHaveTextContent('q=asad');
  });

  it('pagina el catálogo', async () => {
    const { llamadas } = montar({ '/api/publico/catalogo': () => catalogo([A], { total: 25, total_paginas: 3 }) });
    await screen.findByText('Página 1 de 3');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(llamadas.some((l) => l.consulta.pagina === '2')).toBe(true));
  });

  it('sin resultados lo dice y permite volver a ver todo', async () => {
    montar({ '/api/publico/catalogo': () => catalogo([], { total: 0, total_paginas: 0 }) }, '/catalogo?q=zzz');
    expect(await screen.findByText('No encontramos fragancias con esos filtros.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todo el catálogo' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(/^\/catalogo$/));
  });

  it('si la API falla, muestra el error y deja reintentar', async () => {
    let intentos = 0;
    montar({
      '/api/publico/catalogo': () => (++intentos === 1 ? [{ error: { codigo: 'error_interno', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.' } }, 500] : catalogo([A])),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('ASAD LATTAFA')).toBeInTheDocument();
  });
});
