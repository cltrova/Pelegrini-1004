import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutenticacaoStatus } from '@/utils/autenticacaoComparator';

const MAP: Record<AutenticacaoStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  autenticado: {
    label: 'Autenticado',
    cls: 'bg-success/10 text-success ring-success/20',
    Icon: CheckCircle2,
  },
  divergente: {
    label: 'Divergente',
    cls: 'bg-warning/10 text-warning ring-warning/20',
    Icon: AlertTriangle,
  },
  nao_encontrado: {
    label: 'Não encontrado',
    cls: 'bg-destructive/10 text-destructive ring-destructive/20',
    Icon: XCircle,
  },
  extra_sistema: {
    label: 'Extra no sistema',
    cls: 'bg-primary/10 text-primary ring-primary/20',
    Icon: Info,
  },
};

export function statusLabel(s: AutenticacaoStatus) {
  return MAP[s].label;
}

export function StatusBadge({ status, className }: { status: AutenticacaoStatus; className?: string }) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        cls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      {label}
    </span>
  );
}
