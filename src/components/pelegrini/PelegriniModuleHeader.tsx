import type { PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { getPelegriniIdentity, getPelegriniModuleIdentity } from '@/config/pelegriniIdentity';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { cn } from '@/lib/utils';
import { PelegriniBranchBadge } from './PelegriniBranchBadge';

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
  const theme = resolvePelegriniTheme(filialAtiva);
  const identity = getPelegriniIdentity(theme.key);
  const moduleIdentity = getPelegriniModuleIdentity(moduleKey);

  return (
    <div className={cn('mb-6 rounded-xl border border-border bg-card p-4 shadow-sm', compact && 'mb-0 rounded-none border-x-0 border-t-0 p-3', className)}>
      <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', compact && 'gap-2')}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {identity.eyebrow} / {moduleIdentity.operationalLabel}
          </p>
          <h1 className={cn('mt-1 font-bold text-foreground', compact ? 'text-lg' : 'text-2xl')}>{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <PelegriniBranchBadge theme={theme} />
      </div>
    </div>
  );
}
