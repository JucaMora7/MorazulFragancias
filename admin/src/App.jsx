import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SesionProvider, useSesion } from './sesion/SesionContext.jsx';
import Layout from './componentes/Layout.jsx';
import Login from './paginas/Login.jsx';
import Inicio from './paginas/Inicio.jsx';
import Productos from './paginas/Productos.jsx';
import Inventario from './paginas/Inventario.jsx';
import NuevaVenta from './paginas/NuevaVenta.jsx';
import Caja from './paginas/Caja.jsx';
import Reportes from './paginas/Reportes.jsx';
import Alertas from './paginas/Alertas.jsx';

function RutaProtegida() {
  const { sesion } = useSesion();
  const ubicacion = useLocation();
  if (!sesion) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  return <Layout />;
}

export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RutaProtegida />}>
            <Route index element={<Inicio />} />
            <Route path="productos" element={<Productos />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="vender" element={<NuevaVenta />} />
            <Route path="vender/carrito" element={<NuevaVenta soloCarrito />} />
            <Route path="caja" element={<Caja />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="alertas" element={<Alertas />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
