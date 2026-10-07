import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, configurarSesion } from '../api/cliente.js';

const CLAVE = 'morazul.sesion';
const SesionContext = createContext(null);

// Lee la fecha de vencimiento del token solo para cerrar la sesión a tiempo en pantalla.
// La validez real siempre la decide el servidor.
export function vencimientoDelToken(token) {
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof carga.exp === 'number' ? carga.exp * 1000 : null;
  } catch {
    return null;
  }
}

function leerGuardada() {
  try {
    const guardada = JSON.parse(sessionStorage.getItem(CLAVE));
    if (!guardada?.token) return null;
    const vence = vencimientoDelToken(guardada.token);
    if (vence !== null && vence <= Date.now()) return null;
    return guardada;
  } catch {
    return null;
  }
}

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(leerGuardada);
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;

  const cerrarSesion = useCallback(() => {
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento disponible */
    }
    setSesion(null);
  }, []);

  // El token vive solo en la pestaña (sessionStorage) y se borra al cerrarla.
  const iniciarSesion = useCallback(async (correo, contrasena) => {
    const datos = await api('/api/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena } });
    const nueva = { token: datos.token, usuario: datos.usuario };
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(nueva));
    } catch {
      /* se sigue con la sesión en memoria */
    }
    setSesion(nueva);
  }, []);

  // Se registra durante el render (no en un efecto): los efectos de las pantallas hijas corren antes
  // que los del padre y sus primeras llamadas ya necesitan el token.
  configurarSesion({ token: () => sesionRef.current?.token ?? null, alVencer: cerrarSesion });

  // Cierra la sesión sola cuando el token vence.
  useEffect(() => {
    if (!sesion) return undefined;
    const vence = vencimientoDelToken(sesion.token);
    if (vence === null) return undefined;
    const espera = Math.min(vence - Date.now(), 2 ** 31 - 1);
    const temporizador = setTimeout(cerrarSesion, Math.max(espera, 0));
    return () => clearTimeout(temporizador);
  }, [sesion, cerrarSesion]);

  const valor = useMemo(() => ({ sesion, usuario: sesion?.usuario ?? null, iniciarSesion, cerrarSesion }), [sesion, iniciarSesion, cerrarSesion]);
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const contexto = useContext(SesionContext);
  if (!contexto) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return contexto;
}
