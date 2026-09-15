import { z } from 'zod';

/**
 * Mensajes en español para los schemas de Zod usados por React Hook
 * Form en toda la app — evita tener que traducir el mensaje de cada
 * campo uno por uno (ej. un <Select> sin valor todavía dispara
 * "invalid_type" con input undefined, no solo los campos de texto).
 */
z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_format' && issue.format === 'email') {
      return 'Ingresa un email válido.';
    }
    if (issue.code === 'too_small') {
      return issue.origin === 'string'
        ? `Debe tener al menos ${issue.minimum} caracteres.`
        : undefined;
    }
    if (issue.code === 'too_big') {
      return issue.origin === 'string'
        ? `Debe tener como máximo ${issue.maximum} caracteres.`
        : undefined;
    }
    if (issue.code === 'invalid_type' && issue.input === undefined) {
      return 'Este campo es obligatorio.';
    }
    return undefined;
  },
});
