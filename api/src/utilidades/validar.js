// Validadores pequeños para las entradas. Todos lanzan un error 400 con mensaje en español.
const { validacion } = require('./errores');

const vacio = (v) => v === undefined;

function texto(valor, campo, { min = 1, max = 255, requerido = true, nulable = false } = {}) {
  if (vacio(valor)) {
    if (requerido) throw validacion(`${campo} es obligatorio`);
    return undefined;
  }
  if (valor === null || valor === '') {
    if (nulable) return null;
    throw validacion(`${campo} es obligatorio`);
  }
  if (typeof valor !== 'string') throw validacion(`${campo} debe ser texto`);
  const limpio = valor.trim();
  if (limpio.length < min) throw validacion(`${campo} es obligatorio`);
  if (limpio.length > max) throw validacion(`${campo} no puede superar ${max} caracteres`);
  return limpio;
}

function entero(valor, campo, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, requerido = true } = {}) {
  if (vacio(valor)) {
    if (requerido) throw validacion(`${campo} es obligatorio`);
    return undefined;
  }
  const n = typeof valor === 'string' && /^-?\d+$/.test(valor.trim()) ? Number(valor) : valor;
  if (!Number.isInteger(n)) throw validacion(`${campo} debe ser un número entero`);
  if (n < min || n > max) throw validacion(`${campo} debe estar entre ${min} y ${max}`);
  return n;
}

function booleano(valor, campo, { requerido = true } = {}) {
  if (vacio(valor)) {
    if (requerido) throw validacion(`${campo} es obligatorio`);
    return undefined;
  }
  if (valor === true || valor === 'true') return true;
  if (valor === false || valor === 'false') return false;
  throw validacion(`${campo} debe ser verdadero o falso`);
}

function opcion(valor, campo, permitidas, { requerido = true, nulable = false } = {}) {
  if (vacio(valor)) {
    if (requerido) throw validacion(`${campo} es obligatorio`);
    return undefined;
  }
  if (valor === null && nulable) return null;
  if (!permitidas.includes(valor)) throw validacion(`${campo} debe ser uno de: ${permitidas.join(', ')}`);
  return valor;
}

// Dinero en pesos: entero o con dos decimales como máximo, mayor que cero.
function precio(valor, campo, { requerido = true, nulable = false } = {}) {
  if (vacio(valor)) {
    if (requerido) throw validacion(`${campo} es obligatorio`);
    return undefined;
  }
  if (valor === null) {
    if (nulable) return null;
    throw validacion(`${campo} es obligatorio`);
  }
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw validacion(`${campo} debe ser un número`);
  if (n <= 0) throw validacion(`${campo} debe ser mayor que cero`);
  if (n > 99999999) throw validacion(`${campo} es demasiado grande`);
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    throw validacion(`${campo} admite como máximo dos decimales`);
  }
  return n;
}

// Monto de dinero: cero o más (o mayor que cero), con dos decimales como máximo.
function dinero(valor, campo, { requerido = true, permiteCero = true } = {}) {
  if (vacio(valor)) {
    if (requerido) throw validacion(`${campo} es obligatorio`);
    return undefined;
  }
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw validacion(`${campo} debe ser un número`);
  if (n < 0 || (!permiteCero && n === 0)) {
    throw validacion(`${campo} debe ser ${permiteCero ? 'cero o mayor' : 'mayor que cero'}`);
  }
  if (n > 99999999) throw validacion(`${campo} es demasiado grande`);
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw validacion(`${campo} admite como máximo dos decimales`);
  return n;
}

// Fecha en formato AAAA-MM-DD, que exista en el calendario.
function fecha(valor, campo) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw validacion(`${campo} debe tener el formato AAAA-MM-DD`);
  }
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) throw validacion(`${campo} no es una fecha válida`);
  return valor;
}

// El cuerpo debe ser un objeto JSON.
function cuerpo(req) {
  if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw validacion('El cuerpo de la solicitud debe ser un objeto JSON');
  }
  return req.body;
}

function paginacion(query, { limitePorDefecto = 24, limiteMax = 60 } = {}) {
  const pagina = entero(query.pagina ?? '1', 'pagina', { min: 1, max: 100000 });
  const limite = entero(query.limite ?? String(limitePorDefecto), 'limite', { min: 1, max: limiteMax });
  return { pagina, limite, desplazamiento: (pagina - 1) * limite };
}

// Texto de búsqueda seguro para ILIKE: escapa los comodines.
function patronBusqueda(q) {
  const limpio = texto(q, 'q', { max: 80 });
  return `%${limpio.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

module.exports = { texto, entero, booleano, opcion, precio, dinero, fecha, cuerpo, paginacion, patronBusqueda };
