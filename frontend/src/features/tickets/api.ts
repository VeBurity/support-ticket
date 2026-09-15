import { apiFetch, apiFetchEnvelope } from '@/lib/api-client';
import type {
  PaginatedTickets,
  TicketCategory,
  TicketChannel,
  TicketDetail,
  TicketHistoryEvent,
  TicketPriority,
  TicketStatus,
} from '@/types/api';

export interface TicketFiltersState {
  status?: TicketStatus;
  priority?: TicketPriority;
  customerId?: string;
  assignedToId?: string;
  category?: TicketCategory;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  overdue?: boolean;
  cursor?: string;
  limit?: number;
}

export interface CreateTicketInput {
  customerId: string;
  title: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  channel?: TicketChannel;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
}

function buildQuery(filters: TicketFiltersState): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && value !== null) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listTickets(
  filters: TicketFiltersState,
): Promise<PaginatedTickets> {
  const envelope = await apiFetchEnvelope<PaginatedTickets['data']>(
    `/tickets${buildQuery(filters)}`,
  );
  return {
    data: envelope.data,
    meta: (envelope.meta ?? { nextCursor: null, limit: 20 }) as PaginatedTickets['meta'],
  };
}

export function getTicket(id: string) {
  return apiFetch<TicketDetail>(`/tickets/${id}`);
}

export function createTicket(input: CreateTicketInput) {
  return apiFetch<TicketDetail>('/tickets', { method: 'POST', body: input });
}

export function updateTicket(id: string, input: UpdateTicketInput) {
  return apiFetch<TicketDetail>(`/tickets/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function changeTicketStatus(id: string, status: TicketStatus) {
  return apiFetch<TicketDetail>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function assignTicket(id: string, assignedToId: string) {
  return apiFetch<TicketDetail>(`/tickets/${id}/assign`, {
    method: 'PATCH',
    body: { assignedToId },
  });
}

export function addComment(id: string, body: string, isInternal?: boolean) {
  return apiFetch(`/tickets/${id}/comments`, {
    method: 'POST',
    body: { body, isInternal },
  });
}

export function getTicketHistory(id: string) {
  return apiFetch<TicketHistoryEvent[]>(`/tickets/${id}/history`);
}
