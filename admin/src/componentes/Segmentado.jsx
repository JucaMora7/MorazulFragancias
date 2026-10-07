// Control de opciones excluyentes (Entrada/Ajuste, Hoy/7 días/30 días, Pendientes/Atendidas...).
export default function Segmentado({ opciones, valor, onCambiar, etiqueta, suave = false }) {
  return (
    <div className={`segmentado${suave ? ' segmentado--suave' : ''}`} role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" className="segmentado__opcion" aria-pressed={valor === o.valor} onClick={() => onCambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}
