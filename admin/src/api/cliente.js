// Cliente de la API de Morazul. Todas las llamadas pasan por aquí.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

// La sesión se registra al iniciar la aplicación: de dónde sale el token y qué hacer si vence.
let obtenerToken = () => null;
let alVencerSesion = () => {};

export function configurarSesion({ token, alVencer }) {
  obtenerToken = token;
  alVencerSesion = alVencer;
}

function construirUrl(ruta, consulta) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta || {})) {
    if (valor !== undefined && valor !== null && valor !== '') params.append(clave, String(valor));
  }
  const texto = params.toString();
  return `${BASE}${ruta}${texto ? `?${texto}` : ''}`;
}

export async function api(ruta, { metodo = 'GET', cuerpo, consulta, formulario } = {}) {
  const token = obtenerToken();
  const cabeceras = { Accept: 'application/json' };
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  const opciones = { method: metodo, headers: cabeceras };
  if (formulario) {
    opciones.body = formulario; // el navegador define el Content-Type con su límite
  } else if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;
  try {
    respuesta = await fetch(construirUrl(ruta, consulta), opciones);
  } catch {
    throw new ErrorApi(0, 'sin_conexion', 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // Un 401 con sesión iniciada significa token vencido o usuario desactivado.
    if (respuesta.status === 401 && token) alVencerSesion();
    throw new ErrorApi(
      respuesta.status,
      datos?.error?.codigo ?? 'error',
      datos?.error?.mensaje ?? 'Ocurrió un error inesperado. Intenta de nuevo.',
      datos?.error?.detalles
    );
  }
  return datos;
}

export const urlBaseApi = BASE;
