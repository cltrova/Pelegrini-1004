import { useState } from 'react';
import { Download, Info, ArrowRight, FileBarChart2, Sparkles, BookOpen, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DFCLinha } from '@/types/variacao';
import { formatCurrency } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { DFCExpandableRow } from './DFCExpandableRow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { exportDFCToExcel } from '@/utils/dfcExport';

const TOTALIZADOR_INFO: Record<string, string> = {
  resultado_ajustado: 'Lucro Líquido + Depreciação + Amortização + Provisão p/ Créd. Liq. Duvidosa + Ajuste Credor + Equivalência Patrimonial',
  disponibilidades_operacionais: 'Resultado Líquido Ajustado + soma de todas as variações em Ativos e Passivos Operacionais',
  caixa_investimentos: 'Imobilizado/Intangível + Outros Ativos Não Circulante + Venda do Imobilizado',
  caixa_financiamento: 'Empréstimos + Capital Sócios + Créditos LP + Distribuição de Lucros + Outras Variações',
  variacao_liquida_soma: 'Disp. Líquidas Operacionais + Caixa Investimentos + Caixa Financiamento',
  variacao_liquida: 'Caixa Final − Caixa Início',
};

interface DFCTableProps {
  linhas: DFCLinha[];
  anoPeriodo1: string;
  mesPeriodo1: string;
  anoPeriodo2: string;
  mesPeriodo2: string;
}

const MESES_LABEL: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

