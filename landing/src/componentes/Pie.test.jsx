import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactoProvider } from '../util/ContactoContext.jsx';
import Pie from './Pie.jsx';
import { instalarFetch } from '../test/ayudas.jsx';

describe('Pie de página', () => {
  it('trae un enlace discreto de acceso al panel de administración', () => {
    instalarFetch({ '/api/publico/contacto': () => ({ whatsapp: '573233278897', correo: 'a@b.co', ciudad: 'Neiva, Huila', horario: null, direccion: null }) });
    render(
      <ContactoProvider>
        <MemoryRouter>
          <Pie />
        </MemoryRouter>
      </ContactoProvider>
    );
    const enlace = screen.getByRole('link', { name: 'Acceso administrador' });
    expect(enlace).toHaveAttribute('href', 'http://localhost:5173');
    // Es del mismo sitio de Morazul: abre en la misma pestaña, no en una nueva.
    expect(enlace).not.toHaveAttribute('target');
  });

  it('conserva los datos de contacto y la navegación', () => {
    instalarFetch({});
    render(
      <ContactoProvider>
        <MemoryRouter>
          <Pie />
        </MemoryRouter>
      </ContactoProvider>
    );
    expect(screen.getByText('WhatsApp: +57 323 327 8897')).toBeInTheDocument();
    for (const nombre of ['Inicio', 'Catálogo', 'Contacto']) expect(screen.getByRole('link', { name: nombre })).toBeInTheDocument();
  });
});
