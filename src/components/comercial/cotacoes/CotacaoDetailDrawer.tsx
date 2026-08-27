import { CircleAlert, Clock3, Gauge, Landmark, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { MotivoPerdaRegistro } from '@/hooks/useMotivosPerda';
import type { CotacaoComercial, CotacaoOrigem } from '@/types/cotacoesComerciais';
import {
  calcularCotacaoPrioridade,
  consolidarMotivoPerda,
} from '@/utils/cotacoesComerciais';
import { formatCurrency, formatInteger } from '@/utils/formatters';

type MotivosPerdaMap = ReadonlyMap<string, Pick<MotivoPerdaRegistro, 'motivo' | 'observacao'>>;

interface CotacaoDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CotacaoOrigem;
  cotacao: CotacaoComercial | null;
  motivos: MotivosPerdaMap;
}

function formatDate(value: string | null): string {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '--';
}

export function CotacaoDetailDrawer({ open, onOpenChange, mode, cotacao, motivos }: CotacaoDetailDrawerProps) {
  const prioridade = cotacao ? calcularCotacaoPrioridade(cotacao, mode) : null;
  const motivo = cotacao ? consolidarMotivoPerda(cotacao, motivos) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {cotacao && prioridade && (
          <>
            <SheetHeader>
              <SheetTitle>Cotação {cotacao.numeroCotacao}</SheetTitle>
              <SheetDescription>{cotacao.nomeCliente || 'Cliente não informado'}</SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-4">
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Gauge aria-hidden="true" className="h-3.5 w-3.5" />
                      Score gestor
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{prioridade.score}/100</p>
                  </div>
                  <Badge variant={prioridade.nivel === 'quente' ? 'destructive' : prioridade.nivel === 'atencao' ? 'secondary' : 'outline'}>
                    {prioridade.label}
                  </Badge>
                </div>
                <Progress value={prioridade.score} className="mt-3 h-2" />
                <p className="mt-2 text-xs text-muted-foreground">{prioridade.descricao}</p>
              </section>

              <section className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Landmark aria-hidden="true" className="h-3.5 w-3.5" />
                    Valor
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">{formatCurrency(cotacao.valor)}</p>
                </div>
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                    Dias
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">{formatInteger(cotacao.diasEmAberto)}</p>
                </div>
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Emissão</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatDate(cotacao.dataCotacao)}</p>
                </div>
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Validade</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatDate(cotacao.dataValidade)}</p>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                  Vendedor
                </p>
                <p className="mt-1 font-semibold">{cotacao.nomeVendedor || '--'}</p>
              </section>

              {mode === 'perdidas' && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
                    Motivo consolidado
                  </p>
                  <p className="mt-1 font-semibold">{motivo?.label || 'Não registrado'}</p>
                  {motivo?.observacao && <p className="mt-2 text-sm text-muted-foreground">{motivo.observacao}</p>}
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
