import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { STATUS_OPTIONS } from '@/features/tickets/components/StatusBadge';
import { PRIORITY_OPTIONS } from '@/features/tickets/components/PriorityBadge';
import { CATEGORY_OPTIONS } from '@/features/tickets/constants';
import type { TicketFiltersState } from '@/features/tickets/api';

const ALL = '__all__';

interface TicketFiltersProps {
  filters: TicketFiltersState;
  onChange: (patch: Partial<TicketFiltersState>) => void;
  onClear: () => void;
}

export function TicketFilters({
  filters,
  onChange,
  onClear,
}: TicketFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <Input
          placeholder="Buscar por título…"
          value={filters.q ?? ''}
          onChange={(e) => onChange({ q: e.target.value || undefined })}
        />
      </div>

      <Select
        value={filters.status ?? ALL}
        onValueChange={(v) =>
          onChange({ status: v === ALL ? undefined : (v as never) })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority ?? ALL}
        onValueChange={(v) =>
          onChange({ priority: v === ALL ? undefined : (v as never) })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Prioridad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las prioridades</SelectItem>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.category ?? ALL}
        onValueChange={(v) =>
          onChange({ category: v === ALL ? undefined : (v as never) })
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          {CATEGORY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant={filters.overdue ? 'default' : 'outline'}
        onClick={() => onChange({ overdue: filters.overdue ? undefined : true })}
      >
        Vencidos
      </Button>

      <Button type="button" variant="ghost" onClick={onClear}>
        Limpiar
      </Button>
    </div>
  );
}
