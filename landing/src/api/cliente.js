// Cliente de la API pública de Morazul. La landing solo lee: no hay sesión ni escrituras.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
  }
}

function construirUrl(ruta, consulta) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta || {})) {
    if (valor !== undefined && valor !== null && valor !== '') params.append(clave, String(valor));
  }
  const texto = params.toString();
  return `${BASE}${ruta}${texto ? `?${texto}` : ''}`;
}

export async function obtener(ruta, consulta) {
  let respuesta;
  try {
    respuesta = await fetch(construirUrl(ruta, consulta), { headers: { Accept: 'application/json' } });
  } catch {
    throw new ErrorApi(0, 'sin_conexion', 'No pudimos cargar la información. Revisa tu conexión e intenta de nuevo.');
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos?.error?.codigo ?? 'error', datos?.error?.mensaje ?? 'Ocurrió un error inesperado. Intenta de nuevo.');
  }
  return datos;
}
