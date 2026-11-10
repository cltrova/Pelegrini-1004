import { useId, useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { StockColumnKey } from './EstoqueProductsTable';
import { columnFilterError, hasStockColumnFilter, stockFilterKind, type StockColumnFilterValue, type StockFilterOption } from './stockColumnFilters';

interface Props {
  column: StockColumnKey;
  label: string;
  value?: StockColumnFilterValue;
  options?: StockFilterOption[];
  onChange: (value: StockColumnFilterValue) => void;
  showLabel?: boolean;
}

export function StockColumnFilter({ column, label, value, options = [], onChange, showLabel = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StockColumnFilterValue>({});
  const [search, setSearch] = useState('');
  const id = useId();
  const kind = stockFilterKind(column);
  const error = columnFilterError(column, draft);
  const active = hasStockColumnFilter(value);
  const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const matching = !open ? [] : !normalizedSearch ? options : options.filter(option => option.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  const update = (key: 'text' | 'min' | 'max' | 'from' | 'to', next: string) => setDraft(current => ({ ...current, [key]: next }));
  const apply = (next: StockColumnFilterValue) => { onChange(next); setOpen(false); };
  return <Popover open={open} onOpenChange={next => { if (next) { setDraft({ ...value, ...(value?.values ? { values: [...value.values] } : {}) }); setSearch(''); } setOpen(next); }}>
    <PopoverTrigger asChild>
      <button type="button" aria-label={`Filtrar ${label}`} title={active ? `${label}: filtro aplicado` : `Filtrar ${label}`} data-filter-active={active}
        className={cn('inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-background/70', showLabel && 'border border-border text-xs')}>
        <Filter aria-hidden="true" className={cn('h-3.5 w-3.5', active && 'fill-current')} />{showLabel && label}
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" collisionPadding={12} aria-label={`Filtro de ${label}`} className="operational-overlay w-[min(20rem,calc(100vw-1.5rem))] p-3 text-left text-xs font-normal normal-case">
      <form onSubmit={event => { event.preventDefault(); if (!error) apply(draft); }} className="space-y-3">
        <div className="flex items-center justify-between gap-2"><p className="font-semibold">Filtrar {label}</p>{kind === 'selection' && <span className="text-muted-foreground">{draft.values?.length ?? 0} selecionado(s)</span>}</div>
        {kind === 'selection' && <>
          <Input autoFocus aria-label={`Buscar em ${label}`} placeholder="Buscar opções…" className="h-8 text-xs" value={search} onChange={event => setSearch(event.target.value)} />
          <div className="max-h-52 space-y-1 overflow-y-auto" aria-label={`Opções de ${label}`}>
            {matching.slice(0, 200).map(option => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-muted/60">
              <input type="checkbox" checked={draft.values?.includes(option.value) ?? false} onChange={event => setDraft(current => ({ ...current, values: event.target.checked ? [...(current.values ?? []), option.value] : (current.values ?? []).filter(selected => selected !== option.value) }))} />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>)}
            {!matching.length && <p className="py-3 text-muted-foreground">Nenhuma opção encontrada.</p>}
            {matching.length > 200 && <p className="py-2 text-muted-foreground">Refine a busca para ver as demais opções.</p>}
          </div>
        </>}
        {kind === 'text' && <Input autoFocus aria-label={`Buscar em ${label}`} placeholder="Nome, código ou referência" className="h-8 text-xs" value={draft.text ?? ''} onChange={event => update('text', event.target.value)} />}
        {kind === 'number' && <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1" htmlFor={`${id}-min`}>Mínimo<Input id={`${id}-min`} inputMode="decimal" placeholder="Sem limite" className="h-8 text-xs" value={draft.min ?? ''} onChange={event => update('min', event.target.value)} /></label>
          <label className="space-y-1" htmlFor={`${id}-max`}>Máximo<Input id={`${id}-max`} inputMode="decimal" placeholder="Sem limite" className="h-8 text-xs" value={draft.max ?? ''} onChange={event => update('max', event.target.value)} /></label>
        </div>}
        {kind === 'date' && <>
          <label className="block space-y-1" htmlFor={`${id}-mode`}>Informação da data
            <select id={`${id}-mode`} className="h-8 w-full rounded border border-input bg-background px-2 text-xs" value={draft.dateMode ?? 'any'} onChange={event => setDraft(current => ({ ...current, dateMode: event.target.value as StockColumnFilterValue['dateMode'], ...(event.target.value === 'unknown' ? { from: '', to: '' } : {}) }))}>
              <option value="any">Todas</option><option value="known">Com data informada</option><option value="unknown">Data desconhecida</option>
            </select>
          </label>
          {draft.dateMode !== 'unknown' && <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1" htmlFor={`${id}-from`}>De<Input id={`${id}-from`} type="date" className="h-8 min-w-0 text-xs" value={draft.from ?? ''} onChange={event => update('from', event.target.value)} /></label>
            <label className="space-y-1" htmlFor={`${id}-to`}>Até<Input id={`${id}-to`} type="date" className="h-8 min-w-0 text-xs" value={draft.to ?? ''} onChange={event => update('to', event.target.value)} /></label>
          </div>}
        </>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => apply({})}>Limpar filtro</Button>
          <Button type="submit" size="sm" disabled={Boolean(error)} className="h-8 text-xs">Aplicar</Button>
        </div>
      </form>
    </PopoverContent>
  </Popover>;
}
