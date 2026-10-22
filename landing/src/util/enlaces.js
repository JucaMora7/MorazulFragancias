// Dirección del panel de administración (otra aplicación, desplegada por separado).
// Se define con VITE_ADMIN_URL en el .env de la raíz; por defecto, el panel local.
export const URL_ADMIN = (import.meta.env.VITE_ADMIN_URL || 'http://localhost:5173').replace(/\/+$/, '');
