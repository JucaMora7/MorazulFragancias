import Boton from './Boton.jsx';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando" role="status">
      {texto}
    </div>
  );
}

export function ErrorCarga({ error, onReintentar }) {
  return (
    <div className="estado-vacio" role="alert">
      <p>{error?.message || 'No se pudo cargar la información.'}</p>
      {onReintentar && (
        <Boton variante="secundario" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Vacio({ children }) {
  return <div className="estado-vacio">{children}</div>;
}

export function Mensaje({ tipo = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`mensaje mensaje--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
