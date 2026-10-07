// Formatos de pesos, fechas y horas. Todo en hora de Bogotá y escrito a mano (no depende de
// la configuración regional del navegador) para que se vea igual en cualquier equipo.
const ZONA = 'America/Bogota';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const formateadorPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function agrupar(entero) {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// $ 286.000 · con decimales solo si los hay: $ 1.500,50 · negativos: −$ 14.000
export function pesos(valor) {
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor))) return '—';
  const n = Number(valor);
  const [entero, decimales] = Math.abs(n).toFixed(2).split('.');
  const cuerpo = `$ ${agrupar(entero)}${decimales === '00' ? '' : `,${decimales}`}`;
  return n < 0 ? `−${cuerpo}` : cuerpo;
}

// "+ $ 178.000" para ingresos y "− $ 14.000" para egresos.
export function pesosConSigno(valor, esIngreso) {
  return `${esIngreso ? '+' : '−'} ${pesos(Math.abs(Number(valor)))}`;
}

export function numero(valor) {
  return agrupar(String(Math.trunc(Number(valor) || 0)));
}

export function partesBogota(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const p = Object.fromEntries(formateadorPartes.formatToParts(d).map((x) => [x.type, x.value]));
  const anio = Number(p.year);
  const mes = Number(p.month);
  const dia = Number(p.day);
  return {
    anio,
    mes,
    dia,
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaSemana: new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(),
  };
}

const dos = (n) => String(n).padStart(2, '0');

// Fecha de hoy en Bogotá como AAAA-MM-DD.
export function hoyISO(ahora = new Date()) {
  const { anio, mes, dia } = partesBogota(ahora);
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

export function sumarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function partesISO(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return { anio, mes, dia, diaSemana: new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() };
}

// "Martes, 6 de octubre de 2026"
export function fechaLarga(iso) {
  const { anio, mes, dia, diaSemana } = partesISO(iso);
  return `${mayuscula(DIAS[diaSemana])}, ${dia} de ${MESES[mes - 1]} de ${anio}`;
}

// "6 de octubre de 2026"
export function fechaCompleta(iso) {
  const { anio, mes, dia } = partesISO(iso);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

// "6 de octubre"
export function fechaSinAnio(iso) {
  const { mes, dia } = partesISO(iso);
  return `${dia} de ${MESES[mes - 1]}`;
}

// "6 oct" para ejes de gráficas
export function diaMesCorto(iso) {
  const { mes, dia } = partesISO(iso);
  return `${dia} ${MESES[mes - 1].slice(0, 3)}`;
}

// "10:42 a. m."
export function horaCorta(marca) {
  const { hora, minuto } = partesBogota(marca);
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${h12}:${dos(minuto)} ${hora < 12 ? 'a. m.' : 'p. m.'}`;
}

// "6 oct, 10:42"
export function fechaHoraCorta(marca) {
  const { mes, dia, hora, minuto } = partesBogota(marca);
  return `${dia} ${MESES[mes - 1].slice(0, 3)}, ${dos(hora)}:${dos(minuto)}`;
}

export function saludo(ahora = new Date()) {
  const { hora } = partesBogota(ahora);
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Venta #0007
export function numeroVenta(id) {
  return `#${String(id).padStart(4, '0')}`;
}

export function plural(n, singular, pluralTexto) {
  return n === 1 ? singular : pluralTexto;
}

// Rango "Del 6 de septiembre al 6 de octubre de 2026"
export function rangoTexto(desde, hasta) {
  if (desde === hasta) return fechaCompleta(desde);
  const d = partesISO(desde);
  const h = partesISO(hasta);
  const inicio = d.anio === h.anio ? fechaSinAnio(desde) : fechaCompleta(desde);
  return `Del ${inicio} al ${fechaCompleta(hasta)}`;
}

// "5 oct, 4:05 p. m."
export function fechaConHora(marca) {
  const { mes, dia } = partesBogota(marca);
  return `${dia} ${MESES[mes - 1].slice(0, 3)}, ${horaCorta(marca)}`;
}
