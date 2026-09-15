import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { useAuthStore } from '@/features/auth/auth-store';
import { StatusBadge, STATUS_OPTIONS } from '@/features/tickets/components/StatusBadge';
import { PriorityBadge } from '@/features/tickets/components/PriorityBadge';
import { SlaCountdown } from '@/features/tickets/components/SlaCountdown';
import { CATEGORY_LABEL } from '@/features/tickets/constants';
import {
  addComment,
  assignTicket,
  changeTicketStatus,
  getTicket,
  getTicketHistory,
} from '@/features/tickets/api';
import { commentSchema, type CommentFormInput } from '@/features/tickets/schemas';
import { listUsers } from '@/features/users/api';
import type { TicketStatus } from '@/types/api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id!),
    enabled: Boolean(id),
  });

  const canViewHistory = Boolean(
    ticketQuery.data &&
      user &&
      (user.role === 'ADMIN' ||
        user.role === 'SUPERVISOR' ||
        ticketQuery.data.assignedToId === user.id),
  );

  const historyQuery = useQuery({
    queryKey: ['ticket', id, 'history'],
    queryFn: () => getTicketHistory(id!),
    enabled: Boolean(id) && canViewHistory,
  });

  const agentsQuery = useQuery({
    queryKey: ['users', { role: 'AGENT' }],
    queryFn: () => listUsers({ role: 'AGENT' }),
    enabled: user?.role === 'ADMIN' || user?.role === 'SUPERVISOR',
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => changeTicketStatus(id!, status),
    meta: { skipGlobalToast: true },
    onSuccess: (ticket) => {
      queryClient.setQueryData(['ticket', id], ticket);
      queryClient.invalidateQueries({ queryKey: ['ticket', id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Estado actualizado.');
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(messageForError(error.code, error.message));
      }
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string) => assignTicket(id!, assignedToId),
    onSuccess: (ticket) => {
      queryClient.setQueryData(['ticket', id], ticket);
      queryClient.invalidateQueries({ queryKey: ['ticket', id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket reasignado.');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CommentFormInput>({ resolver: zodResolver(commentSchema) });

  const isInternal = watch('isInternal');

  const commentMutation = useMutation({
    mutationFn: (input: CommentFormInput) =>
      addComment(id!, input.body, input.isInternal),
    onSuccess: () => {
      reset({ body: '', isInternal: false });
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  if (ticketQuery.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <p className="text-muted-foreground">
        {ticketQuery.error instanceof ApiError
          ? messageForError(ticketQuery.error.code, ticketQuery.error.message)
          : 'No se pudo cargar el ticket.'}
      </p>
    );
  }

  const ticket = ticketQuery.data;
  const isOwnerAgent = user?.role === 'AGENT' && ticket.assignedToId === user.id;
  const canChangeStatus = user?.role === 'ADMIN' || isOwnerAgent;
  const canAssign = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const canComment =
    user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || isOwnerAgent;
  const canMarkInternal = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{ticket.folio}</h1>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SlaCountdown
            slaDueAt={ticket.slaDueAt}
            isResolved={ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'}
          />
        </div>
        <h2 className="mt-2 text-lg">{ticket.title}</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comentarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin comentarios todavía.
                </p>
              )}
              {ticket.comments.map((comment) => (
                <div key={comment.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(comment.createdAt)}</span>
                    {comment.isInternal && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Interno
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                </div>
              ))}

              {canComment ? (
                <form
                  className="space-y-2 pt-2"
                  onSubmit={handleSubmit((values) =>
                    commentMutation.mutate(values),
                  )}
                >
                  <Textarea
                    rows={3}
                    placeholder="Escribe un comentario…"
                    {...register('body')}
                  />
                  {errors.body && (
                    <p className="text-sm text-destructive">
                      {errors.body.message}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    {canMarkInternal ? (
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(isInternal)}
                          onChange={(e) =>
                            setValue('isInternal', e.target.checked)
                          }
                        />
                        Comentario interno
                      </label>
                    ) : (
                      <span />
                    )}
                    <Button type="submit" disabled={commentMutation.isPending}>
                      {commentMutation.isPending ? 'Enviando…' : 'Comentar'}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No puedes comentar en este ticket.
                </p>
              )}
            </CardContent>
          </Card>

          {canViewHistory && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="status">
                <TabsList>
                  <TabsTrigger value="status">Estado</TabsTrigger>
                  <TabsTrigger value="assignment">Reasignaciones</TabsTrigger>
                </TabsList>
                <TabsContent value="status" className="space-y-2 pt-3">
                  {(historyQuery.data ?? [])
                    .filter((e) => e.type === 'STATUS_CHANGE')
                    .map((event, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {formatDate(event.at)} ·{' '}
                        </span>
                        {event.fromStatus ? (
                          <StatusBadge status={event.fromStatus} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        <span>→</span>
                        <StatusBadge status={event.toStatus} />
                        <span>por {event.changedBy.name}</span>
                      </div>
                    ))}
                  {historyQuery.data?.filter((e) => e.type === 'STATUS_CHANGE')
                    .length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Sin cambios de estado todavía.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="assignment" className="space-y-2 pt-3">
                  {(historyQuery.data ?? [])
                    .filter((e) => e.type === 'ASSIGNMENT')
                    .map((event, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-muted-foreground">
                          {formatDate(event.at)} ·{' '}
                        </span>
                        {event.fromUser?.name ?? 'Sin asignar'} →{' '}
                        {event.toUser?.name ?? 'Sin asignar'} por{' '}
                        {event.changedBy.name}
                      </div>
                    ))}
                  {historyQuery.data?.filter((e) => e.type === 'ASSIGNMENT')
                    .length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Sin reasignaciones todavía.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Cliente: </span>
                {ticket.customer.name}
              </div>
              <div>
                <span className="text-muted-foreground">Categoría: </span>
                {CATEGORY_LABEL[ticket.category]}
              </div>
              <div>
                <span className="text-muted-foreground">Canal: </span>
                {ticket.channel}
              </div>
              <div>
                <span className="text-muted-foreground">Creado por: </span>
                {ticket.createdBy.name}
              </div>
              <div>
                <span className="text-muted-foreground">Asignado a: </span>
                {ticket.assignedTo?.name ?? 'Sin asignar'}
              </div>
              <div>
                <span className="text-muted-foreground">Creado: </span>
                {formatDate(ticket.createdAt)}
              </div>
              {ticket.reassignmentCount > 0 && (
                <div>
                  <span className="text-muted-foreground">
                    Reasignaciones:{' '}
                  </span>
                  {ticket.reassignmentCount}
                </div>
              )}
            </CardContent>
          </Card>

          {(canChangeStatus || canAssign) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canChangeStatus && (
                  <div className="space-y-2">
                    <Label>Cambiar estado</Label>
                    <Select
                      value={ticket.status}
                      onValueChange={(v) =>
                        statusMutation.mutate(v as TicketStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {canAssign && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Reasignar a</Label>
                      <Select
                        value={ticket.assignedToId ?? undefined}
                        onValueChange={(v) => assignMutation.mutate(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un agente…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(agentsQuery.data ?? []).map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
