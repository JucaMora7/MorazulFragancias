// Modelos de las tablas que la API escribe. Las vistas se consultan con SQL directo.
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Usuario = sequelize.define('usuario', {
  id_usuario: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: DataTypes.STRING(100),
  correo: DataTypes.STRING(150),
  contrasena_hash: DataTypes.STRING(255),
  rol: DataTypes.STRING(20),
  activo: DataTypes.BOOLEAN,
});

const Categoria = sequelize.define('categoria', {
  id_categoria: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: DataTypes.STRING(80),
  descripcion: DataTypes.STRING(255),
});

const Fragancia = sequelize.define('fragancia', {
  id_fragancia: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_categoria: DataTypes.INTEGER,
  codigo: DataTypes.STRING(10),
  nombre: DataTypes.STRING(80),
  inspirada_en: DataTypes.STRING(80),
  es_arabe: DataTypes.BOOLEAN,
  color_caja: DataTypes.STRING(10),
  nota: DataTypes.STRING(200),
  imagen_url: DataTypes.STRING(500),
  activa: DataTypes.BOOLEAN,
});

const Producto = sequelize.define('producto', {
  id_producto: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_fragancia: DataTypes.INTEGER,
  presentacion_ml: DataTypes.SMALLINT,
  descripcion: DataTypes.TEXT,
  precio_venta: DataTypes.DECIMAL(12, 2),
  existencias: DataTypes.INTEGER,
  umbral_minimo: DataTypes.INTEGER,
  estado: DataTypes.STRING(10),
  visible_landing: DataTypes.BOOLEAN,
});

const Configuracion = sequelize.define('configuracion', {
  clave: { type: DataTypes.STRING(60), primaryKey: true },
  valor: DataTypes.STRING(200),
  descripcion: DataTypes.STRING(255),
});

const Auditoria = sequelize.define('auditoria', {
  id_auditoria: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  id_usuario: DataTypes.INTEGER,
  entidad: DataTypes.STRING(40),
  id_registro: DataTypes.INTEGER,
  accion: DataTypes.STRING(10),
  detalle: DataTypes.JSONB,
});

const CajaDiaria = sequelize.define('caja_diaria', {
  id_caja: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_usuario: DataTypes.INTEGER,
  fecha: DataTypes.DATEONLY,
  saldo_apertura: DataTypes.DECIMAL(12, 2),
  saldo_cierre: DataTypes.DECIMAL(12, 2),
  estado: DataTypes.STRING(10),
  cerrada_en: DataTypes.DATE,
});

const Venta = sequelize.define('venta', {
  id_venta: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_caja: DataTypes.INTEGER,
  id_usuario: DataTypes.INTEGER,
  total: DataTypes.DECIMAL(12, 2),
});

// subtotal es una columna generada: la calcula la base y no se escribe.
const DetalleVenta = sequelize.define('detalle_venta', {
  id_detalle: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_venta: DataTypes.INTEGER,
  id_producto: DataTypes.INTEGER,
  cantidad: DataTypes.INTEGER,
  precio_unitario: DataTypes.DECIMAL(12, 2),
});

// existencias_resultantes la calcula el disparador de la base.
const MovimientoInventario = sequelize.define('movimiento_inventario', {
  id_movimiento: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_producto: DataTypes.INTEGER,
  id_usuario: DataTypes.INTEGER,
  id_detalle: DataTypes.INTEGER,
  tipo: DataTypes.STRING(10),
  cantidad: DataTypes.INTEGER,
  motivo: DataTypes.STRING(200),
});

const MovimientoCaja = sequelize.define('movimiento_caja', {
  id_mov_caja: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_caja: DataTypes.INTEGER,
  id_usuario: DataTypes.INTEGER,
  id_venta: DataTypes.INTEGER,
  tipo: DataTypes.STRING(10),
  concepto: DataTypes.STRING(150),
  valor: DataTypes.DECIMAL(12, 2),
});

Categoria.hasMany(Fragancia, { foreignKey: 'id_categoria' });
Fragancia.belongsTo(Categoria, { foreignKey: 'id_categoria' });
Fragancia.hasMany(Producto, { foreignKey: 'id_fragancia' });
Producto.belongsTo(Fragancia, { foreignKey: 'id_fragancia' });

module.exports = {
  sequelize,
  Usuario,
  Categoria,
  Fragancia,
  Producto,
  Configuracion,
  Auditoria,
  CajaDiaria,
  Venta,
  DetalleVenta,
  MovimientoInventario,
  MovimientoCaja,
};
