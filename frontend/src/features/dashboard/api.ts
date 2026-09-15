import { apiFetch } from '@/lib/api-client';
import type { DashboardMetrics } from '@/types/api';

export function getDashboardMetrics() {
  return apiFetch<DashboardMetrics>('/dashboard/metrics');
}
