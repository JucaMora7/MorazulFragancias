import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactoProvider } from '../util/ContactoContext.jsx';
import Inicio, { elegirDestacados } from './Inicio.jsx';
import Contacto from './Contacto.jsx';
import { catalogo, fragancia, instalarFetch } from '../test/ayudas.jsx';

const agotada = (n) => fragancia(`AGO-00${n}`, `AGOTADA ${n}`, 'Dama', 'Agotado');
const buena = (n) => fragancia(`DIS-00${n}`, `DISPONIBLE ${n}`, 'Dama', n % 2 ? 'Disponible' : 'Pocas unidades');

describe('elegirDestacados', () => {
  it('pone primero las fragancias con existencias y completa con el resto', () => {
    const lista = [agotada(1), buena(1), agotada(2), buena(2), buena(3)];
    expect(elegirDestacados(lista).map((f) => f.codigo)).toEqual(['DIS-001', 'DIS-002', 'DIS-003', 'AGO-001']);
  });
  it('si no hay ninguna disponible muestra las primeras', () => {
    expect(elegirDestacados([agotada(1), agotada(2)], 4).map((f) => f.codigo)).toEqual(['AGO-001', 'AGO-002']);
  });
  it('respeta la cantidad pedida y una lista vacía', () => {
    expect(elegirDestacados([buena(1), buena(2), buena(3)], 2)).toHaveLength(2);
    expect(elegirDestacados([])).toEqual([]);
  });
});

const montar = (componente, rutas) => {
  instalarFetch({
    '/api/publico/contacto': () => ({ whatsapp: '573233278897', correo: 'MorazulFragancias@gmail.com', ciudad: 'Neiva, Huila', horario: null, direccion: null }),
    ...rutas,
  });
  render(
    <ContactoProvider>
      <MemoryRouter>{componente}</MemoryRouter>
    </ContactoProvider>
  );
};

describe('Inicio', () => {
  it('muestra la portada, cuatro destacados, las razones y el llamado a pedir', async () => {
    montar(<Inicio />, { '/api/publico/catalogo': () => catalogo([agotada(1), buena(1), buena(2), buena(3), buena(4), buena(5)]) });
    expect(screen.getByRole('heading', { level: 1, name: 'Fragancias con carácter, hechas para ti' })).toBeInTheDocument();
    expect(await screen.findByText('DISPONIBLE 1')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.queryByText('AGOTADA 1')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por qué elegir Morazul' })).toBeInTheDocument();
    expect(screen.getByText('Frasco de 30 ml para llevar a todas partes.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Listo para hacer tu pedido?' })).toBeInTheDocument();
  });

  it('la portada no usa fotos de otras marcas: solo la ilustración propia', () => {
    montar(<Inicio />, { '/api/publico/catalogo': () => catalogo([]) });
    const imagenes = [...document.querySelectorAll('.portada img')];
    expect(imagenes.length).toBe(1);
    // Vite incrusta el SVG pequeño como dato (data:), no como archivo remoto de otra marca.
    expect(imagenes[0].getAttribute('src')).toMatch(/^data:image\/svg\+xml|frasco-generico/);
  });

  it('si la API falla, el resto de la página sigue visible y se puede reintentar', async () => {
    montar(<Inicio />, { '/api/publico/catalogo': () => [{ error: { codigo: 'error_interno', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.' } }, 500] });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por qué elegir Morazul' })).toBeInTheDocument();
  });
});

describe('Contacto', () => {
  it('muestra WhatsApp, correo y ciudad, y oculta el horario y la dirección mientras no existan', async () => {
    montar(<Contacto />, {});
    expect(await screen.findByText('+57 323 327 8897')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MorazulFragancias@gmail.com' })).toHaveAttribute('href', 'mailto:MorazulFragancias@gmail.com');
    expect(screen.getByText('Neiva, Huila')).toBeInTheDocument();
    expect(screen.queryByText('HORARIO DE ATENCIÓN')).not.toBeInTheDocument();
    expect(screen.queryByText('DIRECCIÓN')).not.toBeInTheDocument();
  });

  it('muestra el horario y la dirección cuando el negocio los define', async () => {
    montar(<Contacto />, {
      '/api/publico/contacto': () => ({ whatsapp: '573233278897', correo: 'a@b.co', ciudad: 'Neiva, Huila', horario: 'Lunes a sábado, 8:00 a. m. a 6:00 p. m.', direccion: 'Calle 1 # 2-3' }),
    });
    expect(await screen.findByText('Lunes a sábado, 8:00 a. m. a 6:00 p. m.')).toBeInTheDocument();
    expect(screen.getByText('Calle 1 # 2-3')).toBeInTheDocument();
  });

  it('si la API de contacto no responde, usa los datos de siempre', async () => {
    montar(<Contacto />, { '/api/publico/contacto': () => [{ error: { codigo: 'error_interno', mensaje: 'x' } }, 500] });
    expect(await screen.findByText('+57 323 327 8897')).toBeInTheDocument();
  });

  it('el botón de pedido abre WhatsApp con el mensaje general', async () => {
    montar(<Contacto />, {});
    const enlace = await screen.findByRole('link', { name: /Escribir por WhatsApp/ });
    expect(new URL(enlace.href).searchParams.get('text')).toBe('Hola, quiero hacer un pedido en Morazul.');
  });
});
