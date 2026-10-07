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

Categoria.hasMany(Fragancia, { foreignKey: 'id_categoria' });
Fragancia.belongsTo(Categoria, { foreignKey: 'id_categoria' });
Fragancia.hasMany(Producto, { foreignKey: 'id_fragancia' });
Producto.belongsTo(Fragancia, { foreignKey: 'id_fragancia' });

module.exports = { sequelize, Usuario, Categoria, Fragancia, Producto, Configuracion, Auditoria };
