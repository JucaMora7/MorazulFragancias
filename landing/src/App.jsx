import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ContactoProvider } from './util/ContactoContext.jsx';
import Estructura from './componentes/Estructura.jsx';
import Inicio from './paginas/Inicio.jsx';
import Catalogo from './paginas/Catalogo.jsx';
import Detalle from './paginas/Detalle.jsx';
import Contacto from './paginas/Contacto.jsx';
import NoEncontrada from './paginas/NoEncontrada.jsx';

export default function App() {
  return (
    <ContactoProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Estructura />}>
            <Route index element={<Inicio />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="producto/:codigo" element={<Detalle />} />
            <Route path="contacto" element={<Contacto />} />
            <Route path="*" element={<NoEncontrada />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ContactoProvider>
  );
}
