import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SesionProvider, useSesion, vencimientoDelToken } from './SesionContext.jsx';
import { instalarFetch, tokenDePrueba } from '../test/ayudas.jsx';

function Sonda() {
  const { sesion, usuario, iniciarSesion, cerrarSesion } = useSesion();
  return (
    <div>
      <p data-testid="estado">{sesion ? `dentro:${usuario.nombre}` : 'fuera'}</p>
      <button onClick={() => iniciarSesion('admin@morazul.test', 'clave').catch((e) => (document.title = e.message))}>entrar</button>
      <button onClick={cerrarSesion}>salir</button>
    </div>
  );
}

const montar = () =>
  render(
    <SesionProvider>
      <Sonda />
    </SesionProvider>
  );

describe('vencimientoDelToken', () => {
  it('lee la fecha de vencimiento del payload', () => {
    const vence = Date.now() + 5000;
    expect(vencimientoDelToken(tokenDePrueba({ expiraEn: vence }))).toBe(Math.floor(vence / 1000) * 1000);
  });
  it('devuelve null con tokens mal formados', () => {
    expect(vencimientoDelToken('basura')).toBeNull();
    expect(vencimientoDelToken('a.b.c')).toBeNull();
  });
});

describe('sesión', () => {
  it('empieza sin sesión', () => {
    montar();
    expect(screen.getByTestId('estado')).toHaveTextContent('fuera');
  });

  it('inicia sesión, guarda el token solo en la pestaña y cierra sesión', async () => {
    instalarFetch({
      'POST /api/auth/login': () => ({ token: tokenDePrueba(), usuario: { id_usuario: 1, nombre: 'Oscar', correo: 'a@b.c', rol: 'administrador' } }),
    });
    montar();
    await act(async () => screen.getByText('entrar').click());
    expect(screen.getByTestId('estado')).toHaveTextContent('dentro:Oscar');
    expect(sessionStorage.getItem('morazul.sesion')).toContain('"token"');
    expect(localStorage.getItem('morazul.sesion')).toBeNull();

    await act(async () => screen.getByText('salir').click());
    expect(screen.getByTestId('estado')).toHaveTextContent('fuera');
    expect(sessionStorage.getItem('morazul.sesion')).toBeNull();
  });

  it('recupera una sesión guardada que todavía no vence', () => {
    sessionStorage.setItem('morazul.sesion', JSON.stringify({ token: tokenDePrueba(), usuario: { nombre: 'Oscar' } }));
    montar();
    expect(screen.getByTestId('estado')).toHaveTextContent('dentro:Oscar');
  });

  it('descarta una sesión guardada que ya venció', () => {
    sessionStorage.setItem('morazul.sesion', JSON.stringify({ token: tokenDePrueba({ expiraEn: Date.now() - 1000 }), usuario: { nombre: 'Oscar' } }));
    montar();
    expect(screen.getByTestId('estado')).toHaveTextContent('fuera');
  });

  it('descarta datos guardados dañados', () => {
    sessionStorage.setItem('morazul.sesion', '{no es json');
    montar();
    expect(screen.getByTestId('estado')).toHaveTextContent('fuera');
  });
});
