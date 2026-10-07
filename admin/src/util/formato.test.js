import { describe, expect, it } from 'vitest';
import {
  diaMesCorto,
  fechaConHora,
  fechaCompleta,
  fechaHoraCorta,
  fechaLarga,
  horaCorta,
  hoyISO,
  numero,
  numeroVenta,
  partesBogota,
  pesos,
  pesosConSigno,
  plural,
  rangoTexto,
  saludo,
  sumarDias,
} from './formato.js';

// 7 de octubre de 2026, 15:44 en Bogotá (UTC-5) = 20:44 UTC.
const AHORA = new Date('2026-10-07T20:44:00Z');

describe('pesos', () => {
  it('agrupa los miles con punto y antepone el signo', () => {
    expect(pesos(286000)).toBe('$ 286.000');
    expect(pesos(7803000)).toBe('$ 7.803.000');
    expect(pesos(0)).toBe('$ 0');
    expect(pesos(999)).toBe('$ 999');
    expect(pesos('40000.00')).toBe('$ 40.000');
  });
  it('muestra decimales solo si los hay', () => {
    expect(pesos(1500.5)).toBe('$ 1.500,50');
  });
  it('maneja negativos y valores vacíos', () => {
    expect(pesos(-14000)).toBe('−$ 14.000');
    expect(pesos(null)).toBe('—');
    expect(pesos(undefined)).toBe('—');
    expect(pesos('abc')).toBe('—');
  });
  it('pone signo explícito a ingresos y egresos', () => {
    expect(pesosConSigno(178000, true)).toBe('+ $ 178.000');
    expect(pesosConSigno(14000, false)).toBe('− $ 14.000');
  });
});

describe('números y textos', () => {
  it('formatea cantidades con separador de miles', () => {
    expect(numero(1234567)).toBe('1.234.567');
    expect(numero('12')).toBe('12');
    expect(numero(null)).toBe('0');
  });
  it('arma el número de venta con ceros a la izquierda', () => {
    expect(numeroVenta(7)).toBe('#0007');
    expect(numeroVenta(12345)).toBe('#12345');
  });
  it('escoge singular o plural', () => {
    expect(plural(1, 'venta', 'ventas')).toBe('venta');
    expect(plural(0, 'venta', 'ventas')).toBe('ventas');
    expect(plural(3, 'venta', 'ventas')).toBe('ventas');
  });
});

describe('fechas en hora de Bogotá', () => {
  it('calcula la fecha de hoy según Bogotá, no según UTC', () => {
    expect(hoyISO(AHORA)).toBe('2026-10-07');
    // 02:30 UTC del día 8 sigue siendo el 7 en Bogotá (21:30).
    expect(hoyISO(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07');
    expect(hoyISO(new Date('2026-10-08T05:00:00Z'))).toBe('2026-10-08');
  });
  it('extrae las partes de una marca de tiempo', () => {
    expect(partesBogota(AHORA)).toMatchObject({ anio: 2026, mes: 10, dia: 7, hora: 15, minuto: 44 });
  });
  it('suma y resta días cruzando mes y año', () => {
    expect(sumarDias('2026-10-07', -6)).toBe('2026-10-01');
    expect(sumarDias('2026-10-07', -29)).toBe('2026-09-08');
    expect(sumarDias('2026-01-02', -3)).toBe('2025-12-30');
    expect(sumarDias('2026-02-27', 2)).toBe('2026-03-01');
  });
  it('escribe fechas largas en español', () => {
    expect(fechaLarga('2026-10-07')).toBe('Miércoles, 7 de octubre de 2026');
    expect(fechaLarga('2026-10-06')).toBe('Martes, 6 de octubre de 2026');
    expect(fechaCompleta('2026-09-06')).toBe('6 de septiembre de 2026');
    expect(diaMesCorto('2026-09-08')).toBe('8 sep');
  });
  it('escribe horas con a. m. y p. m.', () => {
    expect(horaCorta('2026-10-07T20:44:00Z')).toBe('3:44 p. m.');
    expect(horaCorta('2026-10-07T15:42:00Z')).toBe('10:42 a. m.');
    expect(horaCorta('2026-10-07T17:00:00Z')).toBe('12:00 p. m.');
    expect(horaCorta('2026-10-07T05:05:00Z')).toBe('12:05 a. m.');
  });
  it('combina fecha y hora', () => {
    expect(fechaHoraCorta('2026-10-06T15:42:00Z')).toBe('6 oct, 10:42');
    expect(fechaConHora('2026-10-05T21:05:00Z')).toBe('5 oct, 4:05 p. m.');
  });
  it('saluda según la hora', () => {
    expect(saludo(new Date('2026-10-07T13:00:00Z'))).toBe('Buenos días'); // 8:00
    expect(saludo(AHORA)).toBe('Buenas tardes'); // 15:44
    expect(saludo(new Date('2026-10-08T01:30:00Z'))).toBe('Buenas noches'); // 20:30
  });
  it('describe un rango de fechas', () => {
    expect(rangoTexto('2026-09-08', '2026-10-07')).toBe('Del 8 de septiembre al 7 de octubre de 2026');
    expect(rangoTexto('2026-10-07', '2026-10-07')).toBe('7 de octubre de 2026');
    expect(rangoTexto('2025-12-20', '2026-01-18')).toBe('Del 20 de diciembre de 2025 al 18 de enero de 2026');
  });
});
