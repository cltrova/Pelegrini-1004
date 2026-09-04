import { cn } from '@/lib/utils';
import { useRef, type KeyboardEvent } from 'react';

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
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledIndexes = items
      .map((item, index) => item.disabled ? -1 : index)
      .filter(index => index >= 0);
    const position = enabledIndexes.indexOf(currentIndex);
    let targetIndex: number | undefined;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') targetIndex = enabledIndexes[(position + 1) % enabledIndexes.length];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') targetIndex = enabledIndexes[(position - 1 + enabledIndexes.length) % enabledIndexes.length];
    else if (event.key === 'Home') targetIndex = enabledIndexes[0];
    else if (event.key === 'End') targetIndex = enabledIndexes[enabledIndexes.length - 1];

    if (targetIndex === undefined) return;
    event.preventDefault();
    onValueChange(items[targetIndex].value);
    refs.current[targetIndex]?.focus();
  };

  return (
    <div className={cn('pelegrini-tabs-viewport', className)}>
      <div aria-label={ariaLabel} className="pelegrini-tabs-list" role="tablist">
        {items.map((item, index) => (
          <button
            aria-controls={`pelegrini-tabpanel-${item.value}`}
            aria-selected={value === item.value}
            className="pelegrini-tabs-trigger"
            data-active={value === item.value ? 'true' : 'false'}
            disabled={item.disabled}
            id={`pelegrini-tab-${item.value}`}
            key={item.value}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => moveFocus(event, index)}
            ref={(node) => { refs.current[index] = node; }}
            role="tab"
            tabIndex={value === item.value ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
