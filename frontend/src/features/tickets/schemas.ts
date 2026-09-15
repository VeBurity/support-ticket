import { z } from 'zod';

export const createTicketSchema = z.object({
  customerId: z.string('Selecciona un cliente.').uuid('Selecciona un cliente.'),
  title: z.string().min(5, 'Mínimo 5 caracteres.').max(150),
  description: z.string().min(10, 'Mínimo 10 caracteres.').max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'Selecciona una prioridad.'),
  category: z.enum(['BILLING', 'TECHNICAL_SUPPORT', 'ACCESS', 'OTHER'], 'Selecciona una categoría.'),
});

export type CreateTicketFormInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  title: z.string().min(5).max(150).optional(),
  description: z.string().min(10).max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'Selecciona una prioridad.').optional(),
  category: z.enum(['BILLING', 'TECHNICAL_SUPPORT', 'ACCESS', 'OTHER'], 'Selecciona una categoría.').optional(),
});

export type UpdateTicketFormInput = z.infer<typeof updateTicketSchema>;

export const changeStatusSchema = z.object({
  status: z.enum(
    ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED'],
    'Selecciona un estado.',
  ),
});

export const commentSchema = z.object({
  body: z.string().min(1, 'Escribe un comentario.').max(3000),
  isInternal: z.boolean().optional(),
});

export type CommentFormInput = z.infer<typeof commentSchema>;
