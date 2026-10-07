// Los iconos son los del archivo de Figma (carpeta assets/iconos). Se incrustan como SVG y toman el
// color del texto que los rodea (currentColor), así el elemento activo del menú se ve en índigo.
const archivos = import.meta.glob('../assets/iconos/*.svg', { query: '?raw', import: 'default', eager: true });

const iconos = Object.fromEntries(
  Object.entries(archivos).map(([ruta, svg]) => [
    ruta.split('/').pop().replace('.svg', ''),
    svg.replace(/#5C5B70/gi, 'currentColor'),
  ])
);

export default function Icono({ nombre, pequeno = false, className = '', ...resto }) {
  const svg = iconos[nombre];
  if (!svg) return null;
  return (
    <span
      className={`icono${pequeno ? ' icono--pequeno' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
      {...resto}
    />
  );
}
