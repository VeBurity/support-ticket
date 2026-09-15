import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

export function ticketVisibilityWhere(
  user: AuthenticatedUser,
): Prisma.TicketWhereInput | undefined {
  if (user.role === 'AGENT') {
    return { OR: [{ assignedToId: user.id }, { assignedToId: null }] };
  }
  return undefined;
}

export function isTicketOwner(
  ticket: { assignedToId: string | null },
  user: AuthenticatedUser,
): boolean {
  return ticket.assignedToId === user.id;
}
