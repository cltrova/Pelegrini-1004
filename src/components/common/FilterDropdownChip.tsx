import { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface FilterDropdownChipProps {
  label: string;
  /** What to show on the chip when collapsed */
  displayValue?: string;
  children: ReactNode;
  /** Whether this filter has active selections */
  isActive?: boolean;
  onClear?: () => void;
}

/**
 * A compact filter chip that expands into a dropdown panel on click.
 * Used inside the CollapsibleFilterBar for each individual filter.
 */
export function FilterDropdownChip({
  label,
  displayValue,
  children,
  isActive = false,
  onClear,
}: FilterDropdownChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const r = btnRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
          isActive
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
            : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
          open && 'ring-1 ring-amber-500/40'
        )}
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-semibold max-w-[120px] truncate">{displayValue || 'Todos'}</span>
        {isActive && onClear ? (
          <X
            className="h-3 w-3 ml-0.5 hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          />
        ) : (
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[200px] max-w-[300px] bg-popover border border-border rounded-lg shadow-xl p-2 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

/** Reusable multi-select options inside a FilterDropdownChip */
interface MultiSelectOptionsProps {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchable?: boolean;
  allLabel?: string;
}

export function MultiSelectOptions({ options, selected, onChange, searchable = false, allLabel = 'Todos' }: MultiSelectOptionsProps) {
  const [search, setSearch] = useState('');
  const filtered = searchable && search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;
  const allSelected = selected.length === 0;

  return (
    <div className="space-y-1.5">
      {searchable && (
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs mb-1"
          autoFocus
        />
      )}
      <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
        <button
          onClick={() => onChange([])}
          className={cn(
            'px-2 py-0.5 rounded text-xs font-medium transition-colors border',
            allSelected
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
          )}
        >
          {allLabel}
        </button>
        {filtered.map(opt => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onChange(isActive ? selected.filter(s => s !== opt) : [...selected, opt])}
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium transition-colors border',
                isActive
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Single-select options inside a FilterDropdownChip */
interface SingleSelectOptionsProps {
  options: { value: string | number; label: string }[];
  selected: string | number;
  onChange: (v: any) => void;
}

export function SingleSelectOptions({ options, selected, onChange }: SingleSelectOptionsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2 py-0.5 rounded text-xs font-medium transition-colors border',
            selected === opt.value
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
