-- =====================================================================
-- MORAZUL · Pruebas de la base de datos (PostgreSQL 16)
-- Se ejecuta sobre la base ya construida. Todo ocurre dentro de una
-- transacción que se revierte al final: no deja datos de prueba.
-- Cada prueba imprime "OK" o aborta con el motivo del fallo.
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

-- Ayuda: ejecuta una sentencia y confirma que falla con el código esperado.
CREATE FUNCTION pg_temp.debe_fallar(sentencia text, codigo text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE sentencia;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = codigo THEN
            RETURN;
        END IF;
        RAISE EXCEPTION 'Falló con % (se esperaba %): %', SQLSTATE, codigo, SQLERRM;
    END;
    RAISE EXCEPTION 'La sentencia debía fallar y se ejecutó: %', sentencia;
END $$;

-- 1. Conteos del catálogo -------------------------------------------------
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM categoria) = 7,  'Se esperaban 7 categorías';
    ASSERT (SELECT count(*) FROM fragancia) = 125, 'Se esperaban 125 fragancias';
    ASSERT (SELECT count(*) FROM producto) = 375,  'Se esperaban 375 productos';
    ASSERT (SELECT count(*) FROM fragancia WHERE es_arabe) = 19, 'Se esperaban 19 fragancias árabes';
    ASSERT (SELECT count(*) FROM producto WHERE presentacion_ml = 30  AND precio_venta = 20000 AND estado = 'activo') = 125, '30 ml: $20.000 y activos';
    ASSERT (SELECT count(*) FROM producto WHERE presentacion_ml = 60  AND precio_venta = 40000 AND estado = 'activo') = 125, '60 ml: $40.000 y activos';
    ASSERT (SELECT count(*) FROM producto WHERE presentacion_ml = 100 AND precio_venta IS NULL AND estado = 'borrador') = 125, '100 ml: borrador sin precio';
    ASSERT (SELECT count(*) FROM producto WHERE existencias <> 0) = 0, 'Existencias iniciales en 0';
    ASSERT (SELECT count(*) FROM categoria c JOIN fragancia f USING (id_categoria) WHERE c.nombre = 'Caballero') = 48, 'Caballero: 48';
    ASSERT (SELECT count(*) FROM categoria c JOIN fragancia f USING (id_categoria) WHERE c.nombre = 'Dama') = 49, 'Dama: 49';
    RAISE NOTICE 'OK  conteos del catálogo';
END $$;

-- 2. Nombre calculado y catálogo público ----------------------------------
DO $$
BEGIN
    ASSERT (SELECT nombre FROM v_producto WHERE codigo = 'CAB-001' AND presentacion_ml = 100) = 'ASAD LATTAFA 100 ml', 'Nombre calculado incorrecto';
    ASSERT (SELECT count(*) FROM v_catalogo_publico) = 250, 'El catálogo público debe tener 250 presentaciones (30 y 60 ml)';
    ASSERT (SELECT count(*) FROM v_catalogo_publico WHERE presentacion_ml = 100) = 0, 'Ningún 100 ml en borrador debe ser público';
    ASSERT (SELECT count(*) FROM v_catalogo_publico WHERE inspirada_en IS NOT NULL) = 0, '"Inspirada en" debe estar oculto por defecto';
    ASSERT (SELECT count(*) FROM v_catalogo_publico WHERE disponibilidad <> 'Agotado') = 0, 'Con existencias 0 todo figura Agotado';
    RAISE NOTICE 'OK  nombre calculado y catálogo público';
END $$;

-- 3. Regla de imagen ------------------------------------------------------
DO $$
BEGIN
    ASSERT (SELECT imagen_url FROM v_catalogo_publico WHERE codigo = 'CAB-001' AND presentacion_ml = 30) = 'genericas/generica-30ml.webp', '30 ml usa la genérica sin color';
    ASSERT (SELECT imagen_url FROM v_catalogo_publico WHERE codigo = 'CAB-001' AND presentacion_ml = 60) = 'genericas/generica-60ml-azul.webp', 'Caballero 60 ml: caja azul';
    ASSERT (SELECT imagen_url FROM v_catalogo_publico WHERE codigo = 'DAM-001' AND presentacion_ml = 60) = 'genericas/generica-60ml-morada.webp', 'Dama 60 ml: caja morada';
    -- Unisex sin color de caja: cae a la imagen de reserva.
    ASSERT (SELECT imagen_url FROM v_catalogo_publico WHERE codigo = (SELECT min(codigo) FROM fragancia WHERE codigo LIKE 'UNI-%') AND presentacion_ml = 60) = 'genericas/reserva.webp', 'Unisex 60 ml sin color usa la reserva';
    -- La foto propia tiene prioridad.
    UPDATE fragancia SET imagen_url = 'propias/cab-001.webp' WHERE codigo = 'CAB-001';
    ASSERT (SELECT imagen_url FROM v_catalogo_publico WHERE codigo = 'CAB-001' AND presentacion_ml = 60) = 'propias/cab-001.webp', 'La foto propia debe ganar';
    RAISE NOTICE 'OK  regla de imagen';
