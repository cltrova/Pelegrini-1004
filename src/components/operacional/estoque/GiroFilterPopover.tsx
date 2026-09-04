import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';

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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    closeAndFocusTrigger();
  };

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <Button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={appliedCount > 0 ? `Filtros: ${appliedSummary}` : 'Filtros do giro'}
        className="h-8 shrink-0 gap-2"
        onClick={() => setOpen(current => !current)}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="outline"
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
        <span>Filtros{appliedCount > 0 ? ` (${appliedCount})` : ''}</span>
      </Button>
      {open && (
        <div
          aria-label="Filtros do giro"
          className="absolute right-0 top-full z-50 mt-1 w-[min(92vw,44rem)] space-y-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
          id={panelId}
          ref={(node) => {
            if (node && !node.contains(document.activeElement)) {
              node.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
            }
          }}
          role="dialog"
        >
          <div className="flex flex-wrap items-center gap-2">{children}</div>
          <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
          {pendingCount > 0 && (
            <Button
              onClick={() => {
                onClear();
                closeAndFocusTrigger();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Limpar filtros
            </Button>
          )}
            <Button
              onClick={() => {
                onApply();
                closeAndFocusTrigger();
              }}
              size="sm"
              type="button"
            >
              <Search aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />Pesquisar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
