import { apiFetch } from '@/lib/api-client';
import type { PublicUser, Role, UserStatus } from '@/types/api';

export interface ListUsersFilters {
  role?: Role;
  status?: UserStatus;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

function buildQuery(filters: ListUsersFilters): string {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listUsers(filters: ListUsersFilters = {}) {
  return apiFetch<PublicUser[]>(`/users${buildQuery(filters)}`);
}

export function createUser(input: CreateUserInput) {
  return apiFetch<PublicUser>('/users', { method: 'POST', body: input });
}

export function updateUserStatus(id: string, status: UserStatus) {
  return apiFetch<PublicUser>(`/users/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}
