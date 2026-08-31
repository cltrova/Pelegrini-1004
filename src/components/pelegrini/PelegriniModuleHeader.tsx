import type { PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { getPelegriniModuleIdentity } from '@/config/pelegriniIdentity';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { cn } from '@/lib/utils';

interface PelegriniModuleHeaderProps {
  title: string;
  subtitle: string;
  moduleKey: PelegriniModuleKey;
  compact?: boolean;
  className?: string;
}

export function PelegriniModuleHeader({
  title,
  subtitle,
  moduleKey,
  compact = false,
  className,
}: PelegriniModuleHeaderProps) {
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || 'transmissao');
  const moduleIdentity = getPelegriniModuleIdentity(moduleKey);

  return (
    <div
      className={cn('pelegrini-module-header mb-4 overflow-hidden border border-border bg-card px-4 py-3 shadow-sm', compact && 'mb-0 rounded-none border-x-0 border-t-0 py-2.5', className)}
      data-theme={theme.key}
      data-motif={theme.motif}
    >
      <div className="min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase text-primary">
            {theme.shortName} / {moduleIdentity.operationalLabel}
          </p>
          <h1 className={cn('mt-0.5 break-words font-bold leading-tight text-foreground', compact ? 'text-lg' : 'text-xl')}>{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
