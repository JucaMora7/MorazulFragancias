-- =====================================================================
-- MORAZUL · Modelo relacional (PostgreSQL 16)
-- Sistema de inventario y gestión + landing publicitaria
-- Versión 1.0 · 4 de octubre de 2026
--
-- Convenciones: nombres en minúsculas y snake_case, llaves primarias
-- id_<tabla> generadas por identidad, fechas con zona horaria (TIMESTAMPTZ).
-- Los registros históricos (ventas, movimientos) no se borran: las llaves
-- foráneas usan ON DELETE RESTRICT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

CREATE TABLE usuario (
    id_usuario       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL,
    correo           VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash  VARCHAR(255) NOT NULL,
    rol              VARCHAR(20)  NOT NULL DEFAULT 'administrador'
                     CHECK (rol IN ('administrador', 'empleado')),
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE  usuario IS 'Personas que inician sesión en el panel. Hoy solo el administrador; el rol empleado queda reservado.';
COMMENT ON COLUMN usuario.contrasena_hash IS 'Hash bcrypt; nunca se guarda la contraseña en texto plano.';

CREATE TABLE categoria (
    id_categoria  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(80)  NOT NULL UNIQUE,
    descripcion   VARCHAR(255)
);
COMMENT ON TABLE categoria IS 'Agrupación de productos para el catálogo y los reportes.';

CREATE TABLE producto (
    id_producto      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_categoria     INTEGER       NOT NULL REFERENCES categoria (id_categoria) ON DELETE RESTRICT,
    nombre           VARCHAR(120)  NOT NULL UNIQUE,
    descripcion      TEXT,
    precio_venta     NUMERIC(12,2) NOT NULL CHECK (precio_venta >= 0),
    existencias      INTEGER       NOT NULL DEFAULT 0 CHECK (existencias >= 0),
    umbral_minimo    INTEGER       NOT NULL DEFAULT 0 CHECK (umbral_minimo >= 0),
    imagen_url       VARCHAR(500),
    estado           VARCHAR(10)   NOT NULL DEFAULT 'activo'
                     CHECK (estado IN ('activo', 'inactivo')),
    visible_landing  BOOLEAN       NOT NULL DEFAULT FALSE,
    creado_en        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_producto_visible_activo
        CHECK (visible_landing = FALSE OR estado = 'activo')
);
COMMENT ON TABLE  producto IS 'Catálogo de lociones. Alimenta el inventario interno y, si visible_landing es verdadero, la landing pública.';
COMMENT ON COLUMN producto.existencias IS 'Valor derivado: suma de movimiento_inventario.cantidad. Lo mantiene el disparador trg_mov_inventario_aplicar.';
COMMENT ON COLUMN producto.umbral_minimo IS 'Con existencias <= umbral_minimo se genera una alerta de stock crítico.';

CREATE TABLE caja_diaria (
    id_caja        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario     INTEGER       NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    fecha          DATE          NOT NULL UNIQUE,
    saldo_apertura NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saldo_apertura >= 0),
    saldo_cierre   NUMERIC(12,2),
    estado         VARCHAR(10)   NOT NULL DEFAULT 'abierta'
                   CHECK (estado IN ('abierta', 'cerrada')),
    abierta_en     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cerrada_en     TIMESTAMPTZ,
    CONSTRAINT ck_caja_cierre_coherente CHECK (
        (estado = 'abierta' AND saldo_cierre IS NULL AND cerrada_en IS NULL) OR
        (estado = 'cerrada' AND saldo_cierre IS NOT NULL AND cerrada_en IS NOT NULL)
    )
);
COMMENT ON TABLE caja_diaria IS 'Una caja por día. Al cerrarse ya no admite ventas ni movimientos.';

CREATE TABLE venta (
    id_venta    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_caja     INTEGER       NOT NULL REFERENCES caja_diaria (id_caja) ON DELETE RESTRICT,
    id_usuario  INTEGER       NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    fecha_hora  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    total       NUMERIC(12,2) NOT NULL CHECK (total >= 0)
);
COMMENT ON TABLE  venta IS 'Cabecera de una venta registrada desde el panel.';
COMMENT ON COLUMN venta.total IS 'Redundancia controlada: suma de detalle_venta.subtotal, calculada por la API dentro de la misma transacción.';

CREATE TABLE detalle_venta (
    id_detalle       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_venta         INTEGER       NOT NULL REFERENCES venta (id_venta) ON DELETE RESTRICT,
    id_producto      INTEGER       NOT NULL REFERENCES producto (id_producto) ON DELETE RESTRICT,
    cantidad         INTEGER       NOT NULL CHECK (cantidad > 0),
    precio_unitario  NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal         NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    CONSTRAINT uq_detalle_venta_producto UNIQUE (id_venta, id_producto)
);
COMMENT ON COLUMN detalle_venta.precio_unitario IS 'Copia del precio vigente al vender, para conservar el histórico aunque el precio cambie.';

