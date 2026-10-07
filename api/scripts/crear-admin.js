// Crea el administrador del panel. Pide los datos por consola: la contraseña no se
// escribe en argumentos ni queda en el historial, y se guarda solo como hash bcrypt.
// Uso: npm run crear-admin   (desde la carpeta api/)
const readline = require('readline');
const { sequelize } = require('../src/modelos');
const config = require('../src/config');
const { crearAdministrador } = require('../src/servicios/usuarios');

function preguntar(texto, { oculto = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (cadena) => {
        if (cadena.includes(texto)) rl.output.write(cadena);
      };
    }
    rl.question(texto, (respuesta) => {
      if (oculto) process.stdout.write('\n');
      rl.close();
      resolve(respuesta);
    });
  });
}

async function main() {
  config.validar();
  await sequelize.authenticate();
  console.log(`Base de datos: ${config.db.nombre} (puerto ${config.db.puerto})`);

  const nombre = await preguntar('Nombre completo: ');
  const correo = await preguntar('Correo: ');
  const contrasena = await preguntar('Contraseña (mínimo 10 caracteres): ', { oculto: true });
  const repetida = await preguntar('Repite la contraseña: ', { oculto: true });
  if (contrasena !== repetida) throw new Error('Las contraseñas no coinciden');

  const usuario = await crearAdministrador({ nombre, correo, contrasena });
  console.log(`Administrador creado: ${usuario.nombre} <${usuario.correo}>`);
}

main()
  .catch((err) => {
    console.error(`No se pudo crear el administrador: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
