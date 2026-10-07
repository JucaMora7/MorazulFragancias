import Boton from './Boton.jsx';

export default function Paginacion({ pagina, totalPaginas, mostrando, total, unidad = 'productos', onCambiar }) {
  return (
    <div className="tabla__pie">
      <span className="pequeno tenue">
        Mostrando {mostrando} de {total} {unidad}
      </span>
      <div style={{ display: 'flex', gap: 12 }}>
        <Boton variante="secundario" pequeno disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
          Anterior
        </Boton>
        <Boton variante="secundario" pequeno disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)}>
          Siguiente
        </Boton>
      </div>
    </div>
  );
}
