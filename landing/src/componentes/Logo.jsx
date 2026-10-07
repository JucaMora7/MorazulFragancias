import icono from '../assets/logo/icono-morado.png';
import wordmark from '../assets/logo/wordmark-morado.png';
import subtitulo from '../assets/logo/subtitulo-morado.png';
import iconoBlanco from '../assets/logo/icono-blanco.png';
import wordmarkBlanco from '../assets/logo/wordmark-blanco.png';
import subtituloBlanco from '../assets/logo/subtitulo-blanco.png';

// Logo horizontal con las medidas del componente de Figma: versión morada para fondos claros
// y versión blanca (sobre recuadro índigo) para el pie de página.
export default function Logo({ oscuro = false }) {
  const piezas = oscuro
    ? [
        [iconoBlanco, 44.727, 48],
        [wordmarkBlanco, 109.667, 28],
        [subtituloBlanco, 60.8, 10],
      ]
    : [
        [icono, 45.75, 48],
        [wordmark, 117.221, 28],
        [subtitulo, 54.938, 10],
      ];
  return (
    <span className={`logo${oscuro ? ' logo--oscuro' : ''}`} role="img" aria-label="Morazul Fragancias">
      <img src={piezas[0][0]} alt="" width={piezas[0][1]} height={piezas[0][2]} />
      <span className="logo__texto">
        <img src={piezas[1][0]} alt="" width={piezas[1][1]} height={piezas[1][2]} />
        <img src={piezas[2][0]} alt="" width={piezas[2][1]} height={piezas[2][2]} />
      </span>
    </span>
  );
}
