import { createContext, useContext, useEffect, useState } from 'react';
import { obtener } from '../api/cliente.js';

// Si la API no responde, el sitio sigue mostrando los datos de contacto de siempre.
const PREDETERMINADO = {
  whatsapp: '573233278897',
  correo: 'MorazulFragancias@gmail.com',
  ciudad: 'Neiva, Huila',
  horario: null,
  direccion: null,
};

const ContactoContext = createContext(PREDETERMINADO);

export function ContactoProvider({ children }) {
  const [contacto, setContacto] = useState(PREDETERMINADO);

  useEffect(() => {
    let vigente = true;
    obtener('/api/publico/contacto')
      .then((datos) => vigente && setContacto({ ...PREDETERMINADO, ...datos }))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  return <ContactoContext.Provider value={contacto}>{children}</ContactoContext.Provider>;
}

export function useContacto() {
  return useContext(ContactoContext);
}
