import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext.jsx';
import { Campo } from '../componentes/Campo.jsx';
import Boton from '../componentes/Boton.jsx';
import { Mensaje } from '../componentes/Estados.jsx';
import logoVertical from '../assets/logo/logo-vertical-blanco.png';

export default function Login() {
  const { sesion, iniciarSesion } = useSesion();
  const ubicacion = useLocation();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (sesion) return <Navigate to={ubicacion.state?.desde || '/'} replace />;

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!correo.trim()) return setError('Escribe tu correo electrónico.');
    if (!contrasena) return setError('Escribe tu contraseña.');
    setEnviando(true);
    try {
      await iniciarSesion(correo.trim(), contrasena);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <div className="login__marca">
        <div className="login__logo" role="img" aria-label="Morazul Fragancias">
          <img src={logoVertical} alt="" />
        </div>
        <p className="titulo-m login__lema">Inventario, ventas y caja de tu negocio en un solo lugar</p>
      </div>
      <main className="login__formulario">
        <form className="login__tarjeta" onSubmit={enviar} noValidate>
          <h1 className="titulo-l">Iniciar sesión</h1>
          <p className="tenue">Ingresa con tu cuenta de administrador.</p>
          <div className="login__campos">
            <Campo
              etiqueta="Correo electrónico"
              tipo="email"
              name="correo"
              autoComplete="username"
              placeholder="admin@morazul.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
            <Campo
              etiqueta="Contraseña"
              tipo="password"
              name="contrasena"
              autoComplete="current-password"
              placeholder="••••••••"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>
          <Mensaje>{error}</Mensaje>
          <Boton type="submit" bloque disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Boton>
          <p className="pequeno tenue">¿Olvidaste tu contraseña? Escribe al administrador del sistema.</p>
        </form>
      </main>
    </div>
  );
}
