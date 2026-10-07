const { Auditoria } = require('../modelos');

// Registra quién cambió qué. Se llama dentro de la misma transacción del cambio.
function auditar(transaccion, idUsuario, entidad, idRegistro, accion, detalle = null) {
  return Auditoria.create(
    { id_usuario: idUsuario, entidad, id_registro: idRegistro, accion, detalle },
    { transaction: transaccion }
  );
}

module.exports = { auditar };
