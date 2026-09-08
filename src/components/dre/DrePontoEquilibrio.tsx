import { useMemo, useState } from 'react';
import { DreRecord } from '@/types/dre';
import { getLeafRecords } from '@/hooks/useDreData';
import { formatCurrency } from '@/utils/formatters';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  data: DreRecord[];
  historicalData?: DreRecord[];
  codEmpresa?: string;
}

export function DrePontoEquilibrio({ data, historicalData, codEmpresa }: Props) {
  const bases = useMemo(() => {
    const leafs = getLeafRecords(data);
    const historicalLeafs = getLeafRecords(historicalData?.length ? historicalData : data);

    // Definições de grupos alinhadas com a aba Detalhe (ordem ≤ 4 compõem a Margem de Contribuição).
    const GRUPOS_RECEITA = new Set(['Receitas']);
    const GRUPOS_DEDUCAO = new Set(['Devoluções', 'Impostos', 'Deduções de Receita', '(-) Deduções de Receita']);
    const GRUPOS_VARIAVEIS = new Set([
      'Custo de Vendas de Mercadorias',
      'Custos de Vendas de Mercadorias',
      'Custo de Vendas de Mercadoria',
      'Custos de Vendas de Serviços',
      'Despesas com Vendas',
      'Despesas com Pessoal de Vendas',
      'Outras Despesas com vendas',
      'Provisão para Credito Liquid. Duvidosas',
      'Despesas E-Commerce',
    ]);
    const GRUPOS_FIXOS = new Set([
      'Despesas Fixas',
      'Despesas Administrativas',
      'Despesas Operacionais',
      'Despesas com Pessoal Administrativo',
      'Outras Despesas Administrativas',
      'Despesas Não Dedutiveis',
      'Despesas Tributárias',
    ]);
    // Mantemos apenas os grupos originais da lógica anterior para custos fixos, para não mudar essa métrica.
    // MASTER (demo) usa o conjunto expandido, pois seu plano de contas fictício distribui as
    // despesas fixas em subgrupos (pessoal admin., outras despesas admin., tributárias).
    const isMasterDemo = (codEmpresa || '').toUpperCase() === 'MASTER';
    const GRUPOS_FIXOS_ORIGINAL = isMasterDemo
      ? new Set([
          'Despesas Fixas',
          'Despesas Administrativas',
          'Despesas Operacionais',
          'Despesas com Pessoal Administrativo',
          'Outras Despesas Administrativas',
          'Despesas Tributárias',
        ])
      : new Set(['Despesas Fixas', 'Despesas Administrativas', 'Despesas Operacionais']);

    let receitas = 0;
    let deducoes = 0;
    let variaveisPeriodo = 0;
    let despesasFixas = 0;

    leafs.forEach((r) => {
      const g = r.grupo;
      if (GRUPOS_RECEITA.has(g)) receitas += r.valor;
      else if (GRUPOS_DEDUCAO.has(g)) deducoes += r.valor;
      else if (GRUPOS_VARIAVEIS.has(g)) variaveisPeriodo += r.valor;
      else if (GRUPOS_FIXOS_ORIGINAL.has(g)) despesasFixas += r.valor;
    });

    const receitaBruta = Math.abs(receitas);
    const receitaLiquida = receitaBruta - Math.abs(deducoes);
    const custosVariaveis = Math.abs(variaveisPeriodo);
    let custosFixos = Math.abs(despesasFixas);

    // Série mensal do período filtrado — usada para receita, margem e histórico visual.
    const porMes = new Map<string, { receitaBruta: number; deducoes: number; variavel: number; fixa: number }>();
    leafs.forEach((r) => {
      const m = r.ano_mes;
      if (!porMes.has(m)) porMes.set(m, { receitaBruta: 0, deducoes: 0, variavel: 0, fixa: 0 });
      const acc = porMes.get(m)!;
      const g = r.grupo;
      if (GRUPOS_RECEITA.has(g)) acc.receitaBruta += Math.abs(r.valor);
      else if (GRUPOS_DEDUCAO.has(g)) acc.deducoes += Math.abs(r.valor);
      else if (GRUPOS_VARIAVEIS.has(g)) acc.variavel += Math.abs(r.valor);
      else if (GRUPOS_FIXOS_ORIGINAL.has(g)) acc.fixa += Math.abs(r.valor);
    });

    // Série mensal histórica — regra 1002 usa daqui a média dos 6 meses fechados anteriores,
    // mesmo quando a tela está filtrada somente no mês vigente.
    const porMesHistorico = new Map<string, { fixa: number; receitaBruta: number; variavel: number }>();
    historicalLeafs.forEach((r) => {
      const m = r.ano_mes;
      if (!m) return;
      if (!porMesHistorico.has(m)) porMesHistorico.set(m, { fixa: 0, receitaBruta: 0, variavel: 0 });
      const acc = porMesHistorico.get(m)!;
      const g = r.grupo;
      if (GRUPOS_FIXOS_ORIGINAL.has(g)) acc.fixa += Math.abs(r.valor);
      else if (GRUPOS_RECEITA.has(g)) acc.receitaBruta += Math.abs(r.valor);
      else if (GRUPOS_VARIAVEIS.has(g)) acc.variavel += Math.abs(r.valor);
    });

    const hoje = new Date();
    const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const mesesOrdenados = Array.from(porMes.keys()).sort();
    const mesesHistoricosOrdenados = Array.from(porMesHistorico.keys()).sort();
    // Regra 1002: custos fixos e margem de contribuição = média dos últimos 6 meses fechados (nunca considerar o mês vigente).
    // MASTER (demo) NÃO usa a média de 6 meses fechados: os cálculos precisam
    // responder integralmente ao período filtrado (mês/ano/intervalo), caso
    // contrário PE, custos fixos e MC% ficam constantes independentemente do filtro.
    const aplicaMedia6M = codEmpresa === '1002';
    const custosFixosOriginal = custosFixos;
    // MC alinhada com a aba Detalhe: numerador = Receitas + Deduções + Custos Variáveis (todos com sinal original);
    // denominador (AV%) = Receita Bruta.
    const margemContribuicaoOriginal = receitaBruta - Math.abs(deducoes) - custosVariaveis;
    const mcPctOriginal = receitaBruta > 0 ? margemContribuicaoOriginal / receitaBruta : 0;
    let margemContribuicaoValor = margemContribuicaoOriginal;
    let mcPct = mcPctOriginal;
    let mediaMesesUsados: string[] = [];
    if (aplicaMedia6M) {
      const mesesFechados = mesesHistoricosOrdenados.filter((m) => m < mesCorrente).slice(-6);
      if (mesesFechados.length > 0) {
        const somaFixa = mesesFechados.reduce((s, m) => s + (porMesHistorico.get(m)?.fixa ?? 0), 0);
        custosFixos = somaFixa / mesesFechados.length;
        const somaReceitaBruta = mesesFechados.reduce((s, m) => s + (porMesHistorico.get(m)?.receitaBruta ?? 0), 0);
        const somaVariavel = mesesFechados.reduce((s, m) => s + (porMesHistorico.get(m)?.variavel ?? 0), 0);
        // Deduções nos meses fechados: reconstruídas a partir de (receitaBruta - variavel) - MC; usamos a mesma fonte histórica.
        const somaDeducoes = historicalLeafs
          .filter((r) => r.ano_mes && mesesFechados.includes(r.ano_mes) && GRUPOS_DEDUCAO.has(r.grupo))
          .reduce((s, r) => s + Math.abs(r.valor), 0);
        if (somaReceitaBruta > 0) {
          const mcAbs = somaReceitaBruta - somaDeducoes - somaVariavel;
          mcPct = mcAbs / somaReceitaBruta;
          margemContribuicaoValor = receitaBruta * mcPct;
        }
        mediaMesesUsados = mesesFechados;
      }
    }

    const pontoEquilibrio = mcPct > 0 ? custosFixos / mcPct : null;
    const lucroOperacional = margemContribuicaoValor - custosFixos;
    const gap = pontoEquilibrio !== null ? receitaLiquida - pontoEquilibrio : null;
    const percAtingido = pontoEquilibrio && pontoEquilibrio > 0 ? (receitaLiquida / pontoEquilibrio) * 100 : 0;


    // dias no período & diária necessária (fallback padrão — 30 dias corridos por mês)
    const numMeses = Math.max(1, mesesOrdenados.length);
    const diasPeriodo = numMeses * 30;
    const diariaPE = pontoEquilibrio !== null ? pontoEquilibrio / diasPeriodo : null;
    const diariaAtual = receitaLiquida / diasPeriodo;

    const evolucao = mesesOrdenados.slice(-12).map((mes) => {
      const v = porMes.get(mes)!;
      const rec = v.receitaBruta;
      const mcP = rec > 0 ? (rec - v.deducoes - v.variavel) / rec : 0;
      const fixaMes = aplicaMedia6M ? custosFixos : v.fixa;
      const pe = mcP > 0 ? fixaMes / mcP : 0;
      return {
        mes: mes.slice(5) + '/' + mes.slice(2, 4),
        receita: rec,
        pe,
        atingiu: rec >= pe,
      };
    });


    return {
      receitaBruta,
      receitaLiquida,
      custosVariaveis,
      custosFixos,
      custosFixosOriginal,
      aplicaMedia6M: aplicaMedia6M && mediaMesesUsados.length > 0,
      mediaMesesUsados,
      margemContribuicaoValor,
      mcPct,
      pontoEquilibrio,
      lucroOperacional,
      gap,
      percAtingido,
      diariaPE,
      diariaAtual,
      diasPeriodo,
      numMeses,
      mesesOrdenados,
      evolucao,
    };
  }, [data, historicalData, codEmpresa]);

  const [simMc, setSimMc] = useState(0); // p.p. de variação
  const [simFixos, setSimFixos] = useState(0); // % de variação
  const usaDiasUteis = codEmpresa === '1002' || (codEmpresa || '').toUpperCase() === 'MASTER';
  const [incluirSabado, setIncluirSabado] = useState(true);

  // Recalcula a meta diária/atual usando dias úteis do(s) mês(es) do período, com opção de incluir sábado.
  const metas = useMemo(() => {
    if (!usaDiasUteis || bases.mesesOrdenados.length === 0) {
      return {
        diasPeriodo: bases.diasPeriodo,
        diariaPE: bases.diariaPE,
        diariaAtual: bases.diariaAtual,
        usouDiasUteis: false,
      };
    }
    const contarDias = (ano: number, mes0: number) => {
      const totalDias = new Date(ano, mes0 + 1, 0).getDate();
      let n = 0;
      for (let d = 1; d <= totalDias; d++) {
        const dow = new Date(ano, mes0, d).getDay(); // 0 dom, 6 sáb
        if (dow === 0) continue;
        if (dow === 6 && !incluirSabado) continue;
        n++;
      }
      return n;
    };
    const dias = bases.mesesOrdenados.reduce((s, m) => {
      const [a, mm] = m.split('-').map(Number);
      return s + contarDias(a, (mm ?? 1) - 1);
    }, 0);
    const diasPeriodo = Math.max(1, dias);
    return {
      diasPeriodo,
      diariaPE: bases.pontoEquilibrio !== null ? bases.pontoEquilibrio / diasPeriodo : null,
      diariaAtual: bases.receitaLiquida / diasPeriodo,
      usouDiasUteis: true,
    };
  }, [usaDiasUteis, incluirSabado, bases]);

  const simulado = useMemo(() => {
    const novaMc = Math.max(0.0001, bases.mcPct + simMc / 100);
    const novosFixos = bases.custosFixos * (1 + simFixos / 100);
    const pe = novosFixos / novaMc;
    const delta = bases.pontoEquilibrio !== null ? pe - bases.pontoEquilibrio : 0;
    const novoGap = bases.receitaLiquida - pe;
    return { pe, delta, novoGap, novaMc };
  }, [bases, simMc, simFixos]);

  const atingiu = bases.gap !== null && bases.gap >= 0;
  const percClamp = Math.min(200, Math.max(0, bases.percAtingido));

  return (
    <div className="space-y-6">
      {/* HERO — a pergunta central respondida em uma frase */}
      <Card
        className={cn(
          'p-6 border relative overflow-hidden rounded-lg',
          atingiu
            ? 'border-emerald-500/30 bg-card'
            : 'border-amber-500/30 bg-card',
        )}
      >
        <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none">
          <Target className="h-64 w-64" />
        </div>
        <div className="relative space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ponto de Equilíbrio · {bases.numMeses > 1 ? `${bases.numMeses} meses` : 'período'}
            </span>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Para zerar todas as contas, você precisa vender</p>
            <p className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mono-value">
              {bases.pontoEquilibrio !== null ? formatCurrency(bases.pontoEquilibrio) : '—'}
            </p>
            {metas.diariaPE !== null && (
              <p className="text-sm text-muted-foreground mt-2">
                Equivalente a <strong className="text-foreground mono-value">{formatCurrency(metas.diariaPE)}</strong> por dia
              </p>
            )}
          </div>

          {/* Progresso Receita atual vs PE */}
          {bases.pontoEquilibrio !== null && (
            <div className="space-y-2 pt-2">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  Receita atual: <strong className="text-foreground mono-value">{formatCurrency(bases.receitaLiquida)}</strong>
                </span>
                <span
                  className={cn(
                    'font-semibold mono-value',
                    atingiu ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {bases.percAtingido.toFixed(0)}% do PE
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    atingiu ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                  style={{ width: `${Math.min(100, percClamp)}%` }}
                />
                {percClamp > 100 && (
                  <div
                    className="absolute top-0 h-full bg-emerald-600/40"
                    style={{ left: '100%', width: `${Math.min(100, percClamp - 100)}%` }}
                  />
                )}
              </div>

              <div
                className={cn(
                  'flex items-center gap-2 text-sm pt-1',
                  atingiu ? 'text-emerald-600' : 'text-amber-600',
                )}
              >
                {atingiu ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Você já ultrapassou o PE em{' '}
                      <strong className="mono-value">{formatCurrency(Math.abs(bases.gap!))}</strong> — cada real
                      adicional é lucro.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      Faltam <strong className="mono-value">{formatCurrency(Math.abs(bases.gap!))}</strong> de venda
                      para zerar as contas.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Aviso média 6M */}
      {bases.aplicaMedia6M && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
          <span>
            Custos fixos e margem de contribuição calculados pela <strong className="text-foreground">média dos últimos{' '}
            {bases.mediaMesesUsados.length} meses fechados</strong> (o mês vigente não é considerado). Custos fixos ={' '}
            <strong className="text-foreground mono-value">{formatCurrency(bases.custosFixos)}</strong>{' '}
            (valor cheio do período selecionado: {formatCurrency(bases.custosFixosOriginal)}).
          </span>
        </div>
      )}

      {/* COMO O CÁLCULO FUNCIONA — bloco pedagógico */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Como chegamos nesse número</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Passo 1 */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Passo 1</p>
            <p className="text-xs text-muted-foreground mb-2">De cada R$ 100 vendidos, sobra…</p>
            <p className="text-2xl font-bold mono-value text-foreground">
              R$ {(bases.mcPct * 100).toFixed(1)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              depois de pagar custos variáveis (mercadoria, comissão, imposto).
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-2 pt-2 border-t border-border/50">
              Margem de Contribuição = {(bases.mcPct * 100).toFixed(1)}%
            </p>
          </div>

          {/* seta */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Passo 2</p>
            <p className="text-xs text-muted-foreground mb-2">Contas fixas que precisam ser pagas…</p>
            <p className="text-2xl font-bold mono-value text-rose-600">
              {formatCurrency(bases.custosFixos)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              aluguel, salários, energia — independem de vender ou não.
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-2 pt-2 border-t border-border/50">
              Custos Fixos do período
            </p>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/30">
            <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Passo 3 · Resultado</p>
            <p className="text-xs text-muted-foreground mb-2">Preciso vender o suficiente para que a margem cubra os fixos:</p>
            <p className="text-2xl font-bold mono-value text-primary">
              {bases.pontoEquilibrio !== null ? formatCurrency(bases.pontoEquilibrio) : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              nesse ponto, o resultado é exatamente <strong>zero</strong>.
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-2 pt-2 border-t border-primary/20">
              {formatCurrency(bases.custosFixos)} ÷ {(bases.mcPct * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </Card>

      {/* METAS PRÁTICAS — quebrar em pedaços vendáveis */}
      {bases.pontoEquilibrio !== null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meta diária
              </p>
            </div>
            <p className="text-2xl font-bold mono-value">{formatCurrency(metas.diariaPE!)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Hoje você está em{' '}
              <strong className={cn('mono-value', metas.diariaAtual >= metas.diariaPE! ? 'text-emerald-600' : 'text-amber-600')}>
                {formatCurrency(metas.diariaAtual)}/dia
              </strong>
            </p>
            {usaDiasUteis && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Base: <strong className="text-foreground">{metas.diasPeriodo} dias úteis</strong> no período
                  {incluirSabado ? ' (incluindo sábados)' : ' (seg. a sex.)'}.
                </p>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="incluir-sabado" className="text-[11px] text-muted-foreground cursor-pointer">
                    Considerar sábado
                  </Label>
                  <Switch
                    id="incluir-sabado"
                    checked={incluirSabado}
                    onCheckedChange={setIncluirSabado}
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meta semanal
              </p>
            </div>
            <p className="text-2xl font-bold mono-value">{formatCurrency(metas.diariaPE! * 7)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              7 dias corridos de vendas para manter o ritmo do PE.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meta mensal
              </p>
            </div>
            <p className="text-2xl font-bold mono-value">{formatCurrency(metas.diariaPE! * 30)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Faturamento mínimo por mês para não operar no prejuízo.
            </p>
          </Card>
        </div>
      )}

      {/* SIMULADOR — E SE...? */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">E se...? Simule ações para reduzir o PE</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          Veja quanto muda o quanto você precisa vender se ganhar margem ou cortar custos fixos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-3">
            <div className="flex justify-between items-baseline text-sm">
              <span className="text-muted-foreground">Ganhar margem</span>
              <span className={cn('font-semibold mono-value', simMc > 0 ? 'text-emerald-600' : simMc < 0 ? 'text-rose-600' : '')}>
                {simMc > 0 ? '+' : ''}
                {simMc} p.p.
              </span>
            </div>
            <Slider value={[simMc]} min={-5} max={10} step={1} onValueChange={(v) => setSimMc(v[0])} />
            <p className="text-[11px] text-muted-foreground">
              MC% simulada: <strong className="text-foreground">{(simulado.novaMc * 100).toFixed(1)}%</strong> (hoje:{' '}
              {(bases.mcPct * 100).toFixed(1)}%)
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline text-sm">
              <span className="text-muted-foreground">Mexer nos custos fixos</span>
              <span className={cn('font-semibold mono-value', simFixos < 0 ? 'text-emerald-600' : simFixos > 0 ? 'text-rose-600' : '')}>
                {simFixos > 0 ? '+' : ''}
                {simFixos}%
              </span>
            </div>
            <Slider value={[simFixos]} min={-30} max={30} step={5} onValueChange={(v) => setSimFixos(v[0])} />
            <p className="text-[11px] text-muted-foreground">
              Fixos simulados:{' '}
              <strong className="text-foreground mono-value">
                {formatCurrency(bases.custosFixos * (1 + simFixos / 100))}
              </strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/60">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">PE hoje</p>
            <p className="text-lg font-semibold mono-value">
              {bases.pontoEquilibrio !== null ? formatCurrency(bases.pontoEquilibrio) : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Novo PE</p>
              <p className="text-2xl font-bold mono-value text-primary">{formatCurrency(simulado.pe)}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Impacto</p>
            <p
              className={cn(
                'text-lg font-semibold mono-value flex items-center gap-1',
                simulado.delta < 0 ? 'text-emerald-600' : simulado.delta > 0 ? 'text-rose-600' : '',
              )}
            >
              {simulado.delta < 0 ? <TrendingDown className="h-4 w-4" /> : simulado.delta > 0 ? <TrendingUp className="h-4 w-4" /> : null}
              {simulado.delta === 0 ? '—' : `${simulado.delta > 0 ? '+' : ''}${formatCurrency(simulado.delta)}`}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {simulado.delta < 0 ? 'menos venda necessária' : simulado.delta > 0 ? 'mais venda necessária' : 'sem mudança'}
            </p>
          </div>
        </div>
      </Card>

      {/* AÇÕES / INSIGHTS */}
      <Card className="p-6 rounded-lg border-primary/20 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">O que fazer com essa informação</h4>
        </div>

        <div className="space-y-3 text-sm">
          {bases.pontoEquilibrio !== null && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/50">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <p className="text-muted-foreground leading-relaxed">
                Comunique à equipe comercial a meta clara:{' '}
                <strong className="text-foreground mono-value">{formatCurrency(metas.diariaPE!)}</strong> por dia.
                Abaixo disso, a operação consome caixa.
              </p>
            </div>
          )}

          {bases.mcPct > 0 && bases.pontoEquilibrio !== null && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/50">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <p className="text-muted-foreground leading-relaxed">
                Se conseguir <strong className="text-foreground">+2 p.p. de margem</strong> (renegociar compras, subir
                preço, reduzir desconto), o PE cai para{' '}
                <strong className="text-foreground mono-value">
                  {formatCurrency(bases.custosFixos / (bases.mcPct + 0.02))}
                </strong>
                .
              </p>
            </div>
          )}

          {bases.pontoEquilibrio !== null && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/50">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <p className="text-muted-foreground leading-relaxed">
                Se cortar <strong className="text-foreground">10% dos custos fixos</strong>, você precisará vender apenas{' '}
                <strong className="text-foreground mono-value">
                  {formatCurrency((bases.custosFixos * 0.9) / bases.mcPct)}
                </strong>{' '}
                para zerar — economia de{' '}
                <strong className="text-emerald-600 mono-value">
                  {formatCurrency(bases.pontoEquilibrio - (bases.custosFixos * 0.9) / bases.mcPct)}
                </strong>{' '}
                em vendas exigidas.
              </p>
            </div>
          )}

          {!atingiu && bases.gap !== null && metas.diariaPE !== null && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
              <p className="text-foreground leading-relaxed">
                Para fechar o gap de <strong className="mono-value">{formatCurrency(Math.abs(bases.gap))}</strong>, é
                preciso adicionar cerca de{' '}
                <strong className="mono-value">
                  {Math.ceil(Math.abs(bases.gap) / metas.diariaPE)} dias
                </strong>{' '}
                de vendas no ritmo atual — ou aumentar o ticket diário.
              </p>
            </div>
          )}

          {atingiu && bases.lucroOperacional > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
              <p className="text-foreground leading-relaxed">
                A operação está gerando{' '}
                <strong className="mono-value text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(bases.lucroOperacional)}
                </strong>{' '}
                de resultado operacional. Cada real vendido acima do PE contribui com{' '}
                <strong className="mono-value">{(bases.mcPct * 100).toFixed(1)}%</strong> direto no lucro.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