END $$;

-- 4. Reglas de publicación ------------------------------------------------
DO $$
DECLARE
    v_id integer;
BEGIN
    SELECT id_producto INTO v_id FROM v_producto WHERE codigo = 'CAB-002' AND presentacion_ml = 100;
    PERFORM pg_temp.debe_fallar(format('UPDATE producto SET estado = ''activo'' WHERE id_producto = %s', v_id), '23514');
    PERFORM pg_temp.debe_fallar(format('UPDATE producto SET estado = ''activo'', precio_venta = 0 WHERE id_producto = %s', v_id), '23514');
    PERFORM pg_temp.debe_fallar(format('UPDATE producto SET visible_landing = TRUE WHERE id_producto = %s', v_id), '23514');
    -- Con precio mayor que cero sí se publica.
    UPDATE producto SET precio_venta = 70000, estado = 'activo', visible_landing = TRUE WHERE id_producto = v_id;
    ASSERT (SELECT count(*) FROM v_catalogo_publico WHERE id_producto = v_id) = 1, 'El 100 ml con precio debe aparecer en la landing';
    ASSERT (SELECT imagen_url FROM v_catalogo_publico WHERE id_producto = v_id) = 'genericas/generica-100ml-azul.webp', '100 ml usa la genérica de 100 ml';
    -- Inactivar lo saca del catálogo.
    UPDATE producto SET estado = 'inactivo', visible_landing = FALSE WHERE id_producto = v_id;
    ASSERT (SELECT count(*) FROM v_catalogo_publico WHERE id_producto = v_id) = 0, 'Un inactivo no debe ser público';
    -- Una sola fila por fragancia y presentación, y solo 30, 60 o 100 ml.
    PERFORM pg_temp.debe_fallar('INSERT INTO producto (id_fragancia, presentacion_ml) SELECT id_fragancia, 30 FROM fragancia LIMIT 1', '23505');
    PERFORM pg_temp.debe_fallar('INSERT INTO producto (id_fragancia, presentacion_ml) SELECT id_fragancia, 45 FROM fragancia LIMIT 1', '23514');
    RAISE NOTICE 'OK  reglas de publicación';
END $$;

-- 5. Inventario, alertas, caja y ventas -----------------------------------
INSERT INTO usuario (nombre, correo, contrasena_hash) VALUES ('Prueba', 'prueba@morazul.test', 'hash-de-prueba');

DO $$
DECLARE
    v_prod    integer;
    v_usuario integer;
    v_caja    integer;
    v_venta   integer;
    v_detalle integer;
    v_mov     integer;
