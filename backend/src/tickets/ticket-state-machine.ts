import { Role, TicketStatus } from '@prisma/client';

const OPERATIONAL_STATES: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'RESOLVED',
];

export function canTransitionTicketStatus(
  from: TicketStatus,
  to: TicketStatus,
  role: Role,
  isOwner: boolean,
): boolean {
  if (from === to) {
    return false;
  }

  // Cerrar: solo desde RESOLVED, solo Admin.
  if (to === 'CLOSED') {
    return role === 'ADMIN' && from === 'RESOLVED';
  }

  // Reabrir: desde CLOSED o RESOLVED hacia IN_PROGRESS, solo Admin.
  if (from === 'CLOSED' || (from === 'RESOLVED' && to === 'IN_PROGRESS')) {
    return role === 'ADMIN' && to === 'IN_PROGRESS';
  }

  // Movimientos entre estados operativos.
  if (OPERATIONAL_STATES.includes(from) && OPERATIONAL_STATES.includes(to)) {
    if (role === 'ADMIN') {
      return true;
    }
    if (role === 'AGENT') {
      return isOwner;
    }
    return false;
  }

  return false;
}
