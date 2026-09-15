import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres.').max(100),
  email: z.string().email('Ingresa un email válido.'),
  password: z.string().min(8, 'Mínimo 8 caracteres.').max(100),
  role: z.enum(['ADMIN', 'AGENT', 'SUPERVISOR'], 'Selecciona un rol.'),
});

export type CreateUserFormInput = z.infer<typeof createUserSchema>;
