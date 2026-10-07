const sharp = require('sharp');
const config = require('../config');
const { validacion } = require('../utilidades/errores');

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

// Valida el tipo real del archivo por su contenido (no por la extensión ni por lo que declare
// el cliente), lo reduce al ancho máximo y lo convierte a WebP. Devuelve el buffer resultante.
async function prepararImagen(buffer) {
  const { fileTypeFromBuffer } = await import('file-type');
  const tipo = await fileTypeFromBuffer(buffer);
  if (!tipo || !TIPOS_PERMITIDOS.includes(tipo.mime)) {
    throw validacion('El archivo debe ser una imagen JPG, PNG o WebP');
  }
  try {
    return await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: config.imagenes.anchoMax, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw validacion('La imagen está dañada o no se pudo procesar');
  }
}

module.exports = { prepararImagen };
