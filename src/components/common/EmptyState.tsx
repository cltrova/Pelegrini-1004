import { FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Nenhum dado encontrado para esta filial',
  message = 'Não há dados para exibir com os filtros selecionados.',
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'pelegrini-panel flex flex-col items-center justify-center gap-2 border bg-card p-6 text-center',
        className
      )}
    >
      <div className="mb-1 grid size-10 place-items-center rounded-md border border-border bg-muted/60 text-muted-foreground" aria-hidden="true">
        {icon || <FileSearch className="size-5" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}
