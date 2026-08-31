import { cn } from '@/lib/utils';

export interface PelegriniTabItem {
  disabled?: boolean;
  label: string;
  value: string;
}

interface PelegriniTabsProps {
  ariaLabel: string;
  className?: string;
  items: PelegriniTabItem[];
  onValueChange: (value: string) => void;
  value: string;
}

export function PelegriniTabs({ ariaLabel, className, items, onValueChange, value }: PelegriniTabsProps) {
  return (
    <div className={cn('pelegrini-tabs-viewport', className)}>
      <div aria-label={ariaLabel} className="pelegrini-tabs-list" role="tablist">
        {items.map((item) => (
          <button
            aria-selected={value === item.value}
            className="pelegrini-tabs-trigger"
            data-active={value === item.value ? 'true' : 'false'}
            disabled={item.disabled}
            key={item.value}
            onClick={() => onValueChange(item.value)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
