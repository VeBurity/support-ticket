import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function formatRemaining(diffMs: number): string {
  const abs = Math.abs(diffMs);
  const hours = Math.floor(abs / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function SlaCountdown({
  slaDueAt,
  isResolved,
}: {
  slaDueAt: string;
  isResolved: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const due = new Date(slaDueAt).getTime();
  const diff = due - now;
  const overdue = diff < 0;

  if (isResolved) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <span
      className={cn(
        'text-sm font-medium',
        overdue ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {overdue
        ? `Vencido hace ${formatRemaining(diff)}`
        : `Vence en ${formatRemaining(diff)}`}
    </span>
  );
}
