import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { ClienteQueda, SituacaoCliente } from '@/utils/quedaClientes';
import { classificarSituacao, SITUACAO_COLOR, SITUACAO_LABEL } from '@/utils/quedaClientes';

interface Props {
  clientes: ClienteQueda[];
  labelAtual: string;
  labelAnterior: string;
  isLoading?: boolean;
  clienteSelecionado?: string | null;
  onSelectCliente?: (codigo: string | null) => void;
  situacaoSelecionada?: SituacaoCliente | null;
  onSelectSituacao?: (s: SituacaoCliente | null) => void;
}

type Modo = 'valor' | 'percent';

const CARD_BODY = 'h-[380px]';

export function QuedaGraficos({
  clientes,
  labelAtual,
  labelAnterior,
  isLoading,
  clienteSelecionado = null,
  onSelectCliente,
  situacaoSelecionada = null,
  onSelectSituacao,
}: Props) {
  const [topN, setTopN] = useState<5 | 10>(10);
  const [modo, setModo] = useState<Modo>('valor');

  const ranking = useMemo(() => {
    const base = clientes.filter(c => c.variacaoValor < 0);
    const ordenado = modo === 'valor'
      ? base.sort((a, b) => a.variacaoValor - b.variacaoValor)
      : base.sort((a, b) => a.variacaoPercent - b.variacaoPercent);
    return ordenado.slice(0, topN);
  }, [clientes, topN, modo]);

  const maxRef = useMemo(() => {
    if (ranking.length === 0) return 1;
    return modo === 'valor'
      ? Math.max(...ranking.map(c => Math.abs(c.variacaoValor)), 1)
      : Math.max(...ranking.map(c => Math.abs(c.variacaoPercent)), 1);
  }, [ranking, modo]);

  const situacoes: SituacaoCliente[] = ['parou', 'caiu_forte', 'caiu_leve', 'ok'];
  const distribuicao = useMemo(() => situacoes.map(s => ({
    name: SITUACAO_LABEL[s],
    situacao: s,
    value: clientes.filter(c => classificarSituacao(c) === s).length,
  })).filter(d => d.value > 0), [clientes]);

  const totalClientes = clientes.length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <Card key={i} className="premium-card">
            <CardHeader className="pb-2"><Skeleton className="h-5 w-56" /></CardHeader>
            <CardContent className={cn(CARD_BODY, 'space-y-3')}>
              {Array.from({ length: 6 }).map((_, k) => <Skeleton key={k} className="h-9 w-full" />)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Ranking */}
        <Card className="premium-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Quem mais reduziu as compras</CardTitle>
              <div className="flex items-center gap-1">
                <div className="flex rounded-md border border-border overflow-hidden">
                  {(['valor', 'percent'] as Modo[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setModo(m)}
                      className={cn(
                        'px-2 py-1 text-[11px] font-medium transition-colors',
                        modo === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {m === 'valor' ? 'Valor perdido' : '% queda'}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-md border border-border overflow-hidden">
                  {([5, 10] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setTopN(n)}
                      className={cn(
                        'px-2 py-1 text-[11px] font-medium transition-colors',
                        topN === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      Top {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {clienteSelecionado && (
              <div className="pt-1">
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => onSelectCliente?.(null)}
                >
                  Cliente selecionado
                  <X className="h-3 w-3" />
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className={cn(CARD_BODY, 'overflow-y-auto pt-1')}>
            {ranking.length === 0 ? (
              <p className="py-24 text-center text-sm text-muted-foreground">Nenhum cliente em queda no período.</p>
            ) : (
              <div className="space-y-1">
                {ranking.map((c, i) => {
                  const s = classificarSituacao(c);
                  const cor = SITUACAO_COLOR[s];
                  const nome = c.fantasia || c.razao || '—';
                  const codigo = String(c.codigo);
                  const ativo = clienteSelecionado === codigo;
                  const largura = Math.max(
                    3,
                    (Math.abs(modo === 'valor' ? c.variacaoValor : c.variacaoPercent) / maxRef) * 100,
                  );
                  return (
                    <UITooltip key={codigo}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onSelectCliente?.(ativo ? null : codigo)}
                          className={cn(
                            'w-full text-left rounded-md px-2 py-1.5 transition-colors',
                            ativo ? 'bg-muted/60 ring-1 ring-primary/40' : 'hover:bg-muted/30',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 shrink-0 text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                            <span className="flex-1 truncate text-xs font-medium">{nome}</span>
                            <span className="mono-value text-xs font-semibold" style={{ color: cor }}>
                              {modo === 'valor' ? formatCurrency(c.variacaoValor) : `${c.variacaoPercent.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="mt-1 ml-7 flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${largura}%`, backgroundColor: cor }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground mono-value shrink-0">
                              {formatCurrency(c.faturamentoP2)} → {formatCurrency(c.faturamentoP1)}
                            </span>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[280px]">
                        <p className="font-semibold text-xs mb-1">{c.razao || nome}</p>
                        <p className="text-[11px]">Antes ({labelAnterior}): {formatCurrency(c.faturamentoP2)}</p>
                        <p className="text-[11px]">Agora ({labelAtual}): {formatCurrency(c.faturamentoP1)}</p>
                        <p className="text-[11px]">Queda: {formatCurrency(c.variacaoValor)} ({c.variacaoPercent.toFixed(1)}%)</p>
                      </TooltipContent>
                    </UITooltip>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut */}
        <Card className="premium-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Como está a carteira</CardTitle>
              {situacaoSelecionada && (
                <Badge variant="secondary" className="cursor-pointer gap-1" onClick={() => onSelectSituacao?.(null)}>
                  {SITUACAO_LABEL[situacaoSelecionada]}
                  <X className="h-3 w-3" />
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className={cn(CARD_BODY, 'flex flex-col md:flex-row items-center gap-4')}>
            {distribuicao.length === 0 ? (
              <p className="w-full py-24 text-center text-sm text-muted-foreground">Sem clientes no período.</p>
            ) : (
              <>
                <div className="relative w-full md:w-1/2 h-[220px] md:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribuicao}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="62%"
                        outerRadius="88%"
                        paddingAngle={2}
                        stroke="none"
                        onClick={(d: any) => {
                          const s = d?.payload?.situacao as SituacaoCliente;
                          onSelectSituacao?.(situacaoSelecionada === s ? null : s);
                        }}
                      >
                        {distribuicao.map((d) => (
                          <Cell
                            key={d.situacao}
                            fill={SITUACAO_COLOR[d.situacao]}
                            className="cursor-pointer"
                            opacity={!situacaoSelecionada || situacaoSelecionada === d.situacao ? 1 : 0.28}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(v: number, n: string) => [
                          `${v} clientes (${totalClientes ? ((v / totalClientes) * 100).toFixed(1) : '0'}%)`,
                          n,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold mono-value">{totalClientes}</span>
                    <span className="text-[11px] text-muted-foreground">clientes analisados</span>
                  </div>
                </div>

                <div className="w-full md:w-1/2 space-y-1.5">
                  {distribuicao.map(d => {
                    const pct = totalClientes ? (d.value / totalClientes) * 100 : 0;
                    const ativo = situacaoSelecionada === d.situacao;
                    return (
                      <button
                        key={d.situacao}
                        onClick={() => onSelectSituacao?.(ativo ? null : d.situacao)}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                          ativo ? 'bg-muted/60 ring-1 ring-primary/40' : 'hover:bg-muted/30',
                          situacaoSelecionada && !ativo && 'opacity-60',
                        )}
                      >
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: SITUACAO_COLOR[d.situacao] }} />
                        <span className="flex-1 truncate text-xs">{d.name}</span>
                        <span className="text-xs font-semibold mono-value">{d.value}</span>
                        <span className="w-12 text-right text-[11px] text-muted-foreground mono-value">{pct.toFixed(1)}%</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
