import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  ComposedChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { DreRecord, DreGroupSummary } from '@/types/dre';
import { formatCurrency, formatCompactNumber, formatPercent } from '@/utils/formatters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Info, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Calendar, BarChart3, GitCompare, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DreComparativoProps {
  data: DreRecord[];
  groupSummary: DreGroupSummary[];
}

// Descrições das análises
const analysisDescriptions: Record<string, string> = {
  yoy: 'Compara o resultado de cada ano com o ano anterior, mostrando a variação absoluta e percentual.',
  mom: 'Compara o resultado de cada mês com o mês anterior, identificando tendências mensais.',
  sameMonth: 'Compara o mesmo mês em diferentes anos para identificar sazonalidade.',
  groupTrend: 'Mostra a evolução de cada grupo contábil ao longo do tempo.',
  contribution: 'Analisa a contribuição percentual de cada categoria para o resultado total.',
  ranking: 'Ranking dos grupos por valor, comparando períodos diferentes.',
  variance: 'Análise de variância entre orçado/realizado ou períodos.',
  seasonal: 'Identifica padrões sazonais nos dados mensais.',
};

// Mapeamento de categorias
const categoriaMap: Record<string, string> = {
  'Receitas': 'Receitas',
  'Impostos': 'Deduções',
  'Custos de Vendas de Mercadorias': 'Custos',
  'Custos de Vendas de Serviços': 'Custos',
  'Despesas com Pessoal de Vendas': 'Despesas',
  'Outras Despesas com vendas': 'Despesas',
  'Provisão para Credito Liquid. Duvidosas': 'Despesas',
  'Despesas E-Commerce': 'Despesas',
  'Despesas com Pessoal Administrativo': 'Despesas',
  'Outras Despesas Administrativas': 'Despesas',
  'Despesas Não Dedutiveis': 'Despesas',
  'Despesas Tributárias': 'Despesas',
  'Receitas Financeiros': 'Financeiro',
  'Despesas Financeiros': 'Financeiro',
  'Outras Receitas Operacionais': 'Outras',
  'Juros Sobre Capital Próprio': 'Outras',
  'Outras Despesas': 'Outras',
  'Provisão Para IRPJ e CSLL': 'Impostos',
  'Ajustes de Exercícios Anteriores': 'Outras',
};

const COLORS = {
  positive: 'hsl(142, 71%, 45%)',
  negative: 'hsl(0, 72%, 51%)',
  primary: 'hsl(221, 83%, 53%)',
  secondary: 'hsl(280, 65%, 60%)',
  accent: 'hsl(45, 93%, 47%)',
  neutral: 'hsl(220, 9%, 46%)',
};

const CHART_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 65%, 60%)',
  'hsl(45, 93%, 47%)',
  'hsl(180, 60%, 45%)',
  'hsl(340, 75%, 55%)',
  'hsl(100, 60%, 45%)',
];

// Componente de header com tooltip
function CardHeader({ title, description, icon: Icon, right }: { title: string; description: string; icon?: React.ComponentType<{ className?: string }>; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/40">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <h3 className="font-semibold text-foreground text-[13px] tracking-tight truncate">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {right}
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground/60 hover:text-foreground transition-colors">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs">{description}</p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// Componente de variação
function VariationBadge({ value, showIcon = true }: { value: number; showIcon?: boolean }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums',
      isPositive && 'text-emerald-400 bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20',
      isNegative && 'text-red-400 bg-red-500/10 ring-1 ring-inset ring-red-500/20',
      isNeutral && 'text-muted-foreground bg-muted/40'
    )}>
      {showIcon && (
        isPositive ? <ArrowUpRight className="h-3 w-3" /> :
        isNegative ? <ArrowDownRight className="h-3 w-3" /> :
        <Minus className="h-3 w-3" />
      )}
      {formatPercent(Math.abs(value) / 100)}
    </span>
  );
}

// Card wrapper premium
const cardCls = "relative bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5 backdrop-blur-sm";

// Tooltip customizado para gráficos
const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
  fontSize: '11px',
  padding: '8px 12px',
};

