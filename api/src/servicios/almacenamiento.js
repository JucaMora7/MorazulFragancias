// Almacenamiento de imágenes:
// - Desarrollo: disco local.
// - Producción: Vercel Blob, con URLs públicas reales.
const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

const usarBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function rutaSegura(clave) {
  const raiz = path.resolve(config.imagenes.carpeta);
  const destino = path.resolve(raiz, clave);

  if (destino !== raiz && !destino.startsWith(raiz + path.sep)) {
    throw new Error('Clave de archivo no válida');
  }

  return destino;
}

async function guardar(clave, buffer) {
  if (usarBlob()) {
    const { put } = await import('@vercel/blob');
    const resultado = await put(clave, buffer, {
      access: 'public',
      addRandomSuffix: false,
    });

    // La URL devuelta por Blob es la referencia que guardaremos en PostgreSQL.
    return resultado.url;
  }

  const destino = rutaSegura(clave);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, buffer);

  // En local seguimos guardando claves relativas.
  return clave;
}

async function eliminar(clave) {
  if (!clave) return;

  if (usarBlob()) {
    const { del } = await import('@vercel/blob');
    // Blob admite eliminar por URL pública o por pathname.
    await del(clave);
    return;
  }

  // No intentar convertir una URL remota en una ruta del disco local.
  if (/^https?:\/\//i.test(clave)) {
    throw new Error('No se puede eliminar una URL remota desde el almacenamiento local');
  }

  try {
    await fs.unlink(rutaSegura(clave));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// La limpieza de una imagen antigua no debe invalidar una operación ya guardada.
async function eliminarSiPuede(clave) {
  try {
    await eliminar(clave);
  } catch (err) {
    console.warn(`No se pudo borrar el archivo ${clave}: ${err.code || err.message}`);
  }
}

function url(clave) {
  if (!clave) return null;

  // Las imágenes propias almacenadas en Blob ya tienen URL completa.
  if (/^https?:\/\//i.test(clave)) return clave;

  // Una referencia relativa en producción solo es pública si se configura
  // una base externa que contenga esas imágenes genéricas.
  if (usarBlob()) {
    if (!config.imagenes.urlBase) return null;
    return `${config.imagenes.urlBase}/${clave.replace(/^\/+/, '')}`;
  }

  return `${config.imagenes.urlBase}/${clave.replace(/^\/+/, '')}`;
}

module.exports = { guardar, eliminar, eliminarSiPuede, url };
