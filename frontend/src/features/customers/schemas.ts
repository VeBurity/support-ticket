import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres.').max(150),
  email: z.string().email('Ingresa un email válido.'),
  company: z.string().max(150).optional().or(z.literal('')),
});

export type CreateCustomerFormInput = z.infer<typeof createCustomerSchema>;
