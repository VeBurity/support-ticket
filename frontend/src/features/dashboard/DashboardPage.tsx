import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardMetrics } from '@/features/dashboard/api';
import { isStaffMetrics } from '@/types/api';
import { PRIORITY_OPTIONS } from '@/features/tickets/components/PriorityBadge';
import { STATUS_OPTIONS } from '@/features/tickets/components/StatusBadge';

function MetricCard({
  title,
  value,
  href,
  highlight,
}: {
  title: string;
  value: ReactNode;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <Card className={highlight ? 'border-destructive' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={highlight ? 'text-3xl font-bold text-destructive' : 'text-3xl font-bold'}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}

export function DashboardPage() {
  const query = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: getDashboardMetrics,
    staleTime: 30_000,
  });

  if (query.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const metrics = query.data;
  if (!metrics) return null;

  const totalOpen = STATUS_OPTIONS.filter(
    (s) => s.value !== 'RESOLVED' && s.value !== 'CLOSED',
  ).reduce((sum, s) => sum + metrics.byStatus[s.value], 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Tickets abiertos" value={totalOpen} href="/tickets" />
        <MetricCard
          title="Vencidos"
          value={metrics.overdueCount}
          href="/tickets?overdue=true"
          highlight={metrics.overdueCount > 0}
        />
        {isStaffMetrics(metrics) ? (
          <>
            <MetricCard
              title="Tiempo prom. resolución (30d)"
              value={
                metrics.avgResolutionHours !== null
                  ? `${metrics.avgResolutionHours.toFixed(1)} h`
                  : '—'
              }
            />
            <MetricCard
              title="Agentes activos"
              value={metrics.byAgent.length}
            />
          </>
        ) : (
          <MetricCard title="Sin asignar" value={metrics.unassignedCount} href="/tickets" />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tickets por estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STATUS_OPTIONS.map((s) => (
              <div key={s.value} className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold">
                  {metrics.byStatus[s.value]}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isStaffMetrics(metrics) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Distribución por prioridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRIORITY_OPTIONS.map((p) => (
                  <div
                    key={p.value}
                    className="rounded-md border p-3 text-center"
                  >
                    <p className="text-2xl font-semibold">
                      {metrics.byPriority[p.value]}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tickets por agente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.byAgent.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin datos.</p>
              )}
              {metrics.byAgent.map((row) => (
                <div
                  key={row.agentId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{row.agentName}</span>
                  <span className="font-medium">{row.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
