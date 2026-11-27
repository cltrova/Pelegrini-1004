import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Nao foi possivel carregar os dados da operacao',
  message = 'Confira endpoint, periodo e filial selecionada.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'pelegrini-panel flex flex-col items-center justify-center gap-2 border border-destructive/[0.25] bg-card p-6 text-center',
        className
      )}
    >
      <div className="mb-1 grid size-10 place-items-center rounded-md bg-destructive/10 text-destructive" aria-hidden="true">
        <AlertCircle className="size-5" />
      </div>
      <div role="alert" className="max-w-sm space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" onClick={onRetry} size="sm" variant="outline" className="mt-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
