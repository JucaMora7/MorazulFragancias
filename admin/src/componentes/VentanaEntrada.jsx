import Ventana from './Ventana.jsx';
import FormMovimiento from './FormMovimiento.jsx';

// "Registrar entrada" desde las alertas, el inicio o la ficha del producto.
export default function VentanaEntrada({ producto, onCerrar, onGuardado }) {
  return (
    <Ventana titulo="Registrar entrada" onCerrar={onCerrar}>
      <FormMovimiento
        productoInicial={producto}
        tipoInicial="entrada"
        onCancelar={onCerrar}
        onGuardado={(r) => {
          onGuardado?.(r);
          onCerrar();
        }}
      />
    </Ventana>
  );
}
