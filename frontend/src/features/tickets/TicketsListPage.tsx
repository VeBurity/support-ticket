import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/features/tickets/components/StatusBadge';
import { PriorityBadge } from '@/features/tickets/components/PriorityBadge';
import { SlaCountdown } from '@/features/tickets/components/SlaCountdown';
import { TicketFilters } from '@/features/tickets/components/TicketFilters';
import { TicketCreateDialog } from '@/features/tickets/TicketCreateDialog';
import { listTickets, type TicketFiltersState } from '@/features/tickets/api';
import { useAuthStore } from '@/features/auth/auth-store';

const FILTER_KEYS: (keyof TicketFiltersState)[] = [
  'status',
  'priority',
  'customerId',
  'assignedToId',
  'category',
  'dateFrom',
  'dateTo',
  'q',
];

function parseFilters(params: URLSearchParams): TicketFiltersState {
  const filters: TicketFiltersState = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) {
      (filters as Record<string, string>)[key] = value;
    }
  }
  if (params.get('overdue') === 'true') {
    filters.overdue = true;
  }
  return filters;
}

export function TicketsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const filters = parseFilters(searchParams);
  const [pageIndex, setPageIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['tickets', filters],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      listTickets({ ...filters, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPageIndex(0);
  }, [filterKey]);

  const pages = query.data?.pages ?? [];
  const tickets = pages[pageIndex]?.data ?? [];
  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex + 1 < pages.length || Boolean(query.hasNextPage);

  function goToPrevPage() {
    setPageIndex((i) => Math.max(0, i - 1));
  }

  function goToNextPage() {
    if (pageIndex + 1 < pages.length) {
      setPageIndex((i) => i + 1);
    } else if (query.hasNextPage) {
      query.fetchNextPage().then(() => setPageIndex((i) => i + 1));
    }
  }

  function handleFilterChange(patch: Partial<TicketFiltersState>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    }
    setSearchParams(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tickets</h1>
        {user && (user.role === 'ADMIN' || user.role === 'AGENT') && (
          <Button onClick={() => setCreateOpen(true)}>Nuevo ticket</Button>
        )}
      </div>

      <TicketFilters
        filters={filters}
        onChange={handleFilterChange}
        onClear={() => setSearchParams(new URLSearchParams())}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Asignado</TableHead>
              <TableHead>Vencimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!query.isPending && tickets.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No hay tickets que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}

            {tickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                className="cursor-pointer"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <TableCell className="font-mono text-sm">
                  {ticket.folio}
                </TableCell>
                <TableCell className="max-w-[280px] truncate">
                  {ticket.title}
                </TableCell>
                <TableCell>{ticket.customer.name}</TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={ticket.priority} />
                </TableCell>
                <TableCell>
                  {ticket.assignedTo?.name ?? (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell>
                  <SlaCountdown
                    slaDueAt={ticket.slaDueAt}
                    isResolved={
                      ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          onClick={goToPrevPage}
          disabled={!canGoPrev}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          onClick={goToNextPage}
          disabled={!canGoNext || query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? 'Cargando…' : 'Siguiente'}
        </Button>
      </div>

      <TicketCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
