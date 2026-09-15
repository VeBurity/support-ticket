import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { searchCustomers } from '@/features/customers/api';
import type { Customer } from '@/types/api';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

interface CustomerComboboxProps {
  value: string | undefined;
  onSelect: (customer: Customer) => void;
  onCreateNew: (query: string) => void;
}

export function CustomerCombobox({
  value,
  onSelect,
  onCreateNew,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn: () => searchCustomers(debouncedSearch),
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="min-w-0 truncate">
            {selectedLabel ?? (value ? 'Cliente seleccionado' : 'Selecciona un cliente…')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre o email…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {query.isFetching && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Buscando…
              </div>
            )}
            <CommandEmpty>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  onCreateNew(search);
                  setOpen(false);
                }}
              >
                <Plus className="h-4 w-4" />
                Crear cliente "{search}"
              </button>
            </CommandEmpty>
            <CommandGroup>
              {(query.data ?? []).map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => {
                    onSelect(customer);
                    setSelectedLabel(`${customer.name} · ${customer.email}`);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === customer.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="min-w-0 truncate">
                    {customer.name} · {customer.email}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
