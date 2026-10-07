// El estado siempre se comunica con texto (nunca solo con color).
const CLASES = {
  Normal: 'normal',
  Crítico: 'critico',
  Agotado: 'agotado',
  Inactivo: 'inactivo',
  Borrador: 'borrador',
};

export default function Etiqueta({ estado }) {
  if (!estado) return null;
  return <span className={`etiqueta etiqueta--${CLASES[estado] ?? 'inactivo'}`}>{estado}</span>;
}
