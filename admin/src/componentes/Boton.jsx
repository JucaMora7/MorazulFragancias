export default function Boton({ variante = 'primario', bloque = false, pequeno = false, className = '', type = 'button', ...resto }) {
  const clases = ['boton', `boton--${variante}`, bloque && 'boton--bloque', pequeno && 'boton--pequeno', className].filter(Boolean).join(' ');
  return <button type={type} className={clases} {...resto} />;
}
