import { useId, useState, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface EstoqueMetric {
  key: string;
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: 'neutral' | 'information' | 'attention' | 'danger';
  interactive: boolean;
}

interface EstoqueMetricStripProps {
  metrics: EstoqueMetric[];
  activeKey?: string;
  activeKeys?: string[];
  onMetricClick?: (key: string) => void;
  className?: string;
}

const toneClasses: Record<EstoqueMetric['tone'], string> = {
  neutral: 'text-foreground',
  information: 'text-primary',
  attention: 'text-warning',
  danger: 'text-destructive',
};

interface MetricItemProps {
  active: boolean;
  metric: EstoqueMetric;
  onMetricClick?: (key: string) => void;
}

function MetricContent({ icon: Icon, label, value }: Pick<EstoqueMetric, 'icon' | 'label' | 'value'>) {
  return (
    <>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-current opacity-70" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[9px] font-semibold uppercase leading-none text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block min-w-0 max-w-full whitespace-nowrap text-[0.95rem] font-semibold leading-none tabular-nums text-foreground">
          {value}
        </span>
      </span>
    </>
  );
}

function MetricItem({ active, metric, onMetricClick }: MetricItemProps) {
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const descriptionId = `estoque-metric-description-${useId().replace(/:/g, '')}`;
  const metricMinWidth = `calc(${metric.value.length}ch + 6rem)`;
  const commonClassName = cn(
    'relative flex h-full min-w-[8rem] flex-1 items-center gap-1.5 border-r border-border/55 px-2 text-left',
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    toneClasses[metric.tone],
    active ? 'bg-primary/10' : 'bg-card/80 hover:bg-muted/35',
  );

  const content = <MetricContent icon={metric.icon} label={metric.label} value={metric.value} />;
  const showTooltip = (event: FocusEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
      top: rect.bottom + 6,
    });
  };
  const interactionProps = {
    'aria-describedby': descriptionId,
    onBlur: () => setTooltipPosition(null),
    onFocus: showTooltip,
    onMouseEnter: showTooltip,
    onMouseLeave: () => setTooltipPosition(null),
  };

  const control = metric.interactive ? (
        <button
          {...interactionProps}
          aria-label={`${metric.label}: ${metric.value}`}
          aria-pressed={active}
          className={commonClassName}
          data-active={active || undefined}
          data-stock-summary
          data-tone={metric.tone}
          onClick={() => onMetricClick?.(metric.key)}
          style={{ minWidth: metricMinWidth }}
          type="button"
        >
          {content}
          <span
            aria-hidden="true"
            className={cn('absolute inset-x-2 bottom-0 h-0.5', active ? 'bg-current' : 'bg-transparent')}
          />
        </button>
      ) : (
        <article
          {...interactionProps}
          aria-label={`${metric.label}: ${metric.value}`}
          className={commonClassName}
          data-tone={metric.tone}
          data-stock-summary
          style={{ minWidth: metricMinWidth }}
          tabIndex={0}
        >
          {content}
        </article>
      );

  return (
    <>
      {control}
      <span className="sr-only" id={descriptionId}>
        {metric.description}
      </span>
      {tooltipPosition && typeof document !== 'undefined' && createPortal(
        <span
          className="pointer-events-none fixed z-50 max-w-72 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-5 text-popover-foreground shadow-md"
          role="tooltip"
          style={tooltipPosition}
        >
          {metric.description}
        </span>,
        document.body,
      )}
    </>
  );
}

export function EstoqueMetricStrip({
  activeKey,
  activeKeys,
  className,
  metrics,
  onMetricClick,
}: EstoqueMetricStripProps) {
  return (
    <section
      aria-label="Indicadores de estoque"
      className={cn(
        'flex h-11 min-w-0 shrink-0 overflow-x-auto border-y border-border/60 bg-card/85',
        className,
      )}
    >
      {metrics.map((metric) => (
        <MetricItem
          active={metric.interactive && (metric.key === activeKey || Boolean(activeKeys?.includes(metric.key)))}
          key={metric.key}
          metric={metric}
          onMetricClick={onMetricClick}
        />
      ))}
    </section>
  );
}
