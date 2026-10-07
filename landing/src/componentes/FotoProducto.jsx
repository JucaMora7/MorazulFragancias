import { useState } from 'react';
import frascoGenerico from '../assets/frasco-generico.svg';

// Foto del producto. Si la imagen no existe o no carga (por ejemplo, mientras no se suben las
// fotos genéricas), se muestra una ilustración neutra de Morazul en su lugar.
export default function FotoProducto({ src, alt = '', className = '' }) {
  const [fallo, setFallo] = useState(false);
  const usarRespaldo = !src || fallo;
  return (
    <img
      className={`foto ${className}`.trim()}
      src={usarRespaldo ? frascoGenerico : src}
      alt={usarRespaldo ? '' : alt}
      loading="lazy"
      decoding="async"
      width="240"
      height="240"
      onError={() => setFallo(true)}
      data-respaldo={usarRespaldo ? 'si' : undefined}
    />
  );
}