CREATE TABLE movimiento_inventario (
    id_movimiento          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto            INTEGER      NOT NULL REFERENCES producto (id_producto) ON DELETE RESTRICT,
    id_usuario             INTEGER      NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    id_detalle             INTEGER      UNIQUE REFERENCES detalle_venta (id_detalle) ON DELETE RESTRICT,
    tipo                   VARCHAR(10)  NOT NULL CHECK (tipo IN ('entrada', 'venta', 'ajuste')),
    cantidad               INTEGER      NOT NULL CHECK (cantidad <> 0),
    existencias_resultantes INTEGER     NOT NULL CHECK (existencias_resultantes >= 0),
    motivo                 VARCHAR(200),
    fecha_hora             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_mov_inv_tipo_signo CHECK (
        (tipo = 'entrada' AND cantidad > 0 AND id_detalle IS NULL) OR
        (tipo = 'venta'   AND cantidad < 0 AND id_detalle IS NOT NULL) OR
        (tipo = 'ajuste'  AND id_detalle IS NULL)
    )
);
COMMENT ON TABLE  movimiento_inventario IS 'Libro de movimientos: la cantidad es positiva si suma y negativa si resta. Se inserta, nunca se modifica.';
COMMENT ON COLUMN movimiento_inventario.existencias_resultantes IS 'Existencias del producto justo después del movimiento (las calcula el disparador).';

CREATE TABLE movimiento_caja (
    id_mov_caja  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_caja      INTEGER       NOT NULL REFERENCES caja_diaria (id_caja) ON DELETE RESTRICT,
    id_usuario   INTEGER       NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    id_venta     INTEGER       UNIQUE REFERENCES venta (id_venta) ON DELETE RESTRICT,
    tipo         VARCHAR(10)   NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    concepto     VARCHAR(150)  NOT NULL,
    valor        NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    fecha_hora   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_mov_caja_venta_ingreso CHECK (id_venta IS NULL OR tipo = 'ingreso')
);
COMMENT ON TABLE movimiento_caja IS 'Ingresos y egresos de la caja del día. Cada venta genera un ingreso enlazado por id_venta.';

CREATE TABLE alerta_stock (
    id_alerta               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto             INTEGER     NOT NULL REFERENCES producto (id_producto) ON DELETE RESTRICT,
    existencias_al_generar  INTEGER     NOT NULL CHECK (existencias_al_generar >= 0),
    umbral_al_generar       INTEGER     NOT NULL CHECK (umbral_al_generar >= 0),
    estado                  VARCHAR(10) NOT NULL DEFAULT 'activa'
                            CHECK (estado IN ('activa', 'resuelta')),
    generada_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelta_en             TIMESTAMPTZ,
    CONSTRAINT ck_alerta_resuelta_coherente CHECK (
        (estado = 'activa'  AND resuelta_en IS NULL) OR
        (estado = 'resuelta' AND resuelta_en IS NOT NULL)
    )
);
COMMENT ON TABLE alerta_stock IS 'Alertas de stock crítico. Solo puede haber una activa por producto.';

