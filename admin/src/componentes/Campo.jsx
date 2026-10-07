import { useId } from 'react';

// Campo de texto del archivo de Figma: etiqueta arriba y caja de 44 px.
export function Campo({ etiqueta, ayuda, error, tipo = 'text', area = false, className = '', ...resto }) {
  const id = useId();
  const Control = area ? 'textarea' : 'input';
  const descripcion = [ayuda && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <Control
        id={id}
        type={area ? undefined : tipo}
        className={`campo__control${className ? ` ${className}` : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={descripcion}
        {...resto}
      />
      {ayuda && (
        <span id={`${id}-ayuda`} className="campo__ayuda">
          {ayuda}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="campo__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function CampoSelect({ etiqueta, ayuda, children, ...resto }) {
  const id = useId();
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <select id={id} className="campo__control" aria-describedby={ayuda ? `${id}-ayuda` : undefined} {...resto}>
        {children}
      </select>
      {ayuda && (
        <span id={`${id}-ayuda`} className="campo__ayuda">
          {ayuda}
        </span>
      )}
    </div>
  );
}
