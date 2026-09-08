import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface EnterpriseOption {
  value: string;
  label: string;
  description?: string;
  avatarUrl?: string;
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-[9rem] max-w-full flex-1 space-y-1 sm:flex-none">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function EnterpriseSearchFilter({
  label,
  value,
  onChange,
  onKeyDown,
  placeholder = 'Buscar...',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label}>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={label} className="h-8 min-w-0 pl-8 text-xs" onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} type="search" value={value} />
      </div>
    </FieldShell>
  );
}

export function EnterpriseSelectFilter({
  label,
  value,
  options,
  onChange,
  allLabel = 'Todos',
}: {
  label: string;
  value?: string;
  options: EnterpriseOption[];
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}) {
  return (
    <FieldShell label={label}>
      <Select value={value ?? '__all'} onValueChange={(next) => onChange(next === '__all' ? undefined : next)}>
        <SelectTrigger aria-label={label} className="h-8 min-w-[9rem] bg-background text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

export function EnterpriseMultiSelectFilter({
  label,
  values,
  options,
  onChange,
  searchable = true,
  allLabel = 'Todos',
}: {
  label: string;
  values: string[];
  options: EnterpriseOption[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  allLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const selected = new Set(values);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query)) : options;
  }, [options, search]);
  const display = values.length === 0 ? allLabel : values.length === 1 ? options.find((option) => option.value === values[0])?.label ?? values[0] : `${values.length} selecionados`;

  return (
    <div className="min-w-[9rem] max-w-full flex-1 space-y-1 sm:flex-none">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button aria-label={`${label}: ${display}`} className="h-8 min-w-[9rem] max-w-[15rem] justify-between bg-background px-2 text-xs font-normal" type="button" variant="outline">
            <span className="truncate">{display}</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[18rem] p-2">
          {searchable && (
            <div className="relative mb-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-7 text-xs" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." value={search} />
            </div>
          )}
          <button className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onChange([])} type="button">
            <span className="flex h-4 w-4 items-center justify-center rounded border border-border">{values.length === 0 && <Check className="h-3 w-3" />}</span>
            {allLabel}
          </button>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((option) => {
              const active = selected.has(option.value);
              return (
                <button
                  className={cn('flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted', active && 'bg-muted/70')}
                  key={option.value}
                  onClick={() => onChange(active ? values.filter((selectedValue) => selectedValue !== option.value) : [...values, option.value])}
                  type="button"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-background">
                    {active && <Check aria-hidden="true" className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.description && <span className="shrink-0 text-[10px] text-muted-foreground">{option.description}</span>}
                </button>
              );
            })}
          </div>
          {values.length > 0 && (
            <Button className="mt-2 h-8 w-full gap-1.5 text-xs" onClick={() => onChange([])} size="sm" type="button" variant="ghost">
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              Limpar {label.toLowerCase()}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const EnterpriseSellerFilter = EnterpriseMultiSelectFilter;
export const EnterpriseClientFilter = EnterpriseMultiSelectFilter;
export const EnterpriseBranchFilter = EnterpriseMultiSelectFilter;
export const EnterpriseBrandFilter = EnterpriseMultiSelectFilter;
export const EnterpriseCategoryFilter = EnterpriseMultiSelectFilter;
export const EnterpriseProductFilter = EnterpriseMultiSelectFilter;
export const EnterpriseStatusFilter = EnterpriseSelectFilter;