CREATE TABLE auditoria (
    id_auditoria  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario    INTEGER      NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    entidad       VARCHAR(40)  NOT NULL,
    id_registro   INTEGER      NOT NULL,
    accion        VARCHAR(10)  NOT NULL CHECK (accion IN ('crear', 'editar', 'inactivar')),
    detalle       JSONB,
    fecha_hora    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE auditoria IS 'Quién y cuándo cambió productos, ventas, cajas, etc. entidad + id_registro apuntan al registro afectado (referencia lógica, sin llave foránea).';

-- ---------------------------------------------------------------------
-- 2. ÍNDICES
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX uq_alerta_activa_por_producto
    ON alerta_stock (id_producto) WHERE estado = 'activa';
CREATE INDEX ix_producto_categoria      ON producto (id_categoria);
CREATE INDEX ix_producto_catalogo       ON producto (nombre) WHERE estado = 'activo' AND visible_landing;
CREATE INDEX ix_venta_fecha             ON venta (fecha_hora);
CREATE INDEX ix_venta_caja              ON venta (id_caja);
CREATE INDEX ix_detalle_producto        ON detalle_venta (id_producto);
CREATE INDEX ix_mov_inv_producto_fecha  ON movimiento_inventario (id_producto, fecha_hora DESC);
CREATE INDEX ix_mov_caja_caja           ON movimiento_caja (id_caja);
CREATE INDEX ix_auditoria_registro      ON auditoria (entidad, id_registro);
CREATE INDEX ix_auditoria_fecha         ON auditoria (fecha_hora);

-- ---------------------------------------------------------------------
-- 3. REGLAS DE NEGOCIO EN LA BASE DE DATOS (disparadores)
-- ---------------------------------------------------------------------

-- 3.1 Fecha de última modificación del producto
CREATE FUNCTION fn_producto_actualizado_en() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END $$;

CREATE TRIGGER trg_producto_actualizado_en
    BEFORE UPDATE ON producto
    FOR EACH ROW EXECUTE FUNCTION fn_producto_actualizado_en();

-- 3.2 Una caja cerrada no admite ventas ni movimientos nuevos
CREATE FUNCTION fn_exigir_caja_abierta() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_estado VARCHAR(10);
BEGIN
    SELECT estado INTO v_estado FROM caja_diaria WHERE id_caja = NEW.id_caja;
    IF v_estado IS DISTINCT FROM 'abierta' THEN
        RAISE EXCEPTION 'La caja % no está abierta: no se admiten nuevos registros', NEW.id_caja
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_venta_caja_abierta
    BEFORE INSERT ON venta
    FOR EACH ROW EXECUTE FUNCTION fn_exigir_caja_abierta();

CREATE TRIGGER trg_mov_caja_caja_abierta
    BEFORE INSERT ON movimiento_caja
    FOR EACH ROW EXECUTE FUNCTION fn_exigir_caja_abierta();

-- 3.3 Cada movimiento de inventario actualiza las existencias en la misma
--     transacción. Si el resultado fuera negativo, el CHECK de producto
--     rechaza el movimiento y no se guarda nada.
CREATE FUNCTION fn_mov_inventario_aplicar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_existencias INTEGER;
BEGIN
    UPDATE producto
       SET existencias = existencias + NEW.cantidad
     WHERE id_producto = NEW.id_producto
 RETURNING existencias INTO v_existencias;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe', NEW.id_producto
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    NEW.existencias_resultantes := v_existencias;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_mov_inventario_aplicar
    BEFORE INSERT ON movimiento_inventario
    FOR EACH ROW EXECUTE FUNCTION fn_mov_inventario_aplicar();

-- 3.4 Los movimientos son un libro histórico: no se modifican ni se borran
CREATE FUNCTION fn_bloquear_cambios() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es un registro histórico: no admite % de filas', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER trg_mov_inventario_inmutable
    BEFORE UPDATE OR DELETE ON movimiento_inventario
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_cambios();

-- 3.5 Alerta de stock crítico: se crea una sola alerta activa por producto
--     y se resuelve sola cuando el producto se repone.
CREATE FUNCTION fn_evaluar_alerta_stock() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado = 'activo' AND NEW.existencias <= NEW.umbral_minimo THEN
        INSERT INTO alerta_stock (id_producto, existencias_al_generar, umbral_al_generar)
        SELECT NEW.id_producto, NEW.existencias, NEW.umbral_minimo
         WHERE NOT EXISTS (SELECT 1 FROM alerta_stock
                            WHERE id_producto = NEW.id_producto AND estado = 'activa');
    ELSE
        UPDATE alerta_stock
           SET estado = 'resuelta', resuelta_en = now()
         WHERE id_producto = NEW.id_producto AND estado = 'activa';
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_producto_alerta_stock
    AFTER UPDATE OF existencias, umbral_minimo, estado ON producto
    FOR EACH ROW EXECUTE FUNCTION fn_evaluar_alerta_stock();

-- ---------------------------------------------------------------------
-- 4. VISTAS PARA REPORTES
-- ---------------------------------------------------------------------

CREATE VIEW v_stock_critico AS
SELECT p.id_producto, p.nombre, c.nombre AS categoria, p.existencias, p.umbral_minimo
  FROM producto p
  JOIN categoria c USING (id_categoria)
 WHERE p.estado = 'activo' AND p.existencias <= p.umbral_minimo;

CREATE VIEW v_ventas_producto_dia AS
SELECT (v.fecha_hora AT TIME ZONE 'America/Bogota')::date AS fecha,
       dv.id_producto,
       p.nombre,
       SUM(dv.cantidad) AS unidades_vendidas,
       SUM(dv.subtotal) AS ingresos
  FROM detalle_venta dv
  JOIN venta v    USING (id_venta)
  JOIN producto p USING (id_producto)
 GROUP BY 1, 2, 3;

CREATE VIEW v_resumen_caja AS
SELECT c.id_caja, c.fecha, c.estado, c.saldo_apertura,
       COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'ingreso'), 0) AS ingresos,
       COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'egreso'), 0)  AS egresos,
       c.saldo_apertura
         + COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'ingreso'), 0)
         - COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'egreso'), 0) AS saldo_esperado,
       c.saldo_cierre
  FROM caja_diaria c
  LEFT JOIN movimiento_caja m USING (id_caja)
 GROUP BY c.id_caja;
