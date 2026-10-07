// Almacenamiento de imágenes. Hoy guarda en disco local (api/uploads); cuando se defina
// el proveedor (AWS S3 u otro) solo hay que reemplazar guardar, eliminar y url por esta misma interfaz.
// La base de datos guarda únicamente la clave relativa, por ejemplo "fragancias/cab-001-1730000000.webp".
const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

function rutaSegura(clave) {
  const raiz = path.resolve(config.imagenes.carpeta);
  const destino = path.resolve(raiz, clave);
  if (destino !== raiz && !destino.startsWith(raiz + path.sep)) {
    throw new Error('Clave de archivo no válida');
  }
  return destino;
}

async function guardar(clave, buffer) {
  const destino = rutaSegura(clave);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, buffer);
}

async function eliminar(clave) {
  try {
    await fs.unlink(rutaSegura(clave));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// Borrado de un archivo que ya no se usa: si falla (archivo en uso, permisos) no debe tumbar la
// solicitud, porque la base ya quedó actualizada. Queda registrado para limpiarlo después.
async function eliminarSiPuede(clave) {
  try {
    await eliminar(clave);
  } catch (err) {
    console.warn(`No se pudo borrar el archivo ${clave}: ${err.code || err.message}`);
  }
}

// Dirección pública de una clave guardada en la base.
function url(clave) {
  return clave ? `${config.imagenes.urlBase}/${clave}` : null;
}

module.exports = { guardar, eliminar, eliminarSiPuede, url };
