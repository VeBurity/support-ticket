import type { ErrorCode } from '@/types/api';

export const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: 'Revisa los datos ingresados.',
  AUTH_INVALID_CREDENTIALS: 'Email o contraseña incorrectos.',
  AUTH_USER_BLOCKED: 'Tu cuenta está bloqueada. Contacta a un administrador.',
  AUTH_TOKEN_EXPIRED: 'Tu sesión expiró. Inicia sesión de nuevo.',
  AUTH_TOKEN_INVALID: 'Tu sesión ya no es válida. Inicia sesión de nuevo.',
  FORBIDDEN_ROLE: 'No tienes permisos para realizar esta acción.',
  FORBIDDEN_OWNERSHIP: 'Solo puedes hacer esto en tickets asignados a ti.',
  INVALID_STATUS_TRANSITION: 'Ese cambio de estado no está permitido.',
  TICKET_NOT_FOUND: 'El ticket no existe o no tienes acceso a él.',
  CUSTOMER_NOT_FOUND: 'El cliente no existe.',
  USER_NOT_FOUND: 'El usuario no existe.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Intenta de nuevo.',
};

export function messageForError(code: ErrorCode, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? 'Ocurrió un error inesperado.';
}
