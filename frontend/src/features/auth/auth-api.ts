import { apiFetch } from '@/lib/api-client';
import type { PublicUser } from '@/types/api';

export interface LoginResponse {
  accessToken: string;
  user: PublicUser;
}

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function refresh() {
  return apiFetch<{ accessToken: string }>('/auth/refresh', {
    method: 'POST',
    skipAuthRetry: true,
  });
}

export function logout() {
  return apiFetch<null>('/auth/logout', { method: 'POST' });
}

export function me() {
  return apiFetch<PublicUser>('/auth/me');
}
