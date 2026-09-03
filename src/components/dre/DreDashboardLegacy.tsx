import { useMemo, useState, useCallback } from 'react';
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
  PieChart,
  Pie,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { DreRecord, DreGroupSummary } from '@/types/dre';
import { formatCurrency, formatCompactNumber, formatPercent } from '@/utils/formatters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Settings2 } from 'lucide-react';
import { DespesasVariaveisDialog } from './DespesasVariaveisDialog';
import { DespesasFixasDialog } from './DespesasFixasDialog';
import { getEffectiveFixedAccountCodes, getEffectiveVariableAccountCodes, isGrupoFixoDre, isGrupoVariavelDre } from '@/utils/dreExpenseAccounts';

interface DreDashboardProps {
  data: DreRecord[];
  groupSummary: DreGroupSummary[];
  contasDespVar: Set<string>;
  contasDespFixas: Set<string>;
  excludedContasDespFixas: Set<string>;
  excludedContasDespVar: Set<string>;
  onContasDespVarChange: (contas: Set<string>) => void;
  onContasDespFixasChange: (contas: Set<string>) => void;
  onExcludedContasDespFixasChange: (contas: Set<string>) => void;
  onExcludedContasDespVarChange: (contas: Set<string>) => void;
}

// Descrições das análises
const analysisDescriptions: Record<string, string> = {
  grupoRaiz: 'Agrupa os lançamentos contábeis em categorias principais: Lucro Bruto, Resultado Financeiro, Despesas Operacionais e Administrativas. Valores calculados a partir dos grupos do DRE.',
  distribuicaoCategoria: 'Mostra a proporção de cada categoria principal (Receitas, Custos, Despesas, etc.) em relação ao total absoluto dos lançamentos.',
  evolucaoMensal: 'Exibe a evolução do resultado líquido (soma de todos os valores) mês a mês, baseado no campo ano_mes dos lançamentos.',
  margemLiquida: 'Percentual do resultado líquido em relação às receitas totais de cada mês. Calculado como (Resultado / Receitas) × 100.',
  receitasCustos: 'Comparativo mensal entre receitas brutas, custos (CMV e CSV) e despesas operacionais, extraídos dos grupos do DRE.',
  evolucaoAnual: 'Totalização anual de receitas e resultado líquido, agregando todos os meses de cada ano presente nos dados.',
  topGrupos: 'Os 10 grupos contábeis com maiores valores absolutos, mostrando a distribuição dos lançamentos por natureza.',
};

// Mapeamento para categorias principais
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

// Mapeamento de Grupo Raiz baseado no NivelOrder
const grupoRaizMap: Record<string, string> = {
  'Receitas': 'Lucro Bruto (Margem Contribuição)',
  'Impostos': 'Lucro Bruto (Margem Contribuição)',
  'Custos de Vendas de Mercadorias': 'Lucro Bruto (Margem Contribuição)',
  'Custos de Vendas de Serviços': 'Lucro Bruto (Margem Contribuição)',
  'Receitas Financeiros': 'Resultado Financeiro Líquido',
  'Despesas Financeiros': 'Resultado Financeiro Líquido',
  'Despesas com Pessoal de Vendas': 'Despesas Operacionais',
  'Outras Despesas com vendas': 'Despesas Operacionais',
  'Provisão para Credito Liquid. Duvidosas': 'Despesas Operacionais',
  'Despesas E-Commerce': 'Despesas Operacionais',
  'Despesas com Pessoal Administrativo': 'Despesas Administrativas',
  'Outras Despesas Administrativas': 'Despesas Administrativas',
  'Despesas Não Dedutiveis': 'Despesas Administrativas',
  'Despesas Tributárias': 'Despesas Administrativas',
};

const COLORS = [
  'hsl(142, 71%, 45%)',  // verde
  'hsl(0, 72%, 51%)',    // vermelho
  'hsl(221, 83%, 53%)',  // azul
  'hsl(45, 93%, 47%)',   // amarelo
  'hsl(280, 65%, 60%)',  // roxo
  'hsl(180, 60%, 45%)',  // ciano
];

