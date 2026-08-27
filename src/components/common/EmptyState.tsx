import { FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Nenhum dado encontrado',
  message = 'Não há dados para exibir com os filtros selecionados.',
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center border border-border/60 bg-card/75 shadow-sm backdrop-blur-xl',
        className
      )}
    >
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {icon || <FileSearch className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}
