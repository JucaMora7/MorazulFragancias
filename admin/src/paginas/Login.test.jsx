import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SesionProvider } from '../sesion/SesionContext.jsx';
import Login from './Login.jsx';
import { instalarFetch, tokenDePrueba } from '../test/ayudas.jsx';

const montar = () =>
  render(
    <SesionProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<p>Pantalla de inicio</p>} />
        </Routes>
      </MemoryRouter>
    </SesionProvider>
  );

describe('Inicio de sesión', () => {
  it('pide correo y contraseña antes de llamar a la API', async () => {
    const { falso } = instalarFetch({});
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe tu correo electrónico.');
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'admin@morazul.test');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe tu contraseña.');
    expect(falso).not.toHaveBeenCalled();
  });

  it('muestra el error de la API cuando las credenciales son incorrectas', async () => {
    instalarFetch({ 'POST /api/auth/login': () => [{ error: { codigo: 'no_autenticado', mensaje: 'Correo o contraseña incorrectos' } }, 401] });
    montar();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'admin@morazul.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala-clave');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
    expect(sessionStorage.getItem('morazul.sesion')).toBeNull();
  });

  it('inicia sesión y pasa a la pantalla de inicio', async () => {
    const { llamadas } = instalarFetch({
      'POST /api/auth/login': () => ({ token: tokenDePrueba(), usuario: { id_usuario: 1, nombre: 'Oscar', correo: 'admin@morazul.test', rol: 'administrador' } }),
    });
    montar();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), '  admin@morazul.test ');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-correcta');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(screen.getByText('Pantalla de inicio')).toBeInTheDocument());
    expect(llamadas[0].cuerpo).toEqual({ correo: 'admin@morazul.test', contrasena: 'clave-correcta' });
  });

  it('muestra el aviso de demasiados intentos', async () => {
    instalarFetch({ 'POST /api/auth/login': () => [{ error: { codigo: 'demasiados_intentos', mensaje: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' } }, 429] });
    montar();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos');
  });
});
