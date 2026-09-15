import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CustomerCombobox } from '@/features/customers/CustomerCombobox';
import { CustomerCreateDialog } from '@/features/customers/CustomerCreateDialog';
import { PRIORITY_OPTIONS } from '@/features/tickets/components/PriorityBadge';
import { CATEGORY_OPTIONS } from '@/features/tickets/constants';
import { createTicket, assignTicket, type CreateTicketInput } from '@/features/tickets/api';
import { listUsers } from '@/features/users/api';
import { useAuthStore } from '@/features/auth/auth-store';
import {
  createTicketSchema,
  type CreateTicketFormInput,
} from '@/features/tickets/schemas';

const UNASSIGNED = '__unassigned__';

interface TicketCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketCreateDialog({ open, onOpenChange }: TicketCreateDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialName, setDialogInitialName] = useState('');
  const [assignedToId, setAssignedToId] = useState<string | undefined>(undefined);

  const canAssign = authUser?.role === 'ADMIN' || authUser?.role === 'SUPERVISOR';

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateTicketFormInput>({
    resolver: zodResolver(createTicketSchema),
  });

  const customerId = watch('customerId');

  const agentsQuery = useQuery({
    queryKey: ['users', { role: 'AGENT' }],
    queryFn: () => listUsers({ role: 'AGENT' }),
    enabled: canAssign && open,
  });

  const mutation = useMutation({
    mutationFn: async (values: CreateTicketInput) => {
      const ticket = await createTicket(values);
      return assignedToId ? assignTicket(ticket.id, assignedToId) : ticket;
    },
    onSuccess: (ticket) => {
      toast.success(`Ticket ${ticket.folio} creado.`);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      reset();
      setAssignedToId(undefined);
      onOpenChange(false);
      navigate(`/tickets/${ticket.id}`);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setAssignedToId(undefined);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label>Cliente</Label>
            <CustomerCombobox
              value={customerId}
              onSelect={(customer) =>
                setValue('customerId', customer.id, { shouldValidate: true })
              }
              onCreateNew={(query) => {
                setDialogInitialName(query);
                setDialogOpen(true);
              }}
            />
            {errors.customerId && (
              <p className="text-sm text-destructive">
                {errors.customerId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" {...register('title')} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={5} {...register('description')} />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.priority && (
                <p className="text-sm text-destructive">
                  {errors.priority.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Categoría</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p className="text-sm text-destructive">
                  {errors.category.message}
                </p>
              )}
            </div>
          </div>

          {canAssign && (
            <div className="space-y-2">
              <Label>Asignar a (opcional)</Label>
              <Select
                value={assignedToId ?? UNASSIGNED}
                onValueChange={(v) =>
                  setAssignedToId(v === UNASSIGNED ? undefined : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
                  {(agentsQuery.data ?? []).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando…' : 'Crear ticket'}
            </Button>
          </DialogFooter>
        </form>

        <CustomerCreateDialog
          open={dialogOpen}
          initialName={dialogInitialName}
          onOpenChange={setDialogOpen}
          onCreated={(customer) =>
            setValue('customerId', customer.id, { shouldValidate: true })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
