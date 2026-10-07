import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Las variables VITE_* se leen del .env de la raíz del proyecto (el mismo de la API).
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/preparar.js',
    css: false,
  },
});
