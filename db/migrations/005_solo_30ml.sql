-- =====================================================================
-- MORAZUL · Migración 005: el negocio solo vende la presentación de 30 ml
-- Decisión de los dueños: el inventario se lleva únicamente en 30 ml.
--   · Se eliminan las presentaciones de 60 y 100 ml del catálogo (250 productos).
--   · La base solo admite presentaciones de 30 ml; si algún día se vuelven a vender
--     otras, se amplía la restricción con una migración nueva.
--   · Las imágenes genéricas de 60 y 100 ml ya no se usan.
--
-- Seguridad: no borra nada que tenga historia. Si alguna presentación de 60 o 100 ml
-- ya tiene movimientos de inventario o ventas, la migración se detiene con un error.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    v_con_historia INTEGER;
BEGIN
    SELECT count(*) INTO v_con_historia
      FROM producto p
     WHERE p.presentacion_ml <> 30
       AND (EXISTS (SELECT 1 FROM movimiento_inventario m WHERE m.id_producto = p.id_producto)
         OR EXISTS (SELECT 1 FROM detalle_venta d WHERE d.id_producto = p.id_producto));
    IF v_con_historia > 0 THEN
        RAISE EXCEPTION '% presentaciones de 60 o 100 ml ya tienen movimientos o ventas: no se pueden eliminar. Inactívalas desde el panel en su lugar.', v_con_historia;
    END IF;
END $$;

-- Las alertas que hubiera sobre esas presentaciones se descartan con ellas.
DELETE FROM alerta_stock
 WHERE id_producto IN (SELECT id_producto FROM producto WHERE presentacion_ml <> 30);

DELETE FROM producto WHERE presentacion_ml <> 30;

ALTER TABLE producto DROP CONSTRAINT producto_presentacion_ml_check;
ALTER TABLE producto ADD CONSTRAINT ck_producto_solo_30ml CHECK (presentacion_ml = 30);
COMMENT ON COLUMN producto.presentacion_ml IS 'Contenido en mililitros. Hoy el negocio solo vende 30 ml.';

DELETE FROM imagen_generica WHERE presentacion_ml IS NOT NULL AND presentacion_ml <> 30;

ALTER TABLE imagen_generica DROP CONSTRAINT imagen_generica_presentacion_ml_check;
ALTER TABLE imagen_generica ADD CONSTRAINT ck_imagen_generica_solo_30ml CHECK (presentacion_ml IS NULL OR presentacion_ml = 30);

COMMENT ON COLUMN fragancia.color_caja IS 'Ya no se usa: el color de caja solo definía la imagen de 60 y 100 ml. Se conserva por si vuelven esas presentaciones.';

COMMIT;