export function DreComparativo({ data, groupSummary }: DreComparativoProps) {
  const [activeAnalysis, setActiveAnalysis] = useState<'yoy' | 'grupos' | 'categorias' | 'sazonalidade'>('yoy');
  const [selectedAno1, setSelectedAno1] = useState<string>('');
  const [selectedAno2, setSelectedAno2] = useState<string>('');
  const [selectedGrupo, setSelectedGrupo] = useState<string>('');

  // Extrai anos e grupos únicos
  const { anos, grupos, meses } = useMemo(() => {
    const anosSet = new Set<string>();
    const gruposSet = new Set<string>();
    const mesesSet = new Set<string>();
    
    data.forEach((r) => {
      anosSet.add(r.ano_mes.substring(0, 4));
      gruposSet.add(r.grupo);
      mesesSet.add(r.ano_mes);
    });
    
    const sortedAnos = [...anosSet].sort().reverse();
    
    return {
      anos: sortedAnos,
      grupos: [...gruposSet].sort(),
      meses: [...mesesSet].sort(),
    };
  }, [data]);

  // Inicializa seleções
  useMemo(() => {
    if (anos.length >= 2 && !selectedAno1) {
      setSelectedAno1(anos[0]);
      setSelectedAno2(anos[1]);
    } else if (anos.length === 1 && !selectedAno1) {
      setSelectedAno1(anos[0]);
      setSelectedAno2(anos[0]);
    }
    if (grupos.length > 0 && !selectedGrupo) {
      setSelectedGrupo(grupos[0]);
    }
  }, [anos, grupos]);

  // ============= ANÁLISE YEAR-OVER-YEAR =============
  const yoyAnalysis = useMemo(() => {
    const porAno: Record<string, { receitas: number; custos: number; despesas: number; resultado: number }> = {};
    
    data.forEach((record) => {
      const ano = record.ano_mes.substring(0, 4);
      if (!porAno[ano]) {
        porAno[ano] = { receitas: 0, custos: 0, despesas: 0, resultado: 0 };
      }
      
      const categoria = categoriaMap[record.grupo] || 'Outras';
      if (categoria === 'Receitas') porAno[ano].receitas += record.valor;
      else if (categoria === 'Custos') porAno[ano].custos += Math.abs(record.valor);
      else if (categoria === 'Despesas') porAno[ano].despesas += Math.abs(record.valor);
      
      porAno[ano].resultado += record.valor;
    });

    const sortedAnos = Object.keys(porAno).sort();
    
    return sortedAnos.map((ano, idx) => {
      const atual = porAno[ano];
      const anterior = idx > 0 ? porAno[sortedAnos[idx - 1]] : null;
      
      return {
        ano,
        receitas: atual.receitas,
        custos: atual.custos,
        despesas: atual.despesas,
        resultado: atual.resultado,
        varReceitas: anterior ? ((atual.receitas - anterior.receitas) / Math.abs(anterior.receitas || 1)) * 100 : 0,
        varCustos: anterior ? ((atual.custos - anterior.custos) / Math.abs(anterior.custos || 1)) * 100 : 0,
        varDespesas: anterior ? ((atual.despesas - anterior.despesas) / Math.abs(anterior.despesas || 1)) * 100 : 0,
        varResultado: anterior ? ((atual.resultado - anterior.resultado) / Math.abs(anterior.resultado || 1)) * 100 : 0,
      };
    });
  }, [data]);

  // ============= COMPARATIVO DIRETO DE 2 ANOS =============
  const directYearComparison = useMemo(() => {
    if (!selectedAno1 || !selectedAno2) return [];
    
    const porGrupo: Record<string, { ano1: number; ano2: number }> = {};
    
    data.forEach((record) => {
      const ano = record.ano_mes.substring(0, 4);
      if (ano !== selectedAno1 && ano !== selectedAno2) return;
      
      if (!porGrupo[record.grupo]) {
        porGrupo[record.grupo] = { ano1: 0, ano2: 0 };
      }
      
      if (ano === selectedAno1) porGrupo[record.grupo].ano1 += record.valor;
      if (ano === selectedAno2) porGrupo[record.grupo].ano2 += record.valor;
    });

    return Object.entries(porGrupo)
      .map(([grupo, valores]) => ({
        grupo: grupo.length > 25 ? grupo.substring(0, 25) + '...' : grupo,
        grupoFull: grupo,
        ano1: valores.ano1,
        ano2: valores.ano2,
        variacao: valores.ano2 !== 0 ? ((valores.ano1 - valores.ano2) / Math.abs(valores.ano2)) * 100 : 0,
        diferencaAbs: valores.ano1 - valores.ano2,
      }))
      .sort((a, b) => Math.abs(b.diferencaAbs) - Math.abs(a.diferencaAbs))
      .slice(0, 15);
  }, [data, selectedAno1, selectedAno2]);

  // ============= COMPARATIVO MENSAL ENTRE ANOS =============
  const monthlyComparison = useMemo(() => {
    if (!selectedAno1 || !selectedAno2 || selectedAno1 === selectedAno2) return [];
    
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const porMes: Record<string, { ano1: number; ano2: number }> = {};
    
    // Inicializa todos os meses
    mesesNomes.forEach((_, idx) => {
      const mesNum = String(idx + 1).padStart(2, '0');
      porMes[mesNum] = { ano1: 0, ano2: 0 };
    });
    
    data.forEach((record) => {
      const ano = record.ano_mes.substring(0, 4);
      const mes = record.ano_mes.substring(5, 7);
      
      if (ano === selectedAno1) porMes[mes].ano1 += record.valor;
      if (ano === selectedAno2) porMes[mes].ano2 += record.valor;
    });

    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valores]) => ({
        mes: mesesNomes[parseInt(mes) - 1],
        mesNum: mes,
        [selectedAno1]: valores.ano1,
        [selectedAno2]: valores.ano2,
        variacao: valores.ano2 !== 0 ? ((valores.ano1 - valores.ano2) / Math.abs(valores.ano2)) * 100 : 0,
      }));
  }, [data, selectedAno1, selectedAno2]);

  // ============= ANÁLISE POR GRUPO =============
  const groupAnalysis = useMemo(() => {
    const porGrupoAno: Record<string, Record<string, number>> = {};
    
    data.forEach((record) => {
      const ano = record.ano_mes.substring(0, 4);
      if (!porGrupoAno[record.grupo]) {
        porGrupoAno[record.grupo] = {};
      }
      porGrupoAno[record.grupo][ano] = (porGrupoAno[record.grupo][ano] || 0) + record.valor;
    });

    return Object.entries(porGrupoAno).map(([grupo, anosData]) => {
      const sortedAnos = Object.keys(anosData).sort();
      const valores = sortedAnos.map(ano => ({ ano, valor: anosData[ano] }));
      
      // Calcula tendência (crescimento médio)
      let tendencia = 0;
      if (valores.length >= 2) {
        const crescimentos: number[] = [];
        for (let i = 1; i < valores.length; i++) {
          const anterior = valores[i - 1].valor;
          if (anterior !== 0) {
            crescimentos.push(((valores[i].valor - anterior) / Math.abs(anterior)) * 100);
          }
        }
        tendencia = crescimentos.length > 0 ? crescimentos.reduce((a, b) => a + b, 0) / crescimentos.length : 0;
      }
      
      return {
        grupo,
        valores,
        tendencia,
        total: Object.values(anosData).reduce((a, b) => a + b, 0),
      };
    }).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [data]);

  // ============= EVOLUÇÃO DO GRUPO SELECIONADO =============
  const selectedGroupEvolution = useMemo(() => {
    if (!selectedGrupo) return [];
    
    const porMes: Record<string, number> = {};
    
    data.forEach((record) => {
      if (record.grupo !== selectedGrupo) return;
      porMes[record.ano_mes] = (porMes[record.ano_mes] || 0) + record.valor;
    });

    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({
        mes: formatMesShort(mes),
        mesCompleto: mes,
        valor,
      }));
  }, [data, selectedGrupo]);

  // ============= ANÁLISE POR CATEGORIA =============
  const categoryAnalysis = useMemo(() => {
    const porCatAno: Record<string, Record<string, number>> = {};
    
    data.forEach((record) => {
      const ano = record.ano_mes.substring(0, 4);
      const cat = categoriaMap[record.grupo] || 'Outras';
      
      if (!porCatAno[cat]) porCatAno[cat] = {};
      porCatAno[cat][ano] = (porCatAno[cat][ano] || 0) + Math.abs(record.valor);
    });

    return Object.entries(porCatAno).map(([categoria, anosData]) => ({
      categoria,
      dados: anos.map(ano => ({
        ano,
        valor: anosData[ano] || 0,
      })),
    }));
  }, [data, anos]);

  // ============= ANÁLISE DE SAZONALIDADE =============
  const seasonalAnalysis = useMemo(() => {
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const porMes: Record<string, { total: number; count: number; anos: Record<string, number> }> = {};
    
    // Inicializa
    mesesNomes.forEach((_, idx) => {
      const mesNum = String(idx + 1).padStart(2, '0');
      porMes[mesNum] = { total: 0, count: 0, anos: {} };
    });
    
    data.forEach((record) => {
      const ano = record.ano_mes.substring(0, 4);
      const mes = record.ano_mes.substring(5, 7);
      
      porMes[mes].total += record.valor;
      porMes[mes].anos[ano] = (porMes[mes].anos[ano] || 0) + record.valor;
      if (!porMes[mes].anos[ano]) porMes[mes].count++;
    });

    // Conta anos únicos
    const anosUnicos = new Set<string>();
    data.forEach(r => anosUnicos.add(r.ano_mes.substring(0, 4)));
    const numAnos = anosUnicos.size;

    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, dados]) => ({
        mes: mesesNomes[parseInt(mes) - 1],
        mesNum: mes,
        media: numAnos > 0 ? dados.total / numAnos : 0,
        total: dados.total,
        ...Object.fromEntries(Object.entries(dados.anos).map(([ano, val]) => [ano, val])),
      }));
  }, [data]);

  // ============= RANKING DE GRUPOS =============
  const groupRanking = useMemo(() => {
    const porGrupo: Record<string, number> = {};
    
    data.forEach((record) => {
      porGrupo[record.grupo] = (porGrupo[record.grupo] || 0) + record.valor;
    });

    return Object.entries(porGrupo)
      .map(([grupo, valor]) => ({ grupo, valor, absValor: Math.abs(valor) }))
      .sort((a, b) => b.absValor - a.absValor)
      .slice(0, 10);
  }, [data]);

  // ============= CONTRIBUIÇÃO POR CATEGORIA =============
  const categoryContribution = useMemo(() => {
    const porCat: Record<string, number> = {};
    let totalReceitas = 0;
    
    data.forEach((record) => {
      const cat = categoriaMap[record.grupo] || 'Outras';
      porCat[cat] = (porCat[cat] || 0) + record.valor;
      if (cat === 'Receitas') totalReceitas += record.valor;
    });

    return Object.entries(porCat)
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: totalReceitas !== 0 ? (valor / totalReceitas) * 100 : 0,
      }))
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado disponível para comparação
      </div>
    );
  }

  const varDelta = useMemo(() => {
    const a = yoyAnalysis.find(y => y.ano === selectedAno1);
    const b = yoyAnalysis.find(y => y.ano === selectedAno2);
    if (!a || !b || selectedAno1 === selectedAno2) return null;
    const dr = b.receitas !== 0 ? ((a.receitas - b.receitas) / Math.abs(b.receitas)) * 100 : 0;
    return { dr };
  }, [yoyAnalysis, selectedAno1, selectedAno2]);

  return (
    <div className="space-y-5">
      {/* Barra premium de comparação */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card/40 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />
        <div className="relative p-4 md:p-5 flex flex-wrap items-center gap-4 md:gap-6">
          {/* Bloco Comparar */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <GitCompare className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Comparar Períodos</span>
              <div className="flex items-center gap-2 mt-1">
                <Select value={selectedAno1} onValueChange={setSelectedAno1}>
                  <SelectTrigger className="w-[92px] h-8 text-sm font-semibold bg-background/60 border-border/70 hover:border-primary/40 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((ano) => (
                      <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] font-bold text-muted-foreground/70 tracking-widest">VS</span>
                <Select value={selectedAno2} onValueChange={setSelectedAno2}>
                  <SelectTrigger className="w-[92px] h-8 text-sm font-semibold bg-background/60 border-border/70 hover:border-primary/40 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((ano) => (
                      <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Delta rápido */}
          {varDelta && (
            <div className="hidden md:flex items-center gap-2 pl-6 border-l border-border/50">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Δ Receita</span>
              <VariationBadge value={varDelta.dr} />
            </div>
          )}

          <div className="flex-1" />

          {/* Tabs premium de tipo de análise */}
          <Tabs value={activeAnalysis} onValueChange={(v) => setActiveAnalysis(v as typeof activeAnalysis)}>
            <TabsList className="h-10 p-1 bg-background/50 border border-border/60 rounded-xl gap-0.5 backdrop-blur">
              {[
                { v: 'yoy', label: 'Ano a Ano', Icon: GitCompare },
                { v: 'grupos', label: 'Grupos', Icon: BarChart3 },
                { v: 'categorias', label: 'Categorias', Icon: Layers },
                { v: 'sazonalidade', label: 'Sazonalidade', Icon: Calendar },
              ].map(({ v, label, Icon }) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="text-xs px-3 h-8 gap-1.5 rounded-lg font-medium text-muted-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] transition-all"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>



      {/* ============= ABA ANO A ANO ============= */}
      {activeAnalysis === 'yoy' && (
        <div className="space-y-4">
          {/* Resumo YoY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tabela de evolução anual */}
            <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
              <CardHeader title="Evolução Anual" description={analysisDescriptions.yoy} icon={TrendingUp} />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-xs">Ano</TableHead>
                      <TableHead className="text-xs text-right">Receitas</TableHead>
                      <TableHead className="text-xs text-right">Var.</TableHead>
                      <TableHead className="text-xs text-right">Resultado</TableHead>
                      <TableHead className="text-xs text-right">Var.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yoyAnalysis.map((row, idx) => (
                      <TableRow key={row.ano} className="border-border/30">
                        <TableCell className="font-medium text-sm">{row.ano}</TableCell>
                        <TableCell className="text-right text-sm text-emerald-500">{formatCompactNumber(row.receitas)}</TableCell>
                        <TableCell className="text-right">
                          {idx > 0 && <VariationBadge value={row.varReceitas} />}
                        </TableCell>
                        <TableCell className={cn('text-right text-sm font-medium', row.resultado >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {formatCompactNumber(row.resultado)}
                        </TableCell>
                        <TableCell className="text-right">
                          {idx > 0 && <VariationBadge value={row.varResultado} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Gráfico de evolução */}
            <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
              <CardHeader title="Evolução Receitas vs Resultado" description="Comparação visual da evolução de receitas e resultado ao longo dos anos." icon={BarChart3}
                right={
                  <div className="hidden sm:flex items-center gap-3 text-[10px] font-medium">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Receitas</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-0.5 w-3 bg-primary rounded" /> Resultado</span>
                  </div>
                }
              />
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={yoyAnalysis} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.positive} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={COLORS.positive} stopOpacity={0.35} />
                      </linearGradient>
                      <linearGradient id="gradResultado" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={COLORS.primary} stopOpacity={1} />
                        <stop offset="100%" stopColor={COLORS.secondary} stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                    <XAxis dataKey="ano" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                    <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                      contentStyle={chartTooltipStyle}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                    <Bar dataKey="receitas" name="Receitas" fill="url(#gradReceitas)" radius={[6, 6, 0, 0]} barSize={38} />
                    <Line
                      type="monotone"
                      dataKey="resultado"
                      name="Resultado"
                      stroke="url(#gradResultado)"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--background))', stroke: COLORS.primary, strokeWidth: 2.5, r: 5 }}
                      activeDot={{ r: 7, fill: COLORS.primary, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Comparativo mensal entre anos */}
          {selectedAno1 !== selectedAno2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
                <CardHeader title={`Comparativo Mensal: ${selectedAno1} vs ${selectedAno2}`} description={analysisDescriptions.sameMonth} icon={Calendar} />
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparison} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey={selectedAno1} name={selectedAno1} fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                      <Bar dataKey={selectedAno2} name={selectedAno2} fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Variação por grupo */}
              <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
                <CardHeader title={`Variação por Grupo: ${selectedAno1} vs ${selectedAno2}`} description="Maiores variações absolutas entre os períodos selecionados." icon={GitCompare} />
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={directYearComparison.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis type="category" dataKey="grupo" width={100} stroke="hsl(var(--muted-foreground))" fontSize={9} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)} 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="ano1" name={selectedAno1} fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="ano2" name={selectedAno2} fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Tabela de variações detalhadas */}
          <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
            <CardHeader
              title="Variações Detalhadas por Grupo"
              description={analysisDescriptions.variance}
              icon={TrendingUp}
              right={
                <Badge variant="outline" className="text-[10px] font-medium bg-background/60 border-border/60 tabular-nums">
                  {directYearComparison.length} grupos
                </Badge>
              }
            />
            <div className="overflow-hidden rounded-xl border border-border/50">
              <div className="overflow-auto max-h-[380px] premium-scrollbar">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 h-10">Grupo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 text-right h-10">{selectedAno1}</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 text-right h-10">{selectedAno2}</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 text-right h-10">Diferença</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 text-right h-10 pr-4">Var. %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {directYearComparison.map((row, i) => (
                      <TableRow
                        key={row.grupoFull}
                        className={cn(
                          'border-border/30 transition-colors group',
                          i % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.15]',
                          'hover:bg-primary/[0.06]'
                        )}
                      >
                        <TableCell className="text-sm font-medium text-foreground/90 max-w-[280px]" title={row.grupoFull}>
                          <div className="flex items-center gap-2">
                            <span className={cn('h-6 w-0.5 rounded-full', row.diferencaAbs >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70')} />
                            <span className="truncate">{row.grupoFull}</span>
                          </div>
                        </TableCell>
                        <TableCell className={cn('text-right text-sm tabular-nums font-medium', row.ano1 >= 0 ? 'text-foreground' : 'text-red-400')}>
                          {formatCompactNumber(row.ano1)}
                        </TableCell>
                        <TableCell className={cn('text-right text-sm tabular-nums text-muted-foreground', row.ano2 < 0 && 'text-red-400/80')}>
                          {formatCompactNumber(row.ano2)}
                        </TableCell>
                        <TableCell className={cn('text-right text-sm tabular-nums font-semibold', row.diferencaAbs >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {row.diferencaAbs >= 0 ? '+' : ''}{formatCompactNumber(row.diferencaAbs)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <VariationBadge value={row.variacao} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}


      {activeAnalysis === 'grupos' && (() => {
        const rankingMax = Math.max(1, ...groupRanking.map(g => g.absValor));
        const grupoStats = (() => {
          if (!selectedGroupEvolution.length) return null;
          const vals = selectedGroupEvolution.map(e => e.valor);
          const first = vals[0];
          const last = vals[vals.length - 1];
          const total = vals.reduce((a, b) => a + b, 0);
          const variacao = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
          return { total, variacao, last };
        })();

        return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Evolução do Grupo */}
            <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
              <CardHeader title="Evolução do Grupo" description={analysisDescriptions.groupTrend} icon={BarChart3} />
              <Select value={selectedGrupo} onValueChange={setSelectedGrupo}>
                <SelectTrigger className="mb-4 h-9 bg-background/60 border-border/70 hover:border-primary/40 transition-colors text-sm font-medium">
                  <SelectValue placeholder="Selecione um grupo" />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((grupo) => (
                    <SelectItem key={grupo} value={grupo}>{grupo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {grupoStats && (
                <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-background/40 border border-border/40">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 font-semibold">Total no período</span>
                    <span className={cn('text-sm font-bold tabular-nums', grupoStats.total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatCompactNumber(grupoStats.total)}
                    </span>
                  </div>
                  <VariationBadge value={grupoStats.variacao} />
                </div>
              )}
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedGroupEvolution} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradGrupoLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={COLORS.primary} stopOpacity={1} />
                        <stop offset="100%" stopColor={COLORS.secondary} stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="gradGrupoArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={50} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Valor']} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={chartTooltipStyle} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                    <Area type="monotone" dataKey="valor" stroke="none" fill="url(#gradGrupoArea)" />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="url(#gradGrupoLine)"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(var(--background))', stroke: COLORS.primary, strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 6, fill: COLORS.primary, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking de grupos - executivo */}
            <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5 lg:col-span-2">
              <CardHeader
                title="Ranking de Grupos"
                description={analysisDescriptions.ranking}
                icon={TrendingUp}
                right={<Badge variant="outline" className="text-[10px] font-medium bg-background/60 border-border/60">Top 10</Badge>}
              />
              <div className="space-y-2 premium-scrollbar overflow-y-auto max-h-[340px] pr-1">
                {groupRanking.map((row, idx) => {
                  const pct = (row.absValor / rankingMax) * 100;
                  const positivo = row.valor >= 0;
                  const isTop3 = idx < 3;
                  return (
                    <div
                      key={row.grupo}
                      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl bg-background/30 hover:bg-primary/[0.06] border border-border/40 hover:border-primary/30 transition-all duration-200"
                    >
                      <div className={cn(
                        'flex items-center justify-center h-7 w-7 rounded-lg text-[11px] font-bold tabular-nums flex-shrink-0 transition-all',
                        isTop3
                          ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/30 shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]'
                          : 'bg-muted/40 text-muted-foreground'
                      )}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-[13px] font-medium text-foreground/90 truncate" title={row.grupo}>{row.grupo}</span>
                          <span className={cn('text-[13px] font-bold tabular-nums flex-shrink-0', positivo ? 'text-emerald-400' : 'text-red-400')}>
                            {formatCompactNumber(row.valor)}
                          </span>
                        </div>
                        <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className={cn(
                              'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                              positivo
                                ? 'bg-gradient-to-r from-emerald-500/70 to-emerald-400'
                                : 'bg-gradient-to-r from-red-500/70 to-red-400'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tabela de tendências por grupo - premium */}
          <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
            <CardHeader
              title="Tendência por Grupo"
              description="Análise da tendência de crescimento de cada grupo ao longo dos anos."
              icon={TrendingUp}
              right={<Badge variant="outline" className="text-[10px] font-medium bg-background/60 border-border/60 tabular-nums">{Math.min(15, groupAnalysis.length)} grupos · crescimento médio anual</Badge>}
            />
            <div className="overflow-hidden rounded-xl border border-border/50">
              <div className="overflow-auto max-h-[420px] premium-scrollbar">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 h-10 pl-4">Grupo</TableHead>
                      {anos.slice(0, 5).map(ano => (
                        <TableHead key={ano} className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 text-right h-10 tabular-nums">{ano}</TableHead>
                      ))}
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 text-right h-10 pr-4">Tendência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupAnalysis.slice(0, 15).map((row, i) => (
                      <TableRow
                        key={row.grupo}
                        className={cn(
                          'border-border/30 transition-colors group',
                          i % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.15]',
                          'hover:bg-primary/[0.06]'
                        )}
                      >
                        <TableCell className="text-sm font-medium text-foreground/90 max-w-[280px] pl-4" title={row.grupo}>
                          <div className="flex items-center gap-2">
                            <span className={cn('h-6 w-0.5 rounded-full', row.tendencia >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70')} />
                            <span className="truncate">{row.grupo}</span>
                          </div>
                        </TableCell>
                        {anos.slice(0, 5).map(ano => {
                          const val = row.valores.find(v => v.ano === ano);
                          if (!val) {
                            return <TableCell key={ano} className="text-right text-sm text-muted-foreground/40 tabular-nums">—</TableCell>;
                          }
                          return (
                            <TableCell
                              key={ano}
                              className={cn(
                                'text-right text-sm tabular-nums font-medium',
                                val.valor >= 0 ? 'text-foreground/85' : 'text-red-400'
                              )}
                            >
                              {formatCompactNumber(val.valor)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right pr-4">
                          <VariationBadge value={row.tendencia} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
        );
      })()}


      {/* ============= ABA CATEGORIAS ============= */}
      {activeAnalysis === 'categorias' && (() => {
        const maxContribAbs = Math.max(1, ...categoryContribution.map(c => Math.abs(c.percentual)));
        const evolucaoData = anos.map(ano => {
          const obj: Record<string, any> = { ano };
          categoryAnalysis.forEach(cat => {
            const dado = cat.dados.find(d => d.ano === ano);
            obj[cat.categoria] = dado ? dado.valor : 0;
          });
          return obj;
        });
        return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Contribuição por categoria - executivo */}
            <div className="lg:col-span-2 bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
              <CardHeader
                title="Contribuição por Categoria"
                description={analysisDescriptions.contribution}
                icon={Layers}
                right={<Badge variant="outline" className="text-[10px] font-medium bg-background/60 border-border/60">% Receita</Badge>}
              />
              <div className="space-y-2.5 mt-1 premium-scrollbar overflow-y-auto max-h-[340px] pr-1">
                {categoryContribution.map((cat, idx) => {
                  const positivo = cat.valor >= 0;
                  const barPct = (Math.abs(cat.percentual) / maxContribAbs) * 100;
                  const swatch = CHART_COLORS[idx % CHART_COLORS.length];
                  return (
                    <div
                      key={cat.categoria}
                      className="group relative px-3 py-2.5 rounded-xl bg-background/30 hover:bg-primary/[0.06] border border-border/40 hover:border-primary/30 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-inset ring-background/40"
                            style={{ backgroundColor: swatch, boxShadow: `0 0 10px -2px ${swatch}` }}
                          />
                          <span className="text-[13px] font-medium text-foreground/90 truncate" title={cat.categoria}>{cat.categoria}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn('text-[13px] font-bold tabular-nums', positivo ? 'text-emerald-400' : 'text-red-400')}>
                            {formatCompactNumber(cat.valor)}
                          </span>
                          <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-muted/40 text-muted-foreground min-w-[52px] text-right">
                            {formatPercent(cat.percentual / 100)}
                          </span>
                        </div>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                          style={{
                            width: `${barPct}%`,
                            background: `linear-gradient(90deg, ${swatch}88, ${swatch})`,
                            boxShadow: `0 0 12px -2px ${swatch}66`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Evolução por categoria */}
            <div className="lg:col-span-3 bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
              <CardHeader
                title="Evolução por Categoria"
                description="Comparação da evolução de cada categoria ao longo dos anos."
                icon={BarChart3}
              />
              {/* Legenda premium: chips com marcador de cor evidente */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground/80 mr-1">
                  Categorias
                </span>
                {categoryAnalysis.map((cat, idx) => {
                  const c = CHART_COLORS[idx % CHART_COLORS.length];
                  return (
                    <span
                      key={cat.categoria}
                      className="group inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-background/60 border border-border/60 text-[11.5px] font-medium text-foreground/90 hover:bg-background hover:border-border transition-all hover:-translate-y-px shadow-[0_1px_0_0_hsl(var(--border)/0.3)_inset]"
                    >
                      <span className="relative flex items-center justify-center h-4 w-4 rounded-full" style={{ backgroundColor: `${c}22` }}>
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-2 ring-background/80"
                          style={{ backgroundColor: c, boxShadow: `0 0 10px -1px ${c}, 0 0 2px 0 ${c}` }}
                        />
                      </span>
                      <span className="whitespace-nowrap leading-none">{cat.categoria}</span>
                    </span>
                  );
                })}
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolucaoData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <defs>
                      {categoryAnalysis.map((cat, idx) => {
                        const c = CHART_COLORS[idx % CHART_COLORS.length];
                        return (
                          <linearGradient key={cat.categoria} id={`gradCat${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={c} stopOpacity={1} />
                            <stop offset="100%" stopColor={c} stopOpacity={0.65} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                    <XAxis dataKey="ano" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                    <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={55} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const rows = [...payload].reverse();
                        const total = rows.reduce((s, r: any) => s + (r.value || 0), 0);
                        return (
                          <div className="rounded-xl border border-border/70 bg-popover/95 backdrop-blur-md shadow-[0_18px_50px_-14px_rgba(0,0,0,0.7)] min-w-[280px] overflow-hidden">
                            <div className="px-3.5 py-2.5 border-b border-border/60 bg-gradient-to-r from-muted/40 to-muted/10 flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Ano</span>
                              <span className="text-sm font-bold tabular-nums text-foreground">{label}</span>
                            </div>
                            <div className="py-1.5">
                              {rows.map((r: any) => {
                                const catIdx = categoryAnalysis.findIndex(c => c.categoria === r.name);
                                const solid = CHART_COLORS[(catIdx >= 0 ? catIdx : 0) % CHART_COLORS.length];
                                return (
                                  <div
                                    key={r.dataKey}
                                    className="relative flex items-center gap-3 pl-3.5 pr-3 py-1.5 hover:bg-muted/30 transition-colors"
                                  >
                                    <span
                                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
                                      style={{ backgroundColor: solid, boxShadow: `0 0 8px 0 ${solid}` }}
                                    />
                                    <span
                                      className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-background/70"
                                      style={{ backgroundColor: solid, boxShadow: `0 0 8px -1px ${solid}` }}
                                    />
                                    <span className="text-[11.5px] text-foreground/85 flex-1 truncate font-medium">{r.name}</span>
                                    <span className={cn('text-[12.5px] font-semibold tabular-nums', r.value >= 0 ? 'text-foreground' : 'text-red-400')}>
                                      {formatCurrency(r.value)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="px-3.5 py-2.5 border-t border-border/60 bg-gradient-to-r from-muted/30 to-muted/5 flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Total</span>
                              <span className={cn('text-sm font-bold tabular-nums', total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                {formatCurrency(total)}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                    {categoryAnalysis.map((cat, idx) => (
                      <Bar
                        key={cat.categoria}
                        dataKey={cat.categoria}
                        name={cat.categoria}
                        fill={`url(#gradCat${idx})`}
                        stackId="stack"
                        radius={idx === categoryAnalysis.length - 1 ? [6, 6, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabela detalhada de categorias - premium */}
          <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
            <CardHeader
              title="Detalhamento por Categoria e Ano"
              description="Valores absolutos de cada categoria por ano."
              icon={Layers}
              right={<Badge variant="outline" className="text-[10px] font-medium bg-background/60 border-border/60 tabular-nums">{categoryAnalysis.length} categorias · {anos.length} anos</Badge>}
            />
            <div className="overflow-hidden rounded-xl border border-border/50">
              <div className="overflow-auto premium-scrollbar">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 h-10 pl-4">Categoria</TableHead>
                      {anos.map(ano => (
                        <TableHead key={ano} className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/90 text-right h-10 tabular-nums">{ano}</TableHead>
                      ))}
                      <TableHead className="text-[10px] uppercase tracking-[0.1em] font-semibold text-primary/90 text-right h-10 pr-4">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryAnalysis.map((cat, i) => {
                      const total = cat.dados.reduce((sum, d) => sum + d.valor, 0);
                      const swatch = CHART_COLORS[i % CHART_COLORS.length];
                      return (
                        <TableRow
                          key={cat.categoria}
                          className={cn(
                            'border-border/30 transition-colors group',
                            i % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.15]',
                            'hover:bg-primary/[0.06]'
                          )}
                        >
                          <TableCell className="font-medium text-sm text-foreground/90 pl-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="h-2 w-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: swatch, boxShadow: `0 0 8px -1px ${swatch}` }}
                              />
                              <span className="truncate">{cat.categoria}</span>
                            </div>
                          </TableCell>
                          {cat.dados.map(d => (
                            <TableCell
                              key={d.ano}
                              className={cn(
                                'text-right text-sm tabular-nums font-medium',
                                d.valor === 0 ? 'text-muted-foreground/40' : d.valor >= 0 ? 'text-foreground/85' : 'text-red-400'
                              )}
                            >
                              {d.valor === 0 ? '—' : formatCompactNumber(d.valor)}
                            </TableCell>
                          ))}
                          <TableCell className={cn('text-right text-sm tabular-nums font-bold pr-4', total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {formatCompactNumber(total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
        );
      })()}


      {/* ============= ABA SAZONALIDADE ============= */}
      {activeAnalysis === 'sazonalidade' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Padrão sazonal */}
            <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
              <CardHeader title="Padrão Sazonal (Média Mensal)" description={analysisDescriptions.seasonal} icon={Calendar} />
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={seasonalAnalysis} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="media" name="Média" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="total" name="Total Acumulado" stroke={COLORS.secondary} strokeWidth={2} dot={{ fill: COLORS.secondary, r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparativo de meses por ano */}
            <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
              <CardHeader title="Comparativo Mensal por Ano" description="Resultado de cada mês separado por ano, para identificar padrões sazonais." icon={Calendar} />
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seasonalAnalysis} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    {anos.slice(0, 5).map((ano, idx) => (
                      <Line key={ano} type="monotone" dataKey={ano} name={ano} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={{ fill: CHART_COLORS[idx % CHART_COLORS.length], r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabela de sazonalidade */}
          <div className="bg-gradient-to-b from-card to-card/60 rounded-2xl border border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_8px_24px_-12px_rgba(0,0,0,0.35)] p-5">
            <CardHeader title="Detalhamento Mensal por Ano" description="Valores de cada mês para todos os anos disponíveis." icon={Calendar} />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-xs">Mês</TableHead>
                    {anos.map(ano => (
                      <TableHead key={ano} className="text-xs text-right">{ano}</TableHead>
                    ))}
                    <TableHead className="text-xs text-right">Média</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasonalAnalysis.map((row) => (
                    <TableRow key={row.mesNum} className="border-border/30">
                      <TableCell className="font-medium text-sm">{row.mes}</TableCell>
                      {anos.map(ano => (
                        <TableCell key={ano} className={cn('text-right text-sm tabular-nums', (row[ano] || 0) >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {row[ano] ? formatCompactNumber(row[ano]) : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-sm tabular-nums font-medium text-primary">
                        {formatCompactNumber(row.media)}
                      </TableCell>
                      <TableCell className={cn('text-right text-sm tabular-nums font-bold', row.total >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                        {formatCompactNumber(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMesShort(anoMes: string): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [ano, mes] = anoMes.split('-');
  return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`;
}