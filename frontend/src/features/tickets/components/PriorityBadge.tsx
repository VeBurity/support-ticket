import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TicketPriority } from '@/types/api';

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge
      variant="outline"
      className={cn('border-0', PRIORITY_CLASS[priority])}
    >
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] =
  Object.entries(PRIORITY_LABEL).map(([value, label]) => ({
    value: value as TicketPriority,
    label,
  }));
