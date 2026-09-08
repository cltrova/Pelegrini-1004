import { useState, type ReactNode } from 'react';
import { ChevronDown, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  className?: string;
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
  className,
}: EnterpriseFilterBarProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <section className={cn('min-w-0 rounded-lg border border-border bg-card px-3 py-2', className)} data-testid="enterprise-filter-bar">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          aria-expanded={open}
          aria-label={open ? 'Recolher filtros' : 'Expandir filtros'}
          className="inline-flex h-8 min-w-[9rem] flex-1 items-center gap-2 rounded-md px-2 text-xs font-semibold text-foreground hover:bg-muted"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          Filtros
          {activeCount > 0 && <EnterpriseBadge tone="info">{activeCount} ativos</EnterpriseBadge>}
          <ChevronDown aria-hidden="true" className={cn('ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open && activeCount > 0 && onClear && (
          <Button aria-label="Limpar" className="h-8 gap-1.5 px-2 text-xs" onClick={onClear} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
        {open && onApply && (
          <Button aria-label={applyLabel} className="h-8 gap-1.5 px-2.5 text-xs" onClick={onApply} size="sm" type="button">
            <Search aria-hidden="true" className="h-3.5 w-3.5" />
            {applyLabel}
          </Button>
        )}
      </div>
      <div className={cn('mt-2 flex min-w-0 flex-wrap items-end gap-2', !open && 'hidden')}>{children}</div>
    </section>
  );
}