const GRUPO_RAIZ_COLORS: Record<string, string> = {
  'Lucro Bruto (Margem Contribuição)': 'hsl(142, 71%, 45%)',
  'Resultado Financeiro Líquido': 'hsl(221, 83%, 53%)',
  'Despesas Operacionais': 'hsl(0, 72%, 51%)',
  'Despesas Administrativas': 'hsl(280, 65%, 60%)',
  'Outras Receitas e Despesas Operacionais': 'hsl(45, 93%, 47%)',
};

// Contas padrão de Despesas Variáveis
const DEFAULT_CONTAS_DESP_VARIAVEIS = [
  '3.1.1.02.02.00001','3.1.1.02.02.00002','3.1.1.02.02.00003','3.1.1.02.02.00004',
  '3.1.1.02.02.00005','3.1.1.02.02.00006','3.1.1.02.02.00007','3.1.1.02.02.00008',
  '3.1.1.02.02.00009','3.1.1.02.02.00024','3.1.1.02.02.00011','3.1.1.02.02.00012',
  '3.1.1.02.02.00013','3.1.1.02.02.00014','3.1.1.02.02.00015','3.1.1.02.02.00016',
  '3.1.1.02.02.00017','3.1.1.02.02.00018','3.1.1.02.02.00019','3.1.1.02.02.00020',
  '3.1.2.01.01.00015','3.1.2.01.01.00010','3.1.2.01.01.00016','3.1.2.01.01.00014',
  '3.1.2.01.02.00001','3.1.2.01.02.00002','3.1.2.01.02.00003',
  '3.1.2.02.01.00010','3.1.2.03.01.00001','3.1.2.03.01.00002','3.1.2.04.01.00001',
];

// Contas padrão de Despesas Fixas (do print do usuário)
const DEFAULT_CONTAS_DESP_FIXAS = [
  '3.1.2.01.01.00001','3.1.2.01.01.00002','3.1.2.01.01.00003','3.1.2.01.01.00004',
  '3.1.2.01.01.00005','3.1.2.01.01.00006','3.1.2.01.01.00007','3.1.2.01.01.00008',
  '3.1.2.01.01.00011','3.1.2.01.02.00004','3.1.2.02.03.00005','3.1.2.01.02.00006',
  '3.1.2.02.01.00001','3.1.2.02.01.00002','3.1.2.02.01.00003','3.1.2.02.01.00004',
  '3.1.2.02.01.00005','3.1.2.02.01.00006','3.1.2.02.01.00007','3.1.2.02.01.00008',
  '3.1.2.02.01.00009','3.1.2.02.01.00011','3.1.2.02.02.00001','3.1.2.02.02.00002',
  '3.1.2.02.02.00003','3.1.2.02.02.00004','3.1.2.02.02.00005','3.1.2.02.02.00006',
  '3.1.2.02.02.00007','3.1.2.02.02.00008','3.1.2.02.02.00009','3.1.2.02.02.00010',
  '3.1.2.02.02.00011','3.1.2.02.02.00012','3.1.2.02.02.00013','3.1.2.02.02.00014',
  '3.1.2.02.04.00001','3.1.2.02.02.00016','3.1.2.02.02.00017','3.1.2.02.02.00038',
  '3.1.2.02.02.00019','3.1.2.02.02.00020','3.1.2.02.02.00021','3.1.2.02.02.00022',
  '3.1.2.02.02.00023','3.1.2.02.03.00006','3.1.2.02.02.00025','3.1.2.02.02.00026',
  '3.1.2.02.02.00027','3.1.2.02.02.00028','3.1.2.02.02.00029','3.1.2.02.02.00030',
  '3.1.2.02.02.00031','3.1.2.02.02.00032','3.1.2.02.03.00004','3.1.2.02.03.00002',
  '3.1.2.02.01.00013','3.1.2.02.02.00036','3.1.2.03.02.00001','3.1.2.03.02.00002',
  '3.1.2.03.02.00003','3.1.2.03.02.00004','3.1.2.03.02.00005','3.1.2.03.02.00006',
  '3.1.2.01.03.00001','3.1.2.03.01.00003','3.1.2.04.02.00002',
];

