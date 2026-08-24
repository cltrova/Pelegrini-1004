import { useState, ReactNode, useMemo } from 'react';
import { Filter, Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface UnifiedFilterBarProps {
  children: ReactNode;
  /** Number of active filters */
  activeCount: number;
  /** Summary text shown when collapsed */
  summary?: string;
  /** Called when user clicks the search/apply button */
  onApply?: () => void;
  /** Called when user clicks clear all */
  onClear?: () => void;
}

/**
 * A single unified filter field. Collapsed = compact bar showing active filter count.
 * Expanded = reveals all filter chips inside. Has a search button to apply.
 */
export function UnifiedFilterBar({
  children,
  activeCount,
  summary,
  onApply,
  onClear,
}: UnifiedFilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Collapsed trigger — looks like a single input field */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-left',
          'bg-card hover:bg-accent/50',
          open
            ? 'border-amber-500/50 ring-1 ring-amber-500/20'
            : activeCount > 0
              ? 'border-amber-500/30'
              : 'border-border'
        )}
      >
        <Filter className={cn('h-4 w-4 shrink-0', activeCount > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
        <span className="flex-1 text-sm truncate">
          {activeCount > 0 ? (
            <span>
              <span className="text-muted-foreground">Filtros: </span>
              <span className="font-medium text-foreground">{summary || `${activeCount} ativo(s)`}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Clique para filtrar...</span>
          )}
        </span>

        {activeCount > 0 && (
          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
            {activeCount}
          </span>
        )}

        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="mt-2 p-4 rounded-xl border border-border bg-card shadow-lg animate-fade-in space-y-3">
          {/* Filter chips inside */}
          <div className="flex items-center gap-2 flex-wrap">
            {children}
          </div>

          {/* Action row */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            {activeCount > 0 && onClear && (
              <button
                onClick={onClear}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5"
              >
                <X className="h-3 w-3" />
                Limpar filtros
              </button>
            )}
            <Button
              size="sm"
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setOpen(false);
                onApply?.();
              }}
            >
              <Search className="h-3.5 w-3.5" />
              Pesquisar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
