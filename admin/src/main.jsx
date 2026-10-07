import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/paginas.css';
import App from './App.jsx';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