BEGIN
    SELECT id_usuario  INTO v_usuario FROM usuario WHERE correo = 'prueba@morazul.test';
    SELECT id_producto INTO v_prod FROM v_producto WHERE codigo = 'DAM-001' AND presentacion_ml = 60;
    UPDATE producto SET umbral_minimo = 3 WHERE id_producto = v_prod;

    -- Entrada de 10 unidades: existencias 10, sin alerta.
    INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo, cantidad, motivo)
    VALUES (v_prod, v_usuario, 'entrada', 10, 'Carga inicial de prueba') RETURNING id_movimiento INTO v_mov;
    ASSERT (SELECT existencias FROM producto WHERE id_producto = v_prod) = 10, 'Existencias tras la entrada';
    ASSERT (SELECT existencias_resultantes FROM movimiento_inventario WHERE id_movimiento = v_mov) = 10, 'existencias_resultantes';
    ASSERT (SELECT count(*) FROM alerta_stock WHERE id_producto = v_prod AND estado = 'activa') = 0, 'Sin alerta con stock sobre el umbral';
    ASSERT (SELECT disponibilidad FROM v_catalogo_publico WHERE id_producto = v_prod) = 'Disponible', 'Disponible con 10 unidades';

    -- Las existencias nunca quedan negativas.
    PERFORM pg_temp.debe_fallar(format('INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo, cantidad) VALUES (%s, %s, ''ajuste'', -11)', v_prod, v_usuario), '23514');
    ASSERT (SELECT existencias FROM producto WHERE id_producto = v_prod) = 10, 'El rechazo no debe cambiar las existencias';

    -- Bajar hasta el umbral genera una sola alerta.
    INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo, cantidad, motivo) VALUES (v_prod, v_usuario, 'ajuste', -7, 'Ajuste de prueba');
    ASSERT (SELECT count(*) FROM alerta_stock WHERE id_producto = v_prod AND estado = 'activa') = 1, 'Debe haber una alerta activa';
    ASSERT (SELECT count(*) FROM v_stock_critico WHERE id_producto = v_prod) = 1, 'Debe aparecer en stock crítico';
    ASSERT (SELECT disponibilidad FROM v_catalogo_publico WHERE id_producto = v_prod) = 'Pocas unidades', 'Pocas unidades en la landing';
    INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo, cantidad, motivo) VALUES (v_prod, v_usuario, 'ajuste', -1, 'Ajuste de prueba');
    ASSERT (SELECT count(*) FROM alerta_stock WHERE id_producto = v_prod AND estado = 'activa') = 1, 'No se duplica la alerta activa';

    -- Reponer la resuelve.
    INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo, cantidad, motivo) VALUES (v_prod, v_usuario, 'entrada', 5, 'Reposición de prueba');
    ASSERT (SELECT count(*) FROM alerta_stock WHERE id_producto = v_prod AND estado = 'activa') = 0, 'La alerta debe resolverse al reponer';
    ASSERT (SELECT count(*) FROM alerta_stock WHERE id_producto = v_prod AND estado = 'resuelta') = 2, 'Deben quedar resueltas la alerta inicial (stock 0) y la de stock bajo';

    -- Los movimientos son inmutables.
    PERFORM pg_temp.debe_fallar(format('UPDATE movimiento_inventario SET cantidad = 99 WHERE id_movimiento = %s', v_mov), '23001');
    PERFORM pg_temp.debe_fallar(format('DELETE FROM movimiento_inventario WHERE id_movimiento = %s', v_mov), '23001');

    -- Caja y venta: abierta admite ventas, cerrada no.
    INSERT INTO caja_diaria (id_usuario, fecha, saldo_apertura) VALUES (v_usuario, current_date, 50000) RETURNING id_caja INTO v_caja;
    INSERT INTO venta (id_caja, id_usuario, total) VALUES (v_caja, v_usuario, 40000) RETURNING id_venta INTO v_venta;
    INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario) VALUES (v_venta, v_prod, 1, 40000) RETURNING id_detalle INTO v_detalle;
    INSERT INTO movimiento_inventario (id_producto, id_usuario, id_detalle, tipo, cantidad) VALUES (v_prod, v_usuario, v_detalle, 'venta', -1);
    INSERT INTO movimiento_caja (id_caja, id_usuario, id_venta, tipo, concepto, valor) VALUES (v_caja, v_usuario, v_venta, 'ingreso', 'Venta de prueba', 40000);
    ASSERT (SELECT saldo_esperado FROM v_resumen_caja WHERE id_caja = v_caja) = 90000, 'Saldo esperado de la caja';
    ASSERT (SELECT unidades_vendidas FROM v_ventas_producto_dia WHERE id_producto = v_prod) = 1, 'Reporte de ventas por producto y día';
    ASSERT (SELECT nombre FROM v_ventas_producto_dia WHERE id_producto = v_prod) = (SELECT nombre FROM v_producto WHERE id_producto = v_prod), 'El reporte usa el nombre calculado';

    UPDATE caja_diaria SET estado = 'cerrada', saldo_cierre = 90000, cerrada_en = now() WHERE id_caja = v_caja;
    PERFORM pg_temp.debe_fallar(format('INSERT INTO venta (id_caja, id_usuario, total) VALUES (%s, %s, 1000)', v_caja, v_usuario), '23514');
    PERFORM pg_temp.debe_fallar(format('INSERT INTO movimiento_caja (id_caja, id_usuario, tipo, concepto, valor) VALUES (%s, %s, ''egreso'', ''x'', 1000)', v_caja, v_usuario), '23514');
    RAISE NOTICE 'OK  inventario, alertas, caja y ventas';
END $$;

-- 5b. Solo se venden productos activos y con precio (migración 004) --------
DO $$
DECLARE
    v_usuario  integer;
    v_caja     integer;
    v_venta    integer;
    v_borrador integer;
BEGIN
    SELECT id_usuario INTO v_usuario FROM usuario WHERE correo = 'prueba@morazul.test';
    SELECT id_caja INTO v_caja FROM caja_diaria WHERE fecha = current_date;
    UPDATE caja_diaria SET estado = 'abierta', saldo_cierre = NULL, cerrada_en = NULL WHERE id_caja = v_caja;
    INSERT INTO venta (id_caja, id_usuario, total) VALUES (v_caja, v_usuario, 1000) RETURNING id_venta INTO v_venta;
    SELECT id_producto INTO v_borrador FROM v_producto WHERE codigo = 'DAM-002' AND presentacion_ml = 100;
    PERFORM pg_temp.debe_fallar(format('INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario) VALUES (%s, %s, 1, 1000)', v_venta, v_borrador), '23514');
    RAISE NOTICE 'OK  no se vende un producto en borrador';
END $$;

-- 6. Interruptor "inspirada en" -------------------------------------------
DO $$
BEGIN
    UPDATE configuracion SET valor = 'true' WHERE clave = 'mostrar_inspirada_en';
    ASSERT (SELECT inspirada_en FROM v_catalogo_publico WHERE codigo = 'CAB-002' AND presentacion_ml = 30) = 'CAROLINA HERRERA', 'Con el interruptor encendido se muestra la marca';
    RAISE NOTICE 'OK  interruptor inspirada en';
END $$;

ROLLBACK;
\echo Todas las pruebas pasaron. Cambios revertidos.
