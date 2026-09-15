import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCustomer } from '@/features/customers/api';
import {
  createCustomerSchema,
  type CreateCustomerFormInput,
} from '@/features/customers/schemas';
import type { Customer } from '@/types/api';

interface CustomerCreateDialogProps {
  open: boolean;
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}

export function CustomerCreateDialog({
  open,
  initialName,
  onOpenChange,
  onCreated,
}: CustomerCreateDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCustomerFormInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: { name: initialName, email: '', company: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ name: initialName, email: '', company: '' });
    }
  }, [open, initialName, reset]);

  const mutation = useMutation({
    mutationFn: (input: CreateCustomerFormInput) =>
      createCustomer({
        name: input.name,
        email: input.email,
        company: input.company || undefined,
      }),
    onSuccess: (customer) => {
      onCreated(customer);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nombre</Label>
            <Input id="customer-name" {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input id="customer-email" type="email" {...register('email')} />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-company">Empresa (opcional)</Label>
            <Input id="customer-company" {...register('company')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando…' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
