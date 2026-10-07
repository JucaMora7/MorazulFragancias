import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FotoProducto from './FotoProducto.jsx';

describe('FotoProducto', () => {
  it('muestra la foto cuando existe', () => {
    render(<FotoProducto src="http://localhost:3000/uploads/fragancias/cab-001.webp" alt="Frasco de ASAD LATTAFA" />);
    const img = screen.getByAltText('Frasco de ASAD LATTAFA');
    expect(img).toHaveAttribute('src', 'http://localhost:3000/uploads/fragancias/cab-001.webp');
    expect(img).not.toHaveAttribute('data-respaldo');
  });

  it('usa la ilustración de respaldo si la imagen no carga, sin inventar un texto alternativo', () => {
    const { container } = render(<FotoProducto src="http://localhost:3000/uploads/genericas/generica-30ml.webp" alt="Frasco de ASAD LATTAFA" />);
    const img = container.querySelector('img');
    fireEvent.error(img);
    expect(img).toHaveAttribute('data-respaldo', 'si');
    expect(img.getAttribute('src')).not.toMatch(/uploads/);
    expect(img).toHaveAttribute('alt', '');
  });

  it('usa el respaldo cuando no hay dirección de imagen', () => {
    const { container } = render(<FotoProducto src={null} alt="x" />);
    expect(container.querySelector('img')).toHaveAttribute('data-respaldo', 'si');
  });

  it('carga las imágenes de forma diferida y con tamaño fijo (evita saltos de diseño)', () => {
    const { container } = render(<FotoProducto src="a.webp" alt="x" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width');
    expect(img).toHaveAttribute('height');
  });
});
