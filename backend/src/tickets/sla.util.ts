import { TicketPriority } from '@prisma/client';

const SLA_HOURS: Record<TicketPriority, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  CRITICAL: 8,
};

export function computeSlaDueAt(
  priority: TicketPriority,
  from: Date = new Date(),
): Date {
  const dueAt = new Date(from);
  dueAt.setHours(dueAt.getHours() + SLA_HOURS[priority]);
  return dueAt;
}
