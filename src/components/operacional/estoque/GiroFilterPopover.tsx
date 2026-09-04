import type { ReactNode } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface GiroFilterPopoverProps {
  appliedCount: number;
  appliedSummary: string;
  children: ReactNode;
  onApply: () => void;
  onClear: () => void;
  pendingCount: number;
}

export function GiroFilterPopover({
  appliedCount,
  appliedSummary,
  children,
  onApply,
  onClear,
  pendingCount,
}: GiroFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={appliedCount > 0 ? `Filtros: ${appliedSummary}` : 'Filtros do giro'}
          className="h-8 shrink-0 gap-2"
          size="sm"
          type="button"
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          <span>Filtros{appliedCount > 0 ? ` (${appliedCount})` : ''}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,44rem)] space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
          {pendingCount > 0 && (
            <PopoverClose asChild>
              <Button onClick={onClear} size="sm" type="button" variant="ghost">Limpar filtros</Button>
            </PopoverClose>
          )}
          <PopoverClose asChild>
            <Button onClick={onApply} size="sm" type="button">
              <Search aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />Pesquisar
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
