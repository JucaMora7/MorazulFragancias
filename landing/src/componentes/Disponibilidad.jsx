// La disponibilidad siempre se dice con texto (nunca solo con color).
const CLASES = {
  Disponible: 'normal',
  'Pocas unidades': 'critico',
  Agotado: 'agotado',
};

export default function Disponibilidad({ valor, ocultarSiDisponible = false }) {
  if (!valor || (ocultarSiDisponible && valor === 'Disponible')) return null;
  return <span className={`etiqueta etiqueta--${CLASES[valor] ?? 'normal'}`}>{valor}</span>;
}
