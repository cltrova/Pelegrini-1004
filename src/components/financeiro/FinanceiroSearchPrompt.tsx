import { Search } from 'lucide-react';
import { FINANCEIRO_EMPTY_MESSAGE } from '@/contexts/FinanceiroSearchContext';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  title?: string;
}

/** Estado neutro do módulo Financeiro: nada é buscado até o usuário clicar em Buscar. */
export function FinanceiroSearchPrompt({ className, title = 'Aguardando filtros' }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 py-16 px-6 text-center animate-fade-in',
        className
      )}
    >
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Search className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{FINANCEIRO_EMPTY_MESSAGE}</p>
    </div>
  );
}
