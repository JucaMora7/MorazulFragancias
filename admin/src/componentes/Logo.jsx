import icono from '../assets/logo/icono-morado.png';
import wordmark from '../assets/logo/wordmark-morado.png';
import subtitulo from '../assets/logo/subtitulo-morado.png';

// Logo horizontal (versión morada para fondos claros), con las medidas del componente de Figma.
export default function Logo() {
  return (
    <span className="logo" role="img" aria-label="Morazul Fragancias">
      <img src={icono} alt="" width="45.75" height="48" />
      <span className="logo__texto">
        <img src={wordmark} alt="" width="117.221" height="28" />
        <img src={subtitulo} alt="" width="54.938" height="10" />
      </span>
    </span>
  );
}
