import { RefreshCw } from 'lucide-react';

import { LoadingIndicator } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import type { CotacoesFilialContext as CotacoesFilial } from '@/utils/cotacoesFilial';

interface CotacoesBranchContextProps {
  context: CotacoesFilial;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function CotacoesBranchContext({ context, isRefreshing = false, onRefresh }: CotacoesBranchContextProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img alt={context.logoAlt} className="h-8 w-auto max-w-24 shrink-0 object-contain" src={context.logoSrc} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{context.nome}</span>
        <span className="text-xs text-muted-foreground">BI {context.codigoEmpresaBi}</span>
      </div>
      {onRefresh && (
        <Button
          aria-label="Atualizar dados da filial"
          className="ml-auto h-7 w-7 shrink-0"
          disabled={isRefreshing}
          onClick={onRefresh}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isRefreshing ? <LoadingIndicator size="sm" /> : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}
