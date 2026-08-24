import { useMemo, useState, useCallback } from 'react';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { DreDashboardLegacy } from './DreDashboardLegacy';
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

export function DreDashboard(props: DreDashboardProps) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  // Estrutura customizada solicitada (ordem fixa + Resultado Líquido) é específica do cliente RPA.
  // Demais empresas continuam com o layout original.
  if (codEmpresaAtiva !== '1002') {
    return <DreDashboardLegacy {...props} />;
  }
  return <DreDashboardRPA {...props} />;
}

function DreDashboardRPA({
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

  // Análise por Grupo Raiz - estrutura fixa solicitada
  const analiseGrupoRaiz = useMemo(() => {
    const records = maxLevelRecords;

    let receitas = 0;
    let deducoes = 0; // Devoluções + Impostos
    let custoMercadorias = 0;
    let despesasComVendas = 0; // contas variáveis efetivas
    let despesasFixas = 0; // contas fixas efetivas
    let resultadoFinanceiro = 0;
    let outrasReceitas = 0; // Outras Receitas Operacionais + JCP
    let saidasCaixaFinanceiro = 0; // IRPJ/CSLL + Outras Despesas + Ajustes + restos

    records.forEach(r => {
      const g = r.grupo;
      const isContaDespVar = effectiveContasDespVar.has(r.codigo);
      const isContaDespFixa = effectiveContasDespFixas.has(r.codigo);
      const pertenceGrupoFixoGerenciado = isGrupoFixoDre(g);
      const pertenceGrupoVariavelGerenciado = isGrupoVariavelDre(g);

      if (isContaDespVar) {
        despesasComVendas += r.valor;
      } else if (isContaDespFixa) {
        despesasFixas += r.valor;
      } else if (g === 'Receitas') {
        receitas += r.valor;
      } else if (g === 'Devoluções' || g === 'Impostos') {
        deducoes += r.valor;
      } else if (g === 'Custos de Vendas de Mercadorias') {
        custoMercadorias += r.valor;
      } else if (pertenceGrupoFixoGerenciado || pertenceGrupoVariavelGerenciado) {
        // já é gerenciado via dialogs — ignora resto não classificado
        return;
      } else if (g === 'Receitas Financeiros' || g === 'Despesas Financeiros') {
        resultadoFinanceiro += r.valor;
      } else if (g === 'Outras Receitas Operacionais' || g === 'Juros Sobre Capital Próprio') {
        outrasReceitas += r.valor;
      } else {
        // Provisão IRPJ/CSLL, Outras Despesas, Ajustes de Exercícios, Sem Descrição
        saidasCaixaFinanceiro += r.valor;
      }
    });

    const margemContribuicao = receitas + deducoes + custoMercadorias + despesasComVendas;
    const lucroPrejuizo = margemContribuicao + despesasFixas + resultadoFinanceiro + outrasReceitas;
    const total = lucroPrejuizo + saidasCaixaFinanceiro;

    const baseAV = Math.abs(receitas) || 1;
    const pct = (v: number) => (v / baseAV) * 100;

    return {
      receitas: { valor: receitas, pct: 100 },
      deducoes: { valor: deducoes, pct: pct(deducoes) },
      custoMercadorias: { valor: custoMercadorias, pct: pct(custoMercadorias) },
      despesasComVendas: { valor: despesasComVendas, pct: pct(despesasComVendas) },
      margemContribuicao: { valor: margemContribuicao, pct: pct(margemContribuicao) },
      despesasFixas: { valor: despesasFixas, pct: pct(despesasFixas) },
      resultadoFinanceiro: { valor: resultadoFinanceiro, pct: pct(resultadoFinanceiro) },
      outrasReceitas: { valor: outrasReceitas, pct: pct(outrasReceitas) },
      lucroPrejuizo: { valor: lucroPrejuizo, pct: pct(lucroPrejuizo) },
      saidasCaixaFinanceiro: { valor: saidasCaixaFinanceiro, pct: pct(saidasCaixaFinanceiro) },
      total: { valor: total, pct: pct(total) },
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
    const fixas = Math.abs(analiseGrupoRaiz.despesasFixas.valor);
    const variaveis = Math.abs(analiseGrupoRaiz.despesasComVendas.valor);
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

  // KPIs rápidos derivados do analiseGrupoRaiz
  const a = analiseGrupoRaiz;
  const receitaBruta = a.receitas.valor;
  const deducoes = a.deducoes.valor; // negativo
  const receitaLiquida = receitaBruta + deducoes;
  const cmv = a.custoMercadorias.valor; // negativo
  const despVar = a.despesasComVendas.valor; // negativo
  const despFix = a.despesasFixas.valor; // negativo
  const margemContrib = a.margemContribuicao.valor;
  const resultadoLiq = a.lucroPrejuizo.valor;
  const totalDespesas = Math.abs(despVar) + Math.abs(despFix) + Math.abs(cmv);
  const margemContribPct = receitaLiquida !== 0 ? (margemContrib / receitaLiquida) * 100 : 0;
  const margemLiqPct = receitaLiquida !== 0 ? (resultadoLiq / receitaLiquida) * 100 : 0;
  const pontoEquilibrio = margemContribPct > 0 ? Math.abs(despFix) / (margemContribPct / 100) : 0;
  const receitaVsDespesa = totalDespesas !== 0 ? receitaLiquida / totalDespesas : 0;
  const coberturaPE = pontoEquilibrio > 0 ? (receitaLiquida / pontoEquilibrio) * 100 : 0;

  type Kpi = {
    label: string;
    value: string;
    hint?: string;
    accent: string;
    trend?: 'up' | 'down' | 'neutral';
  };
  const kpis: Kpi[] = [
    { label: 'Receita Bruta', value: formatCurrency(receitaBruta), hint: 'Faturamento total', accent: 'hsl(210, 70%, 50%)', trend: 'up' },
    { label: 'Receita Líquida', value: formatCurrency(receitaLiquida), hint: `Deduções ${formatCurrency(deducoes)}`, accent: 'hsl(190, 75%, 45%)', trend: 'up' },
    { label: 'CMV', value: formatCurrency(cmv), hint: 'Custo de mercadoria vendida', accent: 'hsl(30, 90%, 50%)', trend: 'down' },
    { label: 'Despesa Variável', value: formatCurrency(despVar), hint: 'Vinculada à venda', accent: 'hsl(20, 80%, 55%)', trend: 'down' },
    { label: 'Despesa Fixa', value: formatCurrency(despFix), hint: 'Estrutura mensal', accent: 'hsl(180, 75%, 40%)', trend: 'down' },
    { label: 'Margem de Contribuição', value: formatCurrency(margemContrib), hint: `${margemContribPct.toFixed(1)}% da Rec. Líquida`, accent: 'hsl(50, 85%, 50%)', trend: margemContrib >= 0 ? 'up' : 'down' },
    { label: 'Ponto de Equilíbrio', value: formatCurrency(pontoEquilibrio), hint: `Cobertura ${coberturaPE.toFixed(0)}%`, accent: 'hsl(260, 70%, 55%)', trend: coberturaPE >= 100 ? 'up' : 'down' },
    { label: 'Resultado Líquido', value: formatCurrency(resultadoLiq), hint: `Margem ${margemLiqPct.toFixed(1)}%`, accent: resultadoLiq >= 0 ? 'hsl(140, 80%, 35%)' : 'hsl(0, 75%, 50%)', trend: resultadoLiq >= 0 ? 'up' : 'down' },
  ];

  // Composição da receita líquida (barra horizontal segmentada)
  const composicao = [
    { label: 'CMV', value: Math.abs(cmv), color: 'hsl(30, 90%, 50%)' },
    { label: 'Desp. Variáveis', value: Math.abs(despVar), color: 'hsl(20, 80%, 55%)' },
    { label: 'Desp. Fixas', value: Math.abs(despFix), color: 'hsl(180, 75%, 40%)' },
    { label: 'Resultado', value: Math.max(resultadoLiq, 0), color: 'hsl(140, 80%, 35%)' },
  ];
  const composicaoTotal = composicao.reduce((s, i) => s + i.value, 0) || 1;

  return (
    <div className="space-y-4">
      {/* KPIs de leitura rápida */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="relative bg-card rounded-xl border border-border p-4 overflow-hidden group hover:shadow-md transition-all"
          >
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: k.accent }}
            />
            <div
              className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-[0.08] group-hover:opacity-[0.14] transition-opacity"
              style={{ backgroundColor: k.accent }}
            />
            <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground mb-1">
              {k.label}
            </p>
            <p className="text-lg lg:text-xl font-bold text-foreground tabular-nums leading-tight">
              {k.value}
            </p>
            {k.hint && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{k.hint}</p>
            )}
          </div>
        ))}
      </div>

      {/* Linha 1: Composição da Receita + Distribuição de Despesas + Indicadores rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Composição */}
        <div className="bg-card rounded-xl border border-border p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Composição da Receita Líquida</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Para onde vai cada real faturado</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowDespVarDialog(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted flex items-center gap-1" title="Gerenciar despesas variáveis">
                <Settings2 className="h-3 w-3" /> Variáveis
              </button>
              <button onClick={() => setShowDespFixasDialog(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted flex items-center gap-1" title="Gerenciar despesas fixas">
                <Settings2 className="h-3 w-3" /> Fixas
              </button>
            </div>
          </div>

          <div className="w-full h-6 rounded-full overflow-hidden flex bg-muted/50">
            {composicao.map((c) => {
              const w = (c.value / composicaoTotal) * 100;
              if (w <= 0) return null;
              return (
                <div
                  key={c.label}
                  style={{ width: `${w}%`, backgroundColor: c.color }}
                  className="h-full transition-all"
                  title={`${c.label}: ${formatCurrency(c.value)} (${w.toFixed(1)}%)`}
                />
              );
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {composicao.map((c) => {
              const w = (c.value / composicaoTotal) * 100;
              return (
                <div key={c.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{c.label}</p>
                    <p className="text-xs font-semibold text-foreground tabular-nums">
                      {formatCurrency(c.value)} <span className="text-muted-foreground font-normal">· {w.toFixed(1)}%</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Indicadores rápidos */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Receita ÷ Despesa</p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {receitaVsDespesa.toFixed(2)}x
              </p>
              <p className="text-[11px] text-muted-foreground">
                {receitaVsDespesa >= 1 ? 'Receita cobre despesas' : 'Receita insuficiente'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Margem Contribuição</p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {margemContribPct.toFixed(1)}%
              </p>
              <p className="text-[11px] text-muted-foreground">Sobra após var. + CMV</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cobertura do PE</p>
              <p className={`text-lg font-bold tabular-nums ${coberturaPE >= 100 ? 'text-[hsl(140,80%,35%)]' : 'text-[hsl(0,75%,50%)]'}`}>
                {coberturaPE.toFixed(0)}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {coberturaPE >= 100 ? 'Acima do equilíbrio' : 'Abaixo do equilíbrio'}
              </p>
            </div>
          </div>
        </div>

        {/* Distribuição de Despesas (Fixas x Variáveis) */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col">
          <CardHeader title="Fixas x Variáveis" description="Proporção entre Despesas Fixas e Variáveis no total de despesas" />
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
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(180, 100%, 40%)' : 'hsl(20, 80%, 55%)'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 mt-3 w-full">
              {distribuicaoCategorias.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: index === 0 ? 'hsl(180, 100%, 40%)' : 'hsl(20, 80%, 55%)' }} />
                    <span className="text-xs text-foreground font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{item.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Linha 2: Evolução Mensal + Margem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 lg:col-span-2">
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

        <div className="bg-card rounded-xl border border-border p-4">
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
        <div className="bg-card rounded-xl border border-border p-4">
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
          <div className="bg-card rounded-xl border border-border p-4">
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

        <div className={`bg-card rounded-xl border border-border p-4 ${evolucaoAnual.length <= 1 ? 'lg:col-span-2' : ''}`}>
          <CardHeader title="Top 10 Grupos" description={analysisDescriptions.topGrupos} />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topGrupos} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => formatCompactNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis type="category" dataKey="grupo" width={90} stroke="hsl(var(--muted-foreground))" fontSize={9} />
                <Tooltip formatter={(value: number, name: string, props: any) => [formatCurrency(props.payload.valor), 'Valor']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
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
