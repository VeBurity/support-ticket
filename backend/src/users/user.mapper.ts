import { User } from '@prisma/client';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  status: User['status'];
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}
