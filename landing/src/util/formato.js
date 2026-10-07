function agrupar(entero) {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// $ 20.000 · con decimales solo si los hay: $ 1.500,50
export function pesos(valor) {
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor))) return '—';
  const [entero, decimales] = Math.abs(Number(valor)).toFixed(2).split('.');
  return `$ ${agrupar(entero)}${decimales === '00' ? '' : `,${decimales}`}`;
}

export function plural(n, singular, pluralTexto) {
  return n === 1 ? singular : pluralTexto;
}

export function numero(valor) {
  return agrupar(String(Math.trunc(Number(valor) || 0)));
}
