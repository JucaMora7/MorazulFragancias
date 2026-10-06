-- =====================================================================
-- MORAZUL · Migración 002: fragancia + presentación
-- Extiende el modelo relacional v1 para el catálogo real (125 fragancias
-- en presentaciones de 30, 60 y 100 ml). Conserva todas las reglas de v1:
-- movimientos, alertas, ventas y caja.
--
-- Cambios:
--   1. Tabla fragancia.
--   2. producto pasa a ser la presentación vendible (id_fragancia + presentacion_ml).
--      El nombre ya no se guarda: se calcula en la vista v_producto.
--   3. precio_venta acepta nulo; estado agrega 'borrador'; solo se publica
--      un producto activo con precio mayor que cero.
--   4. Tabla imagen_generica y tabla configuracion.
--   5. Vista v_catalogo_publico.
-- =====================================================================

BEGIN;

-- Esta migración parte de un producto vacío (el v1 no trae datos de ejemplo).
-- Si ya hay productos, hay que migrarlos a mano antes de continuar.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM producto) THEN
        RAISE EXCEPTION 'La tabla producto ya tiene filas: migrar esos datos a fragancia + presentación antes de aplicar la 002';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. FRAGANCIA
-- ---------------------------------------------------------------------

CREATE TABLE fragancia (
    id_fragancia  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_categoria  INTEGER      NOT NULL REFERENCES categoria (id_categoria) ON DELETE RESTRICT,
    codigo        VARCHAR(10)  NOT NULL UNIQUE,
    nombre        VARCHAR(80)  NOT NULL UNIQUE,
    inspirada_en  VARCHAR(80),
    es_arabe      BOOLEAN      NOT NULL DEFAULT FALSE,
    color_caja    VARCHAR(10)  CHECK (color_caja IN ('azul', 'morada')),
    nota          VARCHAR(200),
    imagen_url    VARCHAR(500),
    activa        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE  fragancia IS 'Fragancia del catálogo. Cada una se vende en varias presentaciones (tabla producto).';
COMMENT ON COLUMN fragancia.codigo IS 'Código del listado del negocio, por ejemplo CAB-001.';
COMMENT ON COLUMN fragancia.inspirada_en IS 'Marca o perfume de referencia. Solo se muestra en la landing si el interruptor mostrar_inspirada_en está encendido.';
COMMENT ON COLUMN fragancia.color_caja IS 'Color de la caja de 60 y 100 ml. Nulo si el administrador aún no lo ha definido (unisex).';
COMMENT ON COLUMN fragancia.imagen_url IS 'Foto propia opcional. Si es nula se usa la imagen genérica de la presentación.';

CREATE INDEX ix_fragancia_categoria ON fragancia (id_categoria);

-- ---------------------------------------------------------------------
-- 2. PRODUCTO = PRESENTACIÓN VENDIBLE
-- ---------------------------------------------------------------------

-- Las vistas del v1 dependen de producto.nombre y producto.id_categoria:
-- se eliminan y se vuelven a crear más abajo.
DROP VIEW v_stock_critico;
DROP VIEW v_ventas_producto_dia;

-- La categoría ahora se obtiene de la fragancia; se quita la copia en producto
-- para que no pueda quedar inconsistente.
ALTER TABLE producto DROP COLUMN id_categoria;
-- Al borrar la columna nombre también desaparece su índice único y ix_producto_catalogo.
ALTER TABLE producto DROP COLUMN nombre;

ALTER TABLE producto
    ADD COLUMN id_fragancia    INTEGER  NOT NULL REFERENCES fragancia (id_fragancia) ON DELETE RESTRICT,
    ADD COLUMN presentacion_ml SMALLINT NOT NULL CHECK (presentacion_ml IN (30, 60, 100)),
    ADD CONSTRAINT uq_producto_fragancia_presentacion UNIQUE (id_fragancia, presentacion_ml);

COMMENT ON TABLE  producto IS 'Presentación vendible de una fragancia (30, 60 o 100 ml), con su propio precio, stock, umbral y alerta. Alimenta el inventario y, si visible_landing es verdadero, la landing.';
COMMENT ON COLUMN producto.presentacion_ml IS 'Contenido en mililitros: 30, 60 o 100.';

-- El precio puede estar vacío mientras la presentación está en borrador.
ALTER TABLE producto ALTER COLUMN precio_venta DROP NOT NULL;
COMMENT ON COLUMN producto.precio_venta IS 'Nulo mientras el producto está en borrador (100 ml hasta que el administrador fije el valor).';

ALTER TABLE producto DROP CONSTRAINT producto_estado_check;
ALTER TABLE producto
    ADD CONSTRAINT producto_estado_check CHECK (estado IN ('borrador', 'activo', 'inactivo'));

-- Reglas de publicación:
--   · un producto activo debe tener precio mayor que cero;
--   · solo se muestra en la landing un producto activo.
ALTER TABLE producto DROP CONSTRAINT ck_producto_visible_activo;
ALTER TABLE producto
    ADD CONSTRAINT ck_producto_activo_con_precio
        CHECK (estado <> 'activo' OR COALESCE(precio_venta, 0) > 0),
    ADD CONSTRAINT ck_producto_visible_activo
        CHECK (visible_landing = FALSE OR estado = 'activo');

ALTER TABLE producto ALTER COLUMN estado SET DEFAULT 'borrador';

CREATE INDEX ix_producto_fragancia ON producto (id_fragancia);
CREATE INDEX ix_producto_catalogo  ON producto (id_fragancia) WHERE estado = 'activo' AND visible_landing;

-- ---------------------------------------------------------------------
-- 3. IMÁGENES GENÉRICAS Y CONFIGURACIÓN
-- ---------------------------------------------------------------------

CREATE TABLE imagen_generica (
    id_imagen       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    presentacion_ml SMALLINT    CHECK (presentacion_ml IN (30, 60, 100)),
    color_caja      VARCHAR(10) CHECK (color_caja IN ('azul', 'morada')),
    url             VARCHAR(500) NOT NULL,
    CONSTRAINT uq_imagen_generica UNIQUE NULLS NOT DISTINCT (presentacion_ml, color_caja),
    CONSTRAINT ck_imagen_generica_reserva CHECK (presentacion_ml IS NOT NULL OR color_caja IS NULL)
);
COMMENT ON TABLE  imagen_generica IS 'Imagen que se muestra cuando la fragancia no tiene foto propia: una por presentación y color de caja.';
COMMENT ON COLUMN imagen_generica.presentacion_ml IS 'Nulo en la fila de reserva (imagen de respaldo única).';
COMMENT ON COLUMN imagen_generica.color_caja IS 'Nulo para 30 ml (sin caja de color) y para la imagen de reserva.';

CREATE TABLE configuracion (
    clave        VARCHAR(60)  PRIMARY KEY,
    valor        VARCHAR(200) NOT NULL,
    descripcion  VARCHAR(255)
);
COMMENT ON TABLE configuracion IS 'Interruptores generales del negocio que el administrador puede cambiar.';

INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('mostrar_inspirada_en', 'false', 'Si es true, la landing muestra la marca de referencia (inspirada en) de cada fragancia. Apagado hasta que la dueña lo apruebe.');

-- ---------------------------------------------------------------------
-- 4. VISTAS
-- ---------------------------------------------------------------------

-- Producto con su nombre calculado ("ASAD LATTAFA 100 ml") y su categoría.
CREATE VIEW v_producto AS
SELECT p.id_producto,
       p.id_fragancia,
       f.codigo,
       f.nombre || ' ' || p.presentacion_ml || ' ml' AS nombre,
       f.nombre         AS fragancia,
       p.presentacion_ml,
       f.id_categoria,
       c.nombre         AS categoria,
       p.precio_venta,
       p.existencias,
       p.umbral_minimo,
       p.estado,
       p.visible_landing
  FROM producto p
  JOIN fragancia f USING (id_fragancia)
  JOIN categoria c USING (id_categoria);
COMMENT ON VIEW v_producto IS 'Producto con nombre calculado (fragancia + presentación) y categoría.';

-- Vistas del v1, recreadas con el nombre y la categoría calculados.
CREATE VIEW v_stock_critico AS
SELECT id_producto, nombre, categoria, existencias, umbral_minimo
  FROM v_producto
 WHERE estado = 'activo' AND existencias <= umbral_minimo;

CREATE VIEW v_ventas_producto_dia AS
SELECT (v.fecha_hora AT TIME ZONE 'America/Bogota')::date AS fecha,
       dv.id_producto,
       p.nombre,
       SUM(dv.cantidad) AS unidades_vendidas,
       SUM(dv.subtotal) AS ingresos
  FROM detalle_venta dv
  JOIN venta v      USING (id_venta)
  JOIN v_producto p USING (id_producto)
 GROUP BY 1, 2, 3;

-- Catálogo público: solo presentaciones activas, con precio, marcadas como
-- visibles y de fragancias activas. La imagen sigue el orden: foto propia,
-- genérica por presentación y color de caja, imagen de reserva.
CREATE VIEW v_catalogo_publico AS
SELECT p.id_producto,
       p.id_fragancia,
       f.codigo,
       f.nombre                                       AS fragancia,
       f.nombre || ' ' || p.presentacion_ml || ' ml'  AS nombre,
       c.nombre                                       AS categoria,
       f.es_arabe,
       CASE WHEN cfg.valor = 'true' THEN f.inspirada_en END AS inspirada_en,
       p.presentacion_ml,
       p.precio_venta,
       CASE
           WHEN p.existencias = 0                 THEN 'Agotado'
           WHEN p.existencias <= p.umbral_minimo  THEN 'Pocas unidades'
           ELSE 'Disponible'
       END                                            AS disponibilidad,
       COALESCE(f.imagen_url, ig.url, reserva.url)    AS imagen_url
  FROM producto p
  JOIN fragancia f USING (id_fragancia)
  JOIN categoria c USING (id_categoria)
  LEFT JOIN configuracion cfg ON cfg.clave = 'mostrar_inspirada_en'
  LEFT JOIN imagen_generica ig
         ON ig.presentacion_ml = p.presentacion_ml
        AND ig.color_caja IS NOT DISTINCT FROM CASE WHEN p.presentacion_ml = 30 THEN NULL ELSE f.color_caja END
  LEFT JOIN imagen_generica reserva
         ON reserva.presentacion_ml IS NULL AND reserva.color_caja IS NULL
 WHERE p.estado = 'activo'
   AND p.visible_landing
   AND f.activa;
COMMENT ON VIEW v_catalogo_publico IS 'Lo único que lee la landing pública. Sin existencias exactas ni datos internos.';

COMMIT;
