import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContactoProvider } from '../util/ContactoContext.jsx';
import Detalle from './Detalle.jsx';
import { CATEGORIAS, catalogo, fragancia, instalarFetch } from '../test/ayudas.jsx';

const A = fragancia('CAB-001', 'ASAD LATTAFA', 'Caballero', 'Disponible', { es_arabe: true, inspirada_en: 'LATTAFA' });
const OTRA1 = fragancia('CAB-002', '212 MEN NYC', 'Caballero', 'Pocas unidades');
const OTRA2 = fragancia('CAB-003', '212 VIP MEN', 'Caballero');

function montar(rutas, codigo = 'CAB-001') {
  const fetch = instalarFetch({
    '/api/publico/contacto': () => ({ whatsapp: '573233278897', correo: 'a@b.co', ciudad: 'Neiva, Huila', horario: null, direccion: null }),
    '/api/publico/categorias': () => CATEGORIAS,
    '/api/publico/catalogo': () => catalogo([A, OTRA1, OTRA2]),
    ...rutas,
  });
  render(
    <ContactoProvider>
      <MemoryRouter initialEntries={[`/producto/${codigo}`]}>
        <Routes>
          <Route path="/producto/:codigo" element={<Detalle />} />
          <Route path="/catalogo" element={<p>Pantalla del catálogo</p>} />
        </Routes>
      </MemoryRouter>
    </ContactoProvider>
  );
  return fetch;
}

describe('Detalle de producto', () => {
  it('muestra nombre, precio, presentación y disponibilidad', async () => {
    montar({ '/api/publico/catalogo/CAB-001': () => ({ fragancia: A }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'ASAD LATTAFA' })).toBeInTheDocument();
    expect(screen.getByText('$ 20.000')).toBeInTheDocument();
    expect(screen.getByText('30 ml')).toBeInTheDocument();
    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0);
    expect(screen.getByText('La compra se completa por WhatsApp. Aún no vendemos en línea.')).toBeInTheDocument();
    expect(document.title).toBe('ASAD LATTAFA 30 ml · Morazul Fragancias');
  });

  it('el botón de pedido abre WhatsApp con el mensaje del producto', async () => {
    montar({ '/api/publico/catalogo/CAB-001': () => ({ fragancia: A }) });
    const enlace = await screen.findByRole('link', { name: /Pedir por WhatsApp/ });
    const url = new URL(enlace.href);
    expect(url.origin + url.pathname).toBe('https://wa.me/573233278897');
    expect(url.searchParams.get('text')).toBe('Hola, me interesa ASAD LATTAFA de 30 ml ($ 20.000). ¿Está disponible?');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('un producto agotado lo indica con texto y cambia el botón a "Preguntar"', async () => {
    const agotada = fragancia('CAB-001', 'ASAD LATTAFA', 'Caballero', 'Agotado');
    montar({ '/api/publico/catalogo/CAB-001': () => ({ fragancia: agotada }) });
    expect(await screen.findByRole('link', { name: /Preguntar por WhatsApp/ })).toBeInTheDocument();
    expect(screen.getAllByText('Agotado').length).toBeGreaterThan(0);
  });

  it('muestra "inspirada en" y el origen árabe solo cuando la API los entrega', async () => {
    montar({ '/api/publico/catalogo/CAB-001': () => ({ fragancia: A }) });
    expect(await screen.findByText('Inspirada en LATTAFA.')).toBeInTheDocument();
    expect(screen.getByText('Árabe')).toBeInTheDocument();
  });

  it('no muestra "inspirada en" si la API no lo entrega (interruptor apagado)', async () => {
    const sinMarca = { ...A, inspirada_en: null, es_arabe: false };
    montar({ '/api/publico/catalogo/CAB-001': () => ({ fragancia: sinMarca }) });
    await screen.findByRole('heading', { level: 1, name: 'ASAD LATTAFA' });
    expect(screen.queryByText(/Inspirada en/)).not.toBeInTheDocument();
    expect(screen.queryByText('Origen')).not.toBeInTheDocument();
  });

  it('sugiere otras fragancias de la misma categoría, sin repetir la actual', async () => {
    montar({ '/api/publico/catalogo/CAB-001': () => ({ fragancia: A }) });
    expect(await screen.findByRole('heading', { name: 'También te puede gustar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalle de 212 MEN NYC' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalle de 212 VIP MEN' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver detalle de ASAD LATTAFA' })).not.toBeInTheDocument();
  });

  it('un código que no existe muestra la página de no encontrado', async () => {
    montar({ '/api/publico/catalogo/XXX-999': () => [{ error: { codigo: 'no_encontrado', mensaje: 'La fragancia no existe' } }, 404] }, 'XXX-999');
    expect(await screen.findByText('No encontramos lo que buscas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/catalogo');
    expect(document.title).toBe('Producto no encontrado · Morazul Fragancias');
  });

  it('si la API falla (no es un 404) deja reintentar', async () => {
    montar({ '/api/publico/catalogo/CAB-001': () => [{ error: { codigo: 'error_interno', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.' } }, 500] });
    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
