import type { TicketCategory } from '@/types/api';

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  BILLING: 'Facturación',
  TECHNICAL_SUPPORT: 'Soporte técnico',
  ACCESS: 'Accesos',
  OTHER: 'Otro',
};

export const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] =
  Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
    value: value as TicketCategory,
    label,
  }));
