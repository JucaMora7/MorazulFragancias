// Genera db/migrations/003_carga_catalogo.sql a partir de data/fragancias.json.
// Uso: node db/scripts/generar_carga_catalogo.js
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const fragancias = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'fragancias.json'), 'utf8'));

const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const categorias = [];
for (const f of fragancias) {
  if (!categorias.includes(f.categoria_nombre)) categorias.push(f.categoria_nombre);
}

const filas = fragancias.map(
  (f) =>
    `    (${q(f.categoria_nombre)}, ${q(f.codigo)}, ${q(f.nombre)}, ${q(f.inspirada_en)}, ${f.es_arabe ? 'TRUE' : 'FALSE'}, ${q(f.color_caja)}, ${q(f.nota)})`
);

const sql = `-- =====================================================================
-- MORAZUL · Migración 003: carga del catálogo real
-- Archivo generado con db/scripts/generar_carga_catalogo.js a partir de
-- data/fragancias.json. No editar a mano: cambiar el JSON y regenerar.
--
-- Carga ${categorias.length} categorías, ${fragancias.length} fragancias y ${fragancias.length * 3} productos (una presentación de 30, 60 y 100 ml por fragancia).
--   · 30 ml: $20.000 y 60 ml: $40.000, activos y visibles en la landing.
--   · 100 ml: en borrador y sin precio hasta que el administrador lo fije.
-- Existencias iniciales en 0: el stock real entra con movimientos de entrada.
-- =====================================================================

BEGIN;

INSERT INTO categoria (nombre, descripcion) VALUES
${categorias.map((c) => `    (${q(c)}, NULL)`).join(',\n')};

INSERT INTO imagen_generica (presentacion_ml, color_caja, url) VALUES
    (30,   NULL,     'genericas/generica-30ml.webp'),
    (60,   'azul',   'genericas/generica-60ml-azul.webp'),
    (60,   'morada', 'genericas/generica-60ml-morada.webp'),
    (100,  'azul',   'genericas/generica-100ml-azul.webp'),
    (100,  'morada', 'genericas/generica-100ml-morada.webp'),
    (NULL, NULL,     'genericas/reserva.webp');

INSERT INTO fragancia (id_categoria, codigo, nombre, inspirada_en, es_arabe, color_caja, nota)
SELECT c.id_categoria, v.codigo, v.nombre, v.inspirada_en, v.es_arabe, v.color_caja, v.nota
  FROM (VALUES
${filas.join(',\n')}
  ) AS v (categoria, codigo, nombre, inspirada_en, es_arabe, color_caja, nota)
  JOIN categoria c ON c.nombre = v.categoria;

INSERT INTO producto (id_fragancia, presentacion_ml, precio_venta, estado, visible_landing)
SELECT f.id_fragancia,
       p.ml,
       p.precio,
       CASE WHEN p.precio IS NULL THEN 'borrador' ELSE 'activo' END,
       p.precio IS NOT NULL
  FROM fragancia f
 CROSS JOIN (VALUES (30, 20000::numeric), (60, 40000::numeric), (100, NULL::numeric)) AS p (ml, precio);

COMMIT;
`;

const salida = path.join(raiz, 'db', 'migrations', '003_carga_catalogo.sql');
fs.writeFileSync(salida, sql);
console.log(`Generado ${path.relative(raiz, salida)}: ${fragancias.length} fragancias.`);
