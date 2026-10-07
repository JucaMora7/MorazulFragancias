export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="estado" role="status">
      {texto}
    </div>
  );
}

export function ErrorCarga({ error, onReintentar }) {
  return (
    <div className="estado" role="alert">
      <p>{error?.message || 'No pudimos cargar la información.'}</p>
      {onReintentar && (
        <button type="button" className="boton boton--secundario" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Vacio({ children }) {
  return <div className="estado">{children}</div>;
}
