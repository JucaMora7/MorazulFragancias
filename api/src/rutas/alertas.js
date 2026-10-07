// Alertas de stock crítico. Las crea y resuelve la base de datos (disparador); aquí solo se consultan.
const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../modelos');
const { opcion, paginacion } = require('../utilidades/validar');

const router = express.Router();

router.get('/', async (req, res) => {
  const { pagina, limite, desplazamiento } = paginacion(req.query, { limitePorDefecto: 50, limiteMax: 200 });
  const condiciones = [];
  const reemplazos = { limite, desplazamiento };
  if (req.query.estado !== undefined) {
    reemplazos.estado = opcion(req.query.estado, 'estado', ['activa', 'resuelta']);
    condiciones.push('a.estado = :estado');
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const alertas = await sequelize.query(
    `SELECT a.id_alerta, a.estado, a.generada_en, a.resuelta_en,
            a.existencias_al_generar, a.umbral_al_generar,
            p.id_producto, p.codigo, p.nombre AS producto, p.presentacion_ml,
            p.existencias AS existencias_actuales, p.umbral_minimo AS umbral_actual
       FROM alerta_stock a JOIN v_producto p USING (id_producto) ${donde}
      ORDER BY a.generada_en DESC, a.id_alerta DESC LIMIT :limite OFFSET :desplazamiento`,
    { replacements: reemplazos, type: QueryTypes.SELECT }
  );
  const [{ total }] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM alerta_stock a ${donde}`, {
    replacements: reemplazos,
    type: QueryTypes.SELECT,
  });
  res.json({ pagina, limite, total, total_paginas: Math.ceil(total / limite), alertas });
});

module.exports = router;