export function DFCTable({ linhas, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2 }: DFCTableProps) {
  const [showMetodologia, setShowMetodologia] = useState(false);
  const handleExport = () => {
    exportDFCToExcel({ linhas, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2 });
  };
  const formatVariacao = (value: number | null) => {
    if (value === null) return '';
    return `${value.toFixed(0)}%`;
  };

  const getValueColor = (value: number | null) => {
    if (value === null) return '';
    if (value > 0) return 'text-emerald-400';
    if (value < 0) return 'text-red-400';
    return 'text-foreground';
  };

  const getVariacaoColor = (value: number | null) => {
    if (value === null) return '';
    if (value > 0) return 'text-emerald-400';
    if (value < 0) return 'text-red-400';
    return 'text-foreground';
  };

  const renderLinha = (linha: DFCLinha, index: number) => {
    if (linha.tipo === 'espaco') {
      return (
        <tr key={linha.id} className="h-3">
          <td colSpan={5} className="bg-transparent" />
        </tr>
      );
    }

    if (linha.tipo === 'titulo') {
      return (
        <tr key={linha.id} className="border-y border-primary/25 bg-gradient-to-r from-primary/[0.10] via-primary/[0.04] to-transparent">
          <td colSpan={5} className="relative px-5 py-3">
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary shadow-[0_0_12px_0_hsl(var(--primary))]"
            />
            <span className="flex items-center gap-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">Seção</span>
              <span className="font-bold text-[13.5px] tracking-tight text-foreground">{linha.descricao}</span>
            </span>
          </td>
        </tr>
      );
    }

    if (linha.tipo === 'subtitulo') {
      return (
        <tr key={linha.id} className="border-b border-border/40 bg-muted/[0.08]">
          <td colSpan={5} className="px-5 py-2">
            <span className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                {linha.descricao}
              </span>
            </span>
          </td>
        </tr>
      );
    }

    if (linha.tipo === 'totalizador') {
      const isDestaque = linha.id === 'disponibilidades_operacionais' ||
                         linha.id === 'caixa_investimentos' ||
                         linha.id === 'caixa_financiamento';
      const isNegative = linha.valorPeriodo1 !== null && linha.valorPeriodo1 < 0;
      const varPct = linha.variacao;
      const showVarBadge = varPct !== null && Math.abs(varPct) >= 0.5;

      return (
        <tr
          key={linha.id}
          className={cn(
            'border-y transition-colors',
            isDestaque
              ? isNegative
                ? 'border-red-500/30 bg-gradient-to-r from-red-500/[0.14] via-red-500/[0.06] to-red-500/[0.03]'
                : 'border-amber-500/30 bg-gradient-to-r from-amber-500/[0.14] via-amber-500/[0.06] to-amber-500/[0.03]'
              : 'border-primary/25 bg-gradient-to-r from-primary/[0.10] via-primary/[0.04] to-transparent'
          )}
        >
          <td className="relative px-5 py-3">
            <span
              aria-hidden
              className={cn(
                'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full',
                isDestaque
                  ? isNegative
                    ? 'bg-red-400 shadow-[0_0_12px_0_hsl(0_72%_55%)]'
                    : 'bg-amber-400 shadow-[0_0_12px_0_hsl(43_96%_56%)]'
                  : 'bg-primary shadow-[0_0_12px_0_hsl(var(--primary))]'
              )}
            />
            <span className="flex items-center gap-2 pl-1">
              <span
                className={cn(
                  'text-[9.5px] font-semibold uppercase tracking-[0.18em]',
                  isDestaque
                    ? isNegative ? 'text-red-300/80' : 'text-amber-300/80'
                    : 'text-primary/80'
                )}
              >
                Total
              </span>
              <span className="font-bold text-[13.5px] tracking-tight text-foreground flex items-center gap-1.5">
                {linha.descricao}
                {TOTALIZADOR_INFO[linha.id] && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0 transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {TOTALIZADOR_INFO[linha.id]}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
            </span>
          </td>
          <td className={cn('px-4 py-3 text-right tabular-nums font-mono font-bold text-[13.5px]', getValueColor(linha.valorPeriodo1))}>
            {linha.valorPeriodo1 !== null ? formatCurrency(linha.valorPeriodo1) : ''}
          </td>
          <td className={cn('px-4 py-3 text-right tabular-nums font-mono font-bold text-[13.5px]', getValueColor(linha.valorPeriodo2))}>
            {linha.valorPeriodo2 !== null ? formatCurrency(linha.valorPeriodo2) : ''}
          </td>
          <td className={cn('px-4 py-3 text-right tabular-nums font-mono font-bold text-[13.5px]', getValueColor(linha.valorVariacao))}>
            {linha.valorVariacao !== null ? formatCurrency(linha.valorVariacao) : ''}
          </td>
          <td className="px-4 py-3 text-right">
            {varPct !== null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-bold tabular-nums font-mono border',
                  varPct > 0 && 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
                  varPct < 0 && 'bg-red-500/15 border-red-500/30 text-red-300',
                  varPct === 0 && 'bg-muted/40 border-border/50 text-muted-foreground'
                )}
              >
                {formatVariacao(varPct)}
              </span>
            ) : null}
          </td>
        </tr>
      );
    }

    return (
      <DFCExpandableRow
        key={linha.id}
        linha={linha}
        index={index}
        getValueColor={getValueColor}
        getVariacaoColor={getVariacaoColor}
        formatVariacao={formatVariacao}
        defaultExpanded={false}
      />
    );
  };

  const headerP1 = `Até ${MESES_LABEL[mesPeriodo1]}/${anoPeriodo1}`;
  const headerP2 = `Até ${MESES_LABEL[mesPeriodo2]}/${anoPeriodo2}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card via-card to-card/70 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_18px_50px_-24px_rgba(0,0,0,0.55)]">
      {/* Glow sutil superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] to-transparent" />

      {/* Header premium */}
      <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between px-5 py-4 border-b border-border/60 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.5)]">
            <FileBarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[15px] tracking-tight text-foreground">
                Demonstração dos Fluxos de Caixa
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                Método Indireto
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-[10.5px] font-medium text-sky-300 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_0_hsl(199_89%_55%)]" />
                P1 · {headerP1}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10.5px] font-medium text-emerald-300 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_0_hsl(158_64%_52%)]" />
                P2 · {headerP2}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetodologia((v) => !v)}
            className="h-9 gap-2 rounded-xl border-border/60 bg-background/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Como calculamos
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMetodologia && 'rotate-180')} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9 gap-2 rounded-xl border-border/60 bg-background/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {showMetodologia && (
        <div className="border-b border-border/60 bg-muted/[0.05] px-6 py-5 text-[12.5px] leading-relaxed text-foreground/85 space-y-4">
          <div>
            <h4 className="font-semibold text-foreground mb-1.5 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Como cada valor é calculado
            </h4>
            <p className="text-muted-foreground text-[12px]">
              Método Indireto. Base: JSON de Variação (Storage <code className="text-primary">dados-json</code>), filtrado por <code>CodEmpresa_bi</code> da empresa ativa.
              Código-fonte: <code>src/hooks/useVariacaoData.ts</code> (funções <code>calcularDFC</code>, <code>calcularAcumuladoAteMes</code>, <code>obterContasDetalhes*</code>, <code>ESTRUTURA_DFC</code>).
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="font-semibold text-foreground mb-1">Item de grupo (linhas comuns)</div>
              <ol className="list-decimal pl-5 space-y-0.5 text-[12px]">
                <li>Filtra registros pelo campo <code>Grupo</code>.</li>
                <li>Acumulado do período P = Σ <code>Valor</code> onde <code>ano_mes ∈ [ano-01 .. ano-mesAte]</code>.</li>
                <li>Vlr. Variação = P2 − P1.</li>
                <li>Variação % = (P2 − P1) / |P1| × 100.</li>
                <li>Contas detalhadas: mesmo cálculo agrupado por <code>NumConta</code>.</li>
              </ol>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="font-semibold text-foreground mb-1">Resultado Líquido do Exercício</div>
              <p className="text-[12px]">
                Vem do JSON da DRE. Soma do nível mais detalhado (folhas) de janeiro até o mês do período.
                Contas excluídas: <code>2.3.3.01.01.00003</code>, <code>1.1.2.07.01.00001</code>, <code>1.1.2.07.01.00002</code>.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="font-semibold text-foreground mb-1">Totalizadores</div>
              <ul className="list-disc pl-5 space-y-0.5 text-[12px]">
                <li><b>Resultado Ajustado</b> = Res. Líquido + Depreciação + Juros + Reversão Provisões + Provisão CLD + Ajuste Credor + Equiv. Patrimonial.</li>
                <li><b>Disponibilidades Operacionais</b> = Res. Ajustado + Σ variações em Ativos/Passivos.</li>
                <li><b>Caixa Investimentos</b> = Imobilizado + Outros Ativos NC + Venda Imobilizado.</li>
                <li><b>Caixa Financiamento</b> = Empréstimos + Capital Sócios + Créditos LP + Distrib. Lucros + Outras Variações.</li>
                <li><b>Variação Líquida (soma)</b> = Operacional + Investimentos + Financiamento.</li>
                <li><b>Variação Líquida (validação)</b> = Caixa Final − Caixa Início.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="font-semibold text-foreground mb-1">Caixa Início / Final</div>
              <ul className="list-disc pl-5 space-y-0.5 text-[12px]">
                <li><b>Início</b>: soma histórica de todos os registros do grupo com <code>ano_mes &lt; {`{ano}`}-01</code>.</li>
                <li><b>Final</b>: soma histórica acumulada até <code>{`{ano}-{mesAte}`}</code> por <code>NumConta</code>.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-3 md:col-span-2">
              <div className="font-semibold text-foreground mb-1">Configuração por linha (aba Configuração)</div>
              <ul className="list-disc pl-5 space-y-0.5 text-[12px]">
                <li><code>grupo</code>: soma somente os registros do Grupo mapeado.</li>
                <li><code>contas</code>: soma somente os <code>NumConta</code> escolhidos.</li>
                <li><code>grupo_mais_contas</code>: Grupo + contas extras que não pertencem ao Grupo (evita dupla contagem).</li>
                <li><code>invert_sinal</code>: multiplica o resultado por −1 (usado quando a convenção contábil exige).</li>
              </ul>
            </div>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            O arquivo Excel exportado contém 3 abas: <b>Demonstração</b> (linhas exibidas), <b>Detalhes</b> (todas as contas por linha) e <b>Metodologia</b> (esta explicação).
          </p>
        </div>
      )}


      {/* Tabela */}
      <div className="overflow-x-auto premium-scrollbar">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border/70 bg-background/80 backdrop-blur-md">
              <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.14em] min-w-[400px]">
                Descrição
              </th>
              <th className="text-right px-4 py-3 text-[10.5px] font-semibold text-sky-300/90 uppercase tracking-[0.14em] w-40">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  {headerP1}
                </span>
              </th>
              <th className="text-right px-4 py-3 text-[10.5px] font-semibold text-emerald-300/90 uppercase tracking-[0.14em] w-40">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {headerP2}
                </span>
              </th>
              <th className="text-right px-4 py-3 text-[10.5px] font-semibold text-amber-300/90 uppercase tracking-[0.14em] w-36">
                Vlr. Variação
              </th>
              <th className="text-right px-4 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.14em] w-28">
                Variação %
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, index) => renderLinha(linha, index))}
          </tbody>
        </table>
      </div>

      {/* Footer com legenda */}
      <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 mr-1">Legenda</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-[10.5px] font-medium text-sky-300">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Valores P1 / P2
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10.5px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Variação positiva
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-[10.5px] font-medium text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Variação negativa
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10.5px] font-medium text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Totalizadores em destaque
        </span>
      </div>
    </div>
  );
}
