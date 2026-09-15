import { apiFetch } from '@/lib/api-client';
import type { Customer } from '@/types/api';

export function searchCustomers(q: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetch<Customer[]>(`/customers${qs}`);
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  company?: string;
}

export function createCustomer(input: CreateCustomerInput) {
  return apiFetch<Customer>('/customers', { method: 'POST', body: input });
}
