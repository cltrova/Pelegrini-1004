import type { CSSProperties } from 'react';
import { Check, Lock } from 'lucide-react';
import { PELEGRINI_THEMES } from '@/config/pelegriniTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { cn } from '@/lib/utils';
import { getFilialAccessState } from '@/utils/filialAccess';

interface PelegriniBranchSwitcherProps {
  className?: string;
  variant?: 'home' | 'sidebar' | 'header';
}

export function PelegriniBranchSwitcher({ className, variant = 'header' }: PelegriniBranchSwitcherProps) {
  const { filialAtiva, codEmpresaContexto, setFilialAtivaForEmpresa } = useFilialSelecionada();
  const { isMaster, profile } = useAuth() as {
    isMaster?: boolean;
    profile?: { filiais_permitidas?: string[] | null; filial_id?: string | null } | null;
  };
  const access = getFilialAccessState({
    codEmpresa: codEmpresaContexto,
    isMaster: Boolean(isMaster),
    filiaisPermitidas: profile?.filiais_permitidas,
    filialPadrao: profile?.filial_id,
  });

  if (!codEmpresaContexto || access.items.length < 2) return null;

  return (
    <div aria-label="Filial ativa" className={cn('pelegrini-branch-switcher', className)} data-variant={variant} role="radiogroup">
      {access.items.map((item) => {
        const theme = PELEGRINI_THEMES[item.id === 'chevrolet' ? 'chevrolet' : 'transmissao'];
        const active = filialAtiva === item.id;

        return (
          <button
            aria-checked={active}
            aria-label={theme.name}
            className="pelegrini-branch-switcher-option"
            data-active={active ? 'true' : 'false'}
            disabled={item.blocked}
            key={item.id}
            onClick={() => setFilialAtivaForEmpresa(codEmpresaContexto, item.id)}
            role="radio"
            style={{ '--branch-switch-color': theme.accent } as CSSProperties}
            type="button"
          >
            <img alt="" aria-hidden="true" src={theme.logoSrc} />
            <span>{theme.shortName}</span>
            {item.blocked ? <Lock aria-hidden="true" /> : active ? <Check aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
