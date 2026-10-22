import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SesionProvider } from '../sesion/SesionContext.jsx';
import Layout from './Layout.jsx';
import Login from '../paginas/Login.jsx';
import { tokenDePrueba } from '../test/ayudas.jsx';

describe('Enlaces hacia la landing', () => {
  it('el menú del panel tiene "Ver sitio público", que se abre en una pestaña nueva y sin cerrar la sesión', () => {
    sessionStorage.setItem('morazul.sesion', JSON.stringify({ token: tokenDePrueba(), usuario: { nombre: 'Oscar', rol: 'administrador' } }));
    render(
      <SesionProvider>
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<p>Pantalla de inicio</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SesionProvider>
    );
    const enlace = screen.getByRole('link', { name: /Ver sitio público/ });
    expect(enlace).toHaveAttribute('href', 'http://localhost:5174');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'));
    // Sigue estando el cierre de sesión.
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('el inicio de sesión ofrece volver al sitio de Morazul', () => {
    render(
      <SesionProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </SesionProvider>
    );
    expect(screen.getByRole('link', { name: /Volver al sitio de Morazul/ })).toHaveAttribute('href', 'http://localhost:5174');
  });
});
