import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LoadingIndicator } from '@/components/common/LoadingState';
import { cn } from '@/lib/utils';
import { EnterpriseBadge } from './EnterpriseBadge';

export interface EnterpriseFilterBarProps {
  children: ReactNode;
  activeCount?: number;
  summary?: ReactNode;
  resultCount?: number;
  resultLabel?: string;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClear?: () => void;
  onApply?: () => void;
  applyLabel?: string;
  isApplying?: boolean;
  className?: string;
  presentation?: 'inline' | 'popover';
}

export function EnterpriseFilterBar({
  children,
  activeCount = 0,
  isOpen,
  defaultOpen = false,
  onOpenChange,
  onClear,
  onApply,
  applyLabel = 'Buscar',
  isApplying = false,
  className,
  presentation = 'inline',
}: EnterpriseFilterBarProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const panelId = useId();
  const activeCountId = `${panelId}-active`;
  const activeFilters = activeCount > 0 ? `${activeCount} ${activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}` : '';
  const activeDescription = activeFilters && <span id={activeCountId} className="sr-only">{activeFilters}</span>;
  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const inPopover = presentation === 'popover';

  const actions = (
    <>
        {activeCount > 0 && onClear && (
          <Button aria-label="Limpar" className="h-8 gap-1.5 px-2 text-xs" onClick={onClear} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
        {onApply && (
          <Button
            aria-busy={isApplying}
            aria-label={applyLabel}
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={isApplying}
            onClick={() => {
              onApply();
              if (inPopover) setOpen(false);
            }}
            size="sm"
            type="button"
          >
            <span
              aria-hidden="true"
              className="flex h-4 w-4 shrink-0 items-center justify-center"
              data-enterprise-apply-icon
            >
              {isApplying
                ? <LoadingIndicator size="sm" />
                : <Search className="h-3.5 w-3.5" />}
            </span>
            {applyLabel}
          </Button>
        )}
    </>
  );

  if (inPopover) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={open ? 'Recolher filtros' : 'Expandir filtros'}
            aria-describedby={activeFilters ? activeCountId : undefined}
            title={activeFilters || 'Filtros'}
            className={cn('relative size-9 shrink-0 data-[state=open]:border-primary/60 data-[state=open]:bg-primary/10', className)}
          >
            <Filter aria-hidden="true" className={cn('size-4', activeCount > 0 && '-translate-x-0.5 translate-y-0.5')} />
            {activeCount > 0 && (
              <span aria-hidden="true" className="absolute right-0.5 top-0.5 min-w-3 rounded-full bg-primary px-0.5 text-[9px] font-bold leading-3 tabular-nums text-primary-foreground">
                {activeCount}
              </span>
            )}
            {activeDescription}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label="Filtros comerciais"
          collisionPadding={8}
          sideOffset={8}
          className="commercial-overlay max-h-[var(--radix-popover-content-available-height)] w-[min(40rem,calc(100vw_-_1rem))] overflow-y-auto p-3"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Filtros</h2>
            {activeFilters && <EnterpriseBadge tone="info">{activeFilters}</EnterpriseBadge>}
          </div>
          <div className="flex min-w-0 flex-wrap items-end gap-2">{children}</div>
          {(onApply || (activeCount > 0 && onClear)) && (
            <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">{actions}</div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <section className={cn('pelegrini-panel min-w-0 rounded-lg border bg-card px-3 py-2', className)} data-testid="enterprise-filter-bar">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          aria-expanded={open}
          aria-controls={panelId}
          aria-describedby={activeFilters ? activeCountId : undefined}
          aria-label={open ? 'Recolher filtros' : 'Expandir filtros'}
          className="inline-flex h-8 min-w-[9rem] flex-1 items-center gap-2 rounded-md px-2 text-xs font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          Filtros
          {activeCount > 0 && <EnterpriseBadge tone="info">{activeCount} {activeCount === 1 ? 'ativo' : 'ativos'}</EnterpriseBadge>}
          {activeDescription}
          <ChevronDown aria-hidden="true" className={cn('ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
        </button>
        {open && actions}
      </div>
      <div id={panelId} data-state={open ? 'open' : 'closed'} hidden={!open} className={cn('pelegrini-disclosure mt-2 flex min-w-0 flex-wrap items-end gap-2', !open && 'hidden')}>
        {children}
      </div>
    </section>
  );
}