// Componente de header com tooltip de informação
function CardHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <TooltipProvider>
        <UITooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs">{description}</p>
          </TooltipContent>
        </UITooltip>
      </TooltipProvider>
    </div>
  );
}

export function DreDashboardLegacy({
  data,
  groupSummary,
  contasDespVar,
  contasDespFixas,
  excludedContasDespFixas,
  excludedContasDespVar,
  onContasDespVarChange,
  onContasDespFixasChange,
  onExcludedContasDespFixasChange,
  onExcludedContasDespVarChange,
}: DreDashboardProps) {
  const [showDespVarDialog, setShowDespVarDialog] = useState(false);
  const [showDespFixasDialog, setShowDespFixasDialog] = useState(false);

  // Records at max detail level (used by dialog and calculations)
  const maxLevelRecords = useMemo(() => {
    const nivelMaxPorGrupo: Record<string, number> = {};
    data.forEach(r => {
      if (!nivelMaxPorGrupo[r.grupo] || r.nivel > nivelMaxPorGrupo[r.grupo]) {
        nivelMaxPorGrupo[r.grupo] = r.nivel;
      }
    });
    return data.filter(r => r.nivel === nivelMaxPorGrupo[r.grupo]);
  }, [data]);

  const effectiveContasDespVar = useMemo(() => {
    return getEffectiveVariableAccountCodes({
      allRecords: maxLevelRecords,
      selectedVariableCodes: contasDespVar,
      excludedVariableCodes: excludedContasDespVar,
    });
  }, [maxLevelRecords, contasDespVar, excludedContasDespVar]);

  const effectiveContasDespFixas = useMemo(() => {
    return getEffectiveFixedAccountCodes({
      allRecords: maxLevelRecords,
      selectedFixedCodes: contasDespFixas,
      excludedFixedCodes: excludedContasDespFixas,
      variableCodes: effectiveContasDespVar,
    });
  }, [maxLevelRecords, contasDespFixas, excludedContasDespFixas, effectiveContasDespVar]);

  // Grupo Raiz summary - usando dados reais do JSON
  const grupoRaizSummary = useMemo(() => {
    const grupos: Record<string, number> = {};
    let totalReceitas = 0;
    
    data.forEach((record) => {
      const grupoRaiz = grupoRaizMap[record.grupo] || 'Outras Receitas e Despesas Operacionais';
      grupos[grupoRaiz] = (grupos[grupoRaiz] || 0) + record.valor;
      
      if (record.grupo === 'Receitas') {
        totalReceitas += record.valor;
      }
    });

    return Object.entries(grupos)
      .map(([grupo, valor]) => ({
        grupo,
        valor,
        percentual: totalReceitas !== 0 ? (valor / totalReceitas) * 100 : 0,
      }))
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  }, [data]);

  // Análise por Grupo Raiz - layout detalhado
  const analiseGrupoRaiz = useMemo(() => {
    const records = maxLevelRecords;

    let receitas = 0;
    let devolucoes = 0;
    let impostos = 0;
    let custos = 0;
    let despFixas = 0;
    let despVariaveis = 0;
    let financeiro = 0;
    let outras = 0;
    let provisaoIRPJ = 0;

    records.forEach(r => {
      const g = r.grupo;
      const isContaDespVar = effectiveContasDespVar.has(r.codigo);
      const isContaDespFixa = effectiveContasDespFixas.has(r.codigo);
      const pertenceGrupoFixoGerenciado = isGrupoFixoDre(g);
      const pertenceGrupoVariavelGerenciado = isGrupoVariavelDre(g);

      if (isContaDespVar) {
        despVariaveis += r.valor;
      } else if (isContaDespFixa) {
        despFixas += r.valor;
      } else if (g === 'Receitas') receitas += r.valor;
      else if (g === 'Devoluções') devolucoes += r.valor;
      else if (g === 'Impostos') impostos += r.valor;
      else if (g === 'Custos de Vendas de Mercadorias') custos += r.valor;
      else if (pertenceGrupoFixoGerenciado || pertenceGrupoVariavelGerenciado) return;
      else if (g === 'Receitas Financeiros' || g === 'Despesas Financeiros') financeiro += r.valor;
      else if (g === 'Provisão Para IRPJ e CSLL') provisaoIRPJ += r.valor;
      else outras += r.valor;
    });

    const vendasLiquidas = receitas + devolucoes;
    const absVendasLiquidas = Math.abs(vendasLiquidas);
    const deducoes = devolucoes + impostos;
    const lucroBruto = receitas + deducoes + custos;
    const totalDespesas = despFixas + despVariaveis;
    const lucroOperacional = lucroBruto + totalDespesas + financeiro + outras;
    const lucroFinal = records.reduce((s, r) => s + r.valor, 0);
    const custoMedio = absVendasLiquidas !== 0 ? Math.abs(custos) / absVendasLiquidas : 0;
    const markup = (Math.abs(deducoes) + Math.abs(custos)) !== 0 ? Math.abs(receitas) / (Math.abs(deducoes) + Math.abs(custos)) : 0;

    const pct = (v: number) => absVendasLiquidas !== 0 ? (v / absVendasLiquidas) * 100 : 0;

    return {
      vendasLiquidas: { valor: vendasLiquidas, pct: 100 },
      lucroBruto: { valor: lucroBruto, pct: pct(lucroBruto) },
      despFixas: { valor: despFixas, pct: pct(Math.abs(despFixas)) },
      despVariaveis: { valor: despVariaveis, pct: pct(Math.abs(despVariaveis)) },
      totalDespesas: { valor: totalDespesas, pct: pct(Math.abs(totalDespesas)) },
      custoMedio: { valor: Math.abs(custos), pct: absVendasLiquidas !== 0 ? (Math.abs(custos) / absVendasLiquidas) * 100 : 0 },
      resultadoFinanceiro: { valor: financeiro, pct: pct(financeiro) },
      lucroOperacional: { valor: lucroOperacional, pct: pct(lucroOperacional) },
      provisaoIRPJ: { valor: provisaoIRPJ, pct: pct(Math.abs(provisaoIRPJ)) },
      lucroFinal: { valor: lucroFinal, pct: pct(lucroFinal) },
      markup,
    };
  }, [maxLevelRecords, effectiveContasDespVar, effectiveContasDespFixas]);

  // Evolução mensal do resultado - usando dados reais
  const evolucaoMensal = useMemo(() => {
    const porMes: Record<string, { receitas: number; custos: number; despesas: number; resultado: number }> = {};
    
    data.forEach((record) => {
      const mes = record.ano_mes;
      if (!porMes[mes]) {
        porMes[mes] = { receitas: 0, custos: 0, despesas: 0, resultado: 0 };
      }
      
      const categoria = categoriaMap[record.grupo] || 'Outras';
      const valor = record.valor;
      
      if (categoria === 'Receitas') {
        porMes[mes].receitas += valor;
      } else if (categoria === 'Custos') {
        porMes[mes].custos += Math.abs(valor);
      } else if (categoria === 'Despesas') {
        porMes[mes].despesas += Math.abs(valor);
      }
      
      porMes[mes].resultado += valor;
    });

    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valores]) => ({
        mes: formatMesShort(mes),
        mesCompleto: mes,
        ...valores,
      }));
  }, [data]);

   // Distribuição por categoria de despesas - baseado no analiseGrupoRaiz
  const distribuicaoCategorias = useMemo(() => {
    const fixas = Math.abs(analiseGrupoRaiz.despFixas.valor);
    const variaveis = Math.abs(analiseGrupoRaiz.despVariaveis.valor);
    const total = fixas + variaveis;
    const items = [
      { name: 'Despesas Fixas', value: fixas, pct: total !== 0 ? (fixas / total) * 100 : 0 },
      { name: 'Despesas Variáveis', value: variaveis, pct: total !== 0 ? (variaveis / total) * 100 : 0 },
    ].filter(i => i.value > 0);
    return items;
  }, [analiseGrupoRaiz]);

  // Evolução anual - usando dados reais
  const evolucaoAnual = useMemo(() => {
    const porAno: Record<string, { receitas: number; resultado: number }> = {};
    
    data.forEach((record) => {
      const ano = record.ano_mes.substring(0, 4);
      if (!porAno[ano]) {
        porAno[ano] = { receitas: 0, resultado: 0 };
      }
      
      if (record.grupo === 'Receitas') {
        porAno[ano].receitas += record.valor;
      }
      porAno[ano].resultado += record.valor;
    });

    return Object.entries(porAno)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, valores]) => ({
        ano,
        ...valores,
      }));
  }, [data]);

  // Top 10 grupos - usando groupSummary que já vem calculado
  const topGrupos = useMemo(() => {
    return groupSummary
      .slice(0, 10)
      .map((g) => ({
        grupo: g.grupo.length > 25 ? g.grupo.substring(0, 25) + '...' : g.grupo,
        valor: g.total,
        absValor: Math.abs(g.total),
      }));
  }, [groupSummary]);

  // Margem mensal - calculado a partir dos dados reais
  const margemMensal = useMemo(() => {
    return evolucaoMensal.map((item) => ({
      mes: item.mes,
      margem: item.receitas !== 0 ? (item.resultado / item.receitas) * 100 : 0,
    }));
  }, [evolucaoMensal]);

  const getBarColor = (value: number) => {
    if (value > 0) return 'hsl(142, 71%, 45%)';
    if (value < 0) return 'hsl(0, 72%, 51%)';
    return 'hsl(220, 9%, 46%)';
  };

  // Se não há dados, mostra mensagem
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado disponível para exibição
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Linha 1: Grupo Raiz + Distribuição por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grupo Raiz - Layout detalhado */}
        <div className="bg-card rounded-lg border border-border p-4 lg:col-span-2">
          <CardHeader title="Resultado por Grupo Raiz" description={analysisDescriptions.grupoRaiz} />
          <div className="space-y-1">
            {/* Vendas Líquidas de Devolução */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(210, 70%, 50%)', backgroundColor: 'hsl(210, 70%, 50%, 0.1)', '--dre-row-color': 'hsl(210, 70%, 50%, 0.4)', '--dre-row-color-bg-hover': 'hsl(210, 70%, 50%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-bold text-foreground flex items-center gap-1">
                Vendas Líquidas de Devolução
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Composição:</p><p>• Receitas</p><p>• Devoluções</p><p className="mt-1 text-muted-foreground">Base para todos os percentuais (AV%)</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-bold text-foreground">{formatCurrency(analiseGrupoRaiz.vendasLiquidas.valor)}</span>
              <span className="px-3 py-2 text-sm font-bold text-foreground w-24 text-right">{analiseGrupoRaiz.vendasLiquidas.pct.toFixed(2)}%</span>
            </div>
            {/* Lucro Bruto */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(50, 70%, 45%)', backgroundColor: 'hsl(50, 70%, 45%, 0.1)', '--dre-row-color': 'hsl(50, 70%, 45%, 0.4)', '--dre-row-color-bg-hover': 'hsl(50, 70%, 45%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-bold text-foreground flex items-center gap-1">
                Lucro Bruto
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Composição:</p><p>• Receitas</p><p>• (-) Deduções de Receita</p><p>• Custos de Vendas de Mercadorias</p><p>• Custos de Vendas de Serviços</p><p className="mt-1 text-muted-foreground">% = Lucro Bruto ÷ |Vendas Líquidas|</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-bold text-foreground">{formatCurrency(analiseGrupoRaiz.lucroBruto.valor)}</span>
              <span className="px-3 py-2 text-sm font-bold text-foreground w-24 text-right">{analiseGrupoRaiz.lucroBruto.pct.toFixed(2)}%</span>
            </div>
            {/* Despesas Fixas */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(180, 100%, 40%)', backgroundColor: 'hsl(180, 100%, 40%, 0.1)', '--dre-row-color': 'hsl(180, 100%, 40%, 0.4)', '--dre-row-color-bg-hover': 'hsl(180, 100%, 40%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-semibold text-foreground flex items-center gap-1">
                Despesas Fixas
                <button onClick={() => setShowDespFixasDialog(true)} className="text-muted-foreground hover:text-primary transition-colors relative z-50" title="Gerenciar contas">
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-muted-foreground">({effectiveContasDespFixas.size} contas)</span>
              </span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground">{formatCurrency(Math.abs(analiseGrupoRaiz.despFixas.valor))}</span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground w-24 text-right">{analiseGrupoRaiz.despFixas.pct.toFixed(2)}%</span>
            </div>
            {/* Despesas Variáveis */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(0, 0%, 60%)', backgroundColor: 'hsl(0, 0%, 60%, 0.1)', '--dre-row-color': 'hsl(0, 0%, 60%, 0.4)', '--dre-row-color-bg-hover': 'hsl(0, 0%, 60%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-semibold text-foreground flex items-center gap-1">
                Despesas Variáveis
                <button onClick={() => setShowDespVarDialog(true)} className="text-muted-foreground hover:text-primary transition-colors relative z-50" title="Gerenciar contas">
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-muted-foreground">({effectiveContasDespVar.size} contas)</span>
              </span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground">{formatCurrency(Math.abs(analiseGrupoRaiz.despVariaveis.valor))}</span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground w-24 text-right">{analiseGrupoRaiz.despVariaveis.pct.toFixed(2)}%</span>
            </div>
            {/* Total Despesas */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(0, 80%, 55%)', backgroundColor: 'hsl(0, 80%, 55%, 0.1)', '--dre-row-color': 'hsl(0, 80%, 55%, 0.4)', '--dre-row-color-bg-hover': 'hsl(0, 80%, 55%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-bold text-foreground flex items-center gap-1">
                Total Despesas
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Composição:</p><p>• Despesas Fixas</p><p>• Despesas Variáveis</p><p className="mt-1 text-muted-foreground">% = |Total Desp.| ÷ |Vendas Líquidas|</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-bold text-foreground">{formatCurrency(Math.abs(analiseGrupoRaiz.totalDespesas.valor))}</span>
              <span className="px-3 py-2 text-sm font-bold text-foreground w-24 text-right">{analiseGrupoRaiz.totalDespesas.pct.toFixed(2)}%</span>
            </div>
            {/* Custo Médio */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(30, 100%, 55%)', backgroundColor: 'hsl(30, 100%, 55%, 0.1)', '--dre-row-color': 'hsl(30, 100%, 55%, 0.4)', '--dre-row-color-bg-hover': 'hsl(30, 100%, 55%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-semibold text-foreground flex items-center gap-1">
                Custo Médio
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Fórmula:</p><p>• |Custos de Vendas de Mercadorias|</p><p>• ÷ |Vendas Líquidas|</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground">{formatCurrency(analiseGrupoRaiz.custoMedio.valor)}</span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground w-24 text-right">{analiseGrupoRaiz.custoMedio.pct.toFixed(2)}%</span>
            </div>
            {/* Lucro Operacional */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(120, 100%, 35%)', backgroundColor: 'hsl(120, 100%, 35%, 0.1)', '--dre-row-color': 'hsl(120, 100%, 35%, 0.4)', '--dre-row-color-bg-hover': 'hsl(120, 100%, 35%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-bold text-foreground flex items-center gap-1">
                Lucro Operacional
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Composição:</p><p>• Lucro Bruto</p><p>• + Total Despesas</p><p>• + Resultado Financeiro</p><p>• + Outras Receitas/Despesas</p><p className="mt-1 text-muted-foreground">% = Lucro Op. ÷ |Vendas Líquidas|</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-bold text-foreground">{formatCurrency(analiseGrupoRaiz.lucroOperacional.valor)}</span>
              <span className="px-3 py-2 text-sm font-bold text-foreground w-24 text-right">{analiseGrupoRaiz.lucroOperacional.pct.toFixed(2)}%</span>
            </div>
            {/* Resultado Financeiro Líquido */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(200, 60%, 50%)', backgroundColor: 'hsl(200, 60%, 50%, 0.1)', '--dre-row-color': 'hsl(200, 60%, 50%, 0.4)', '--dre-row-color-bg-hover': 'hsl(200, 60%, 50%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-semibold text-foreground flex items-center gap-1">
                Resultado Financeiro Líquido
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Composição:</p><p>• Receitas Financeiras</p><p>• Despesas Financeiras</p><p className="mt-1 text-muted-foreground">% = Resultado Financeiro ÷ |Vendas Líquidas|</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground">{formatCurrency(analiseGrupoRaiz.resultadoFinanceiro.valor)}</span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground w-24 text-right">{analiseGrupoRaiz.resultadoFinanceiro.pct.toFixed(2)}%</span>
            </div>
            {/* Provisão Para IRPJ e CSLL */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(320, 60%, 50%)', backgroundColor: 'hsl(320, 60%, 50%, 0.1)', '--dre-row-color': 'hsl(320, 60%, 50%, 0.4)', '--dre-row-color-bg-hover': 'hsl(320, 60%, 50%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-semibold text-foreground flex items-center gap-1">
                Provisão Para IRPJ e CSLL
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Composição:</p><p>• Provisão para IRPJ</p><p>• Provisão para CSLL</p><p className="mt-1 text-muted-foreground">% = |Provisão| ÷ |Vendas Líquidas|</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground">{formatCurrency(Math.abs(analiseGrupoRaiz.provisaoIRPJ.valor))}</span>
              <span className="px-3 py-2 text-sm font-semibold text-foreground w-24 text-right">{analiseGrupoRaiz.provisaoIRPJ.pct.toFixed(2)}%</span>
            </div>
            {/* Lucro Final */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(140, 80%, 30%)', backgroundColor: 'hsl(140, 80%, 30%, 0.1)', '--dre-row-color': 'hsl(140, 80%, 30%, 0.4)', '--dre-row-color-bg-hover': 'hsl(140, 80%, 30%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-bold text-foreground flex items-center gap-1">
                Lucro Final
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Composição:</p><p>• Soma total de todas as contas</p><p>• (Resultado líquido do exercício)</p><p className="mt-1 text-muted-foreground">% = Lucro Final ÷ |Vendas Líquidas|</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-bold text-foreground">{formatCurrency(analiseGrupoRaiz.lucroFinal.valor)}</span>
              <span className="px-3 py-2 text-sm font-bold text-foreground w-24 text-right">{analiseGrupoRaiz.lucroFinal.pct.toFixed(2)}%</span>
            </div>
            {/* Espaço */}
            <div className="h-2" />
            {/* Markup Médio */}
            <div className="flex items-center rounded-md border-l-4 transition-colors hover:bg-muted/40" style={{ borderLeftColor: 'hsl(50, 70%, 45%)', backgroundColor: 'hsl(50, 70%, 45%, 0.1)', '--dre-row-color': 'hsl(50, 70%, 45%, 0.4)', '--dre-row-color-bg-hover': 'hsl(50, 70%, 45%, 0.25)' } as React.CSSProperties}>
              <span className="flex-1 px-3 py-2 text-sm font-bold text-foreground flex items-center gap-1">
                Markup médio
                <TooltipProvider delayDuration={0}><UITooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help relative z-50" /></TooltipTrigger><TooltipContent side="top" className="max-w-sm z-[100]"><div className="text-xs space-y-0.5"><p className="font-semibold mb-1">Fórmula:</p><p>• |Receitas|</p><p>• ÷ (|Impostos| + |CMV/CSV|)</p></div></TooltipContent></UITooltip></TooltipProvider>
              </span>
              <span className="px-3 py-2 text-sm font-bold text-foreground w-24 text-right">{analiseGrupoRaiz.markup.toFixed(4)}</span>
            </div>
          </div>
        </div>

        {/* Distribuição de Despesas */}
        <div className="bg-card rounded-lg border border-border p-4 flex flex-col">
          <CardHeader title="Distribuição de Despesas" description="Proporção entre Despesas Fixas e Variáveis no total de despesas" />
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribuicaoCategorias}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={false}
                  >
                    {distribuicaoCategorias.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(180, 100%, 40%)' : 'hsl(0, 0%, 60%)'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda customizada */}
            <div className="flex flex-col gap-2 mt-3 w-full">
              {distribuicaoCategorias.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: index === 0 ? 'hsl(180, 100%, 40%)' : 'hsl(0, 0%, 60%)' }} />
                    <span className="text-xs text-foreground font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground">{item.pct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Linha 2: Evolução Mensal + Margem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4 lg:col-span-2">
          <CardHeader title="Evolução Mensal do Resultado" description={analysisDescriptions.evolucaoMensal} />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucaoMensal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="resultado" stroke="hsl(142, 71%, 45%)" fillOpacity={1} fill="url(#colorResultado)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <CardHeader title="Margem Líquida (%)" description={analysisDescriptions.margemLiquida} />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={margemMensal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="margem" stroke="hsl(280, 65%, 60%)" strokeWidth={2} dot={{ fill: 'hsl(280, 65%, 60%)', strokeWidth: 2, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Linha 3: Receitas vs Custos + Evolução Anual + Top Grupos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <CardHeader title="Receitas vs Custos vs Despesas" description={analysisDescriptions.receitasCustos} />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucaoMensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={9} />
                <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={9} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="custos" name="Custos" fill="hsl(221, 83%, 53%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 72%, 51%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {evolucaoAnual.length > 1 && (
          <div className="bg-card rounded-lg border border-border p-4">
            <CardHeader title="Evolução Anual" description={analysisDescriptions.evolucaoAnual} />
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolucaoAnual} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ano" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="resultado" name="Resultado" fill="hsl(221, 83%, 53%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={`bg-card rounded-lg border border-border p-4 ${evolucaoAnual.length <= 1 ? 'lg:col-span-2' : ''}`}>
          <CardHeader title="Top 10 Grupos" description={analysisDescriptions.topGrupos} />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topGrupos} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis type="category" dataKey="grupo" width={90} stroke="hsl(var(--muted-foreground))" fontSize={9} />
                <Tooltip formatter={(_value: number, _name: string, props: { payload?: { valor?: number } }) => [formatCurrency(props.payload?.valor ?? 0), 'Valor']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="absValor" radius={[0, 3, 3, 0]}>
                  {topGrupos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.valor)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {/* Dialog de gerenciamento de contas */}
      <DespesasVariaveisDialog
        open={showDespVarDialog}
        onOpenChange={setShowDespVarDialog}
        contasSelecionadas={contasDespVar}
        excludedContas={excludedContasDespVar}
        onContasChange={onContasDespVarChange}
        onExcludedContasChange={onExcludedContasDespVarChange}
        allRecords={maxLevelRecords}
      />
      <DespesasFixasDialog
        open={showDespFixasDialog}
        onOpenChange={setShowDespFixasDialog}
        contasSelecionadas={contasDespFixas}
        excludedContas={excludedContasDespFixas}
        onContasChange={onContasDespFixasChange}
        onExcludedContasChange={onExcludedContasDespFixasChange}
        allRecords={maxLevelRecords}
        contasDespVar={effectiveContasDespVar}
      />
    </div>
  );
}

function formatMesShort(anoMes: string): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [ano, mes] = anoMes.split('-');
  return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`;
}
