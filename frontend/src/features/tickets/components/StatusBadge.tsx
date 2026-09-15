import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types/api';

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  PENDING_CUSTOMER: 'Pendiente cliente',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

const STATUS_CLASS: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  IN_PROGRESS:
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  PENDING_CUSTOMER:
    'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  RESOLVED:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant="outline" className={cn('border-0', STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export const STATUS_OPTIONS: { value: TicketStatus; label: string }[] =
  Object.entries(STATUS_LABEL).map(([value, label]) => ({
    value: value as TicketStatus,
    label,
  }));
