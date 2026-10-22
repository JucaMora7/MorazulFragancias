// Dirección de la landing pública (otra aplicación, desplegada por separado).
// Se define con VITE_LANDING_URL en el .env de la raíz; por defecto, la landing local.
export const URL_SITIO = (import.meta.env.VITE_LANDING_URL || 'http://localhost:5174').replace(/\/+$/, '');
