-- =====================================================================
-- MORAZUL · Migración 004: solo se venden productos activos y con precio
-- Segunda línea de defensa en la base: aunque la API ya lo valida, un
-- producto en borrador, inactivo o sin precio no puede entrar en una venta.
-- =====================================================================

BEGIN;

CREATE FUNCTION fn_detalle_venta_producto_vendible() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_estado VARCHAR(10);
    v_precio NUMERIC(12,2);
BEGIN
    SELECT estado, precio_venta INTO v_estado, v_precio
      FROM producto WHERE id_producto = NEW.id_producto;
    IF v_estado IS DISTINCT FROM 'activo' OR COALESCE(v_precio, 0) <= 0 THEN
        RAISE EXCEPTION 'El producto % no está activo o no tiene precio: no se puede vender', NEW.id_producto
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_detalle_venta_producto_vendible
    BEFORE INSERT ON detalle_venta
    FOR EACH ROW EXECUTE FUNCTION fn_detalle_venta_producto_vendible();

COMMENT ON FUNCTION fn_detalle_venta_producto_vendible() IS 'Rechaza ventas de productos en borrador, inactivos o sin precio.';

COMMIT;
