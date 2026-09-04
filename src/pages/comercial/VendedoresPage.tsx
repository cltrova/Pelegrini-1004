import { useState, useMemo, useCallback, useEffect } from 'react';
import { useComercialData } from '@/hooks/useComercialData';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  UserCheck, 
  Trophy,
  Medal,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Bot,
  Send,
  Download,
  RefreshCw,
  Sparkles,
  CircleDollarSign,
  Package,
  Percent,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  EnterpriseMetricCard,
  EnterprisePageHeader,
  EnterpriseSearchFilter,
  EnterpriseTable,
  EnterpriseTbody,
  EnterpriseTd,
  EnterpriseTh,
  EnterpriseThead,
  EnterpriseTr,
} from '@/components/enterprise';
import { getDefaultFiltersForEmpresa } from '@/components/comercial/ComercialFilters';
import { EnterpriseComercialFilters } from '@/components/comercial/EnterpriseComercialFilters';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';

// Metas simuladas por vendedor (em produção viriam do backend)
const METAS_VENDEDORES: Record<number, number> = {
  1: 5500000,
  2: 4500000,
  3: 4000000,
  4: 3200000,
  5: 3000000,
  6: 2900000,
  7: 2800000,
  8: 2200000,
  9: 2000000,
  10: 2300000,
  11: 2200000,
  12: 2000000,
};

const COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 65%, 60%)',
  'hsl(173, 80%, 40%)',
  'hsl(200, 80%, 50%)',
  'hsl(330, 70%, 50%)',
];

// Anos disponíveis para seleção
const ANOS_DISPONIVEIS = ['2023', '2024', '2025', '2026'];

export default function VendedoresPage() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<string | number | null>(null);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Olá! Sou sua assistente de análise comercial. Posso ajudar a analisar a performance dos vendedores, projeções de metas e insights. Como posso ajudar?' }
  ]);
  const [initialized, setInitialized] = useState(false);
  
  // Filtros - estado pendente e aplicado
  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType>(() => getDefaultFiltersForEmpresa(codEmpresaAtiva));
  const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType>(() => getDefaultFiltersForEmpresa(codEmpresaAtiva));
  
  const { 
    vendedoresPerformance, 
    evolucaoMensal,
    pedidos,
    kpis,
    clientesPerformance,
    periodoDisponivel,
    vendedoresDisponiveis,
    isLoading, 
    error 
  } = useComercialData(appliedFilters);

  // Inicializar filtros com o último período disponível nos dados
  useEffect(() => {
    if (!initialized && periodoDisponivel && !isLoading) {
      const filtrosInteligentes = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
      setPendingFilters(filtrosInteligentes);
      setAppliedFilters(filtrosInteligentes);
      setInitialized(true);
    }
  }, [periodoDisponivel, isLoading, initialized, codEmpresaAtiva]);

  // Verificar se há mudanças pendentes
  const hasChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters);

  // Aplicar filtros
  const handleBuscar = useCallback(() => {
    setAppliedFilters(pendingFilters);
  }, [pendingFilters]);

  // Limpar filtros
  const handleClearFilters = useCallback(() => {
    const defaults = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
    setPendingFilters(defaults);
    setAppliedFilters(defaults);
  }, [periodoDisponivel, codEmpresaAtiva]);

  const vendedoresFiltrados = vendedoresPerformance.filter(v =>
    v.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular KPIs específicos de vendedores
  const vendedoresKPIs = useMemo(() => {
    const totalMeta = Object.values(METAS_VENDEDORES).reduce((a, b) => a + b, 0);
    const totalFaturado = vendedoresPerformance.reduce((acc, v) => acc + v.faturamentoLiquido, 0);
    const totalVendas = vendedoresPerformance.reduce((acc, v) => acc + v.totalVendas, 0);
    const totalDevolucoes = vendedoresPerformance.reduce((acc, v) => acc + v.totalDevolucoes, 0);
    const clientesAtendidos = new Set(pedidos.map(p => p.cliente_codigo)).size;
    const clientesAtivos = clientesPerformance.filter(c => {
      if (!c.ultimaCompra) return false;
      const hoje = new Date();
      const limite = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
      return new Date(c.ultimaCompra) >= limite;
    }).length;
    
    return {
      totalMeta,
      totalFaturado,
      totalVendas,
      totalDevolucoes,
      percentualMeta: totalMeta > 0 ? (totalFaturado / totalMeta) * 100 : 0,
      faltaMeta: totalMeta - totalFaturado,
      clientesAtendidos,
      clientesAtivos,
      qtdVendedores: vendedoresPerformance.length,
      ticketMedio: kpis.ticketMedio,
    };
  }, [vendedoresPerformance, pedidos, clientesPerformance, kpis]);

  // Ranking detalhado com metas
  const rankingDetalhado = useMemo(() => {
    return vendedoresPerformance.map((v, index) => {
      const meta = METAS_VENDEDORES[v.codigo as number] || 2000000;
      const percentualAtingido = (v.faturamentoLiquido / meta) * 100;
      const faltaMeta = meta - v.faturamentoLiquido;
      const pendente = v.pedidosPendentes > 0 ? 
        pedidos.filter(p => p.vendedor_codigo === v.codigo && p.status === 'pendente')
          .reduce((acc, p) => acc + (p.valor_liquido || 0), 0) : 0;
      const percentualPendente = meta > 0 ? (pendente / meta) * 100 : 0;
      
      return {
        ...v,
        ranking: index + 1,
        meta,
        percentualAtingido,
        faltaMeta,
        pendente,
        percentualPendente,
      };
    });
  }, [vendedoresPerformance, pedidos]);

  // Projeções por cenário
  const projecoes = useMemo(() => {
    if (!evolucaoMensal.length) return [];
    
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const diasNoMes = new Date(hoje.getFullYear(), mesAtual + 1, 0).getDate();
    const diasPassados = hoje.getDate();
    const diasRestantes = diasNoMes - diasPassados;
    
    return rankingDetalhado.slice(0, 10).map(v => {
      // Faturamento do mês atual
      const mesAtualStr = `${hoje.getFullYear()}-${String(mesAtual + 1).padStart(2, '0')}`;
      const faturamentoMesAtual = pedidos
        .filter(p => p.vendedor_codigo === v.codigo && p.data_pedido.startsWith(mesAtualStr))
        .reduce((acc, p) => acc + (p.valor_liquido || 0), 0);
      
      // Média diária atual
      const mediaDiariaAtual = diasPassados > 0 ? faturamentoMesAtual / diasPassados : 0;
      
      // Projeção ritmo atual
      const projecaoRitmoAtual = faturamentoMesAtual + (mediaDiariaAtual * diasRestantes);
      
      // Mês anterior
      const mesAnteriorStr = `${hoje.getFullYear()}-${String(mesAtual).padStart(2, '0')}`;
      const faturamentoMesAnterior = pedidos
        .filter(p => p.vendedor_codigo === v.codigo && p.data_pedido.startsWith(mesAnteriorStr))
        .reduce((acc, p) => acc + (p.valor_liquido || 0), 0);
      
      // Mesmo mês ano anterior
      const mesmoMesAnoAnterior = `${hoje.getFullYear() - 1}-${String(mesAtual + 1).padStart(2, '0')}`;
      const faturamentoAnoAnterior = pedidos
        .filter(p => p.vendedor_codigo === v.codigo && p.data_pedido.startsWith(mesmoMesAnoAnterior))
        .reduce((acc, p) => acc + (p.valor_liquido || 0), 0);
      
      // Meta mensal (dividida por 12)
      const metaMensal = v.meta / 12;
      
      return {
        vendedor: v.nome,
        codigo: v.codigo,
        faturamentoMesAtual,
        metaMensal,
        projecaoRitmoAtual,
        faturamentoMesAnterior,
        faturamentoAnoAnterior,
        bateMeta: projecaoRitmoAtual >= metaMensal,
        variacaoMesAnterior: faturamentoMesAnterior > 0 
          ? ((faturamentoMesAtual - faturamentoMesAnterior) / faturamentoMesAnterior) * 100 
          : 0,
        variacaoAnoAnterior: faturamentoAnoAnterior > 0
          ? ((faturamentoMesAtual - faturamentoAnoAnterior) / faturamentoAnoAnterior) * 100
          : 0,
        gapMeta: metaMensal - faturamentoMesAtual,
      };
    });
  }, [rankingDetalhado, pedidos, evolucaoMensal]);

  // Radar de faturamento vs meta (todos vendedores)
  const radarFaturamentoMeta = useMemo(() => {
    return rankingDetalhado.slice(0, 8).map(v => ({
      vendedor: v.nome.split(' ')[0],
      faturamento: (v.faturamentoLiquido / Math.max(...rankingDetalhado.map(x => x.faturamentoLiquido))) * 100,
      meta: (v.percentualAtingido),
    }));
  }, [rankingDetalhado]);

  // Distribuição por participação
  const distribuicaoParticipacao = useMemo(() => {
    return vendedoresPerformance.slice(0, 8).map((v, i) => ({
      name: v.nome.split(' ')[0],
      value: v.participacao,
      fill: COLORS[i % COLORS.length],
    }));
  }, [vendedoresPerformance]);

  // Evolução do vendedor selecionado
  const evolucaoVendedor = selectedVendedor ? (() => {
    const mesMap = new Map<string, { mes: string; vendas: number; meta: number }>();
    const metaMensal = (METAS_VENDEDORES[selectedVendedor as number] || 2000000) / 12;
    
    pedidos.filter(p => p.vendedor_codigo === selectedVendedor).forEach(p => {
      const mes = p.data_pedido.substring(0, 7);
      const existing = mesMap.get(mes) || { mes, vendas: 0, meta: metaMensal };
      existing.vendas += p.valor_liquido || 0;
      mesMap.set(mes, existing);
    });
    
    return Array.from(mesMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  })() : [];

  const vendedorSelecionadoData = selectedVendedor 
    ? rankingDetalhado.find(v => v.codigo === selectedVendedor)
    : null;

  const radarData = vendedorSelecionadoData ? [
    { 
      subject: 'Faturamento', 
      A: (vendedorSelecionadoData.faturamentoLiquido / Math.max(...vendedoresPerformance.map(v => v.faturamentoLiquido))) * 100,
      fullMark: 100 
    },
    { 
      subject: 'Meta', 
      A: vendedorSelecionadoData.percentualAtingido,
      fullMark: 100 
    },
    { 
      subject: 'Ticket Médio', 
      A: (vendedorSelecionadoData.ticketMedio / Math.max(...vendedoresPerformance.map(v => v.ticketMedio))) * 100,
      fullMark: 100 
    },
    { 
      subject: 'Participação', 
      A: vendedorSelecionadoData.participacao * 2,
      fullMark: 100 
    },
    { 
      subject: 'Eficiência', 
      A: vendedorSelecionadoData.totalVendas > 0 
        ? ((vendedorSelecionadoData.totalVendas - vendedorSelecionadoData.totalDevolucoes) / vendedorSelecionadoData.totalVendas) * 100
        : 0,
      fullMark: 100 
    },
  ] : [];

  const formatMes = (mes: string) => {
    const [year, month] = mes.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
  };

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    
    setChatHistory(prev => [...prev, { role: 'user', content: chatMessage }]);
    
    // Simular resposta da IA
    setTimeout(() => {
      let response = '';
      const msg = chatMessage.toLowerCase();
      
      if (msg.includes('meta') || msg.includes('bater')) {
        const topVendedor = rankingDetalhado[0];
        response = `Analisando as metas:\n\n📊 **${topVendedor.nome}** está liderando com ${formatPercent(topVendedor.percentualAtingido)} da meta atingida.\n\n${topVendedor.percentualAtingido >= 100 ? '✅ Já bateu a meta!' : `⚠️ Falta ${formatCurrency(topVendedor.faltaMeta)} para bater.`}\n\nBaseado no ritmo atual, ${projecoes.filter(p => p.bateMeta).length} de ${projecoes.length} vendedores devem bater a meta este mês.`;
      } else if (msg.includes('melhor') || msg.includes('top') || msg.includes('ranking')) {
        response = `🏆 **Top 3 Vendedores:**\n\n1. ${rankingDetalhado[0].nome} - ${formatCurrency(rankingDetalhado[0].faturamentoLiquido)}\n2. ${rankingDetalhado[1].nome} - ${formatCurrency(rankingDetalhado[1].faturamentoLiquido)}\n3. ${rankingDetalhado[2].nome} - ${formatCurrency(rankingDetalhado[2].faturamentoLiquido)}\n\nJuntos representam ${formatPercent(rankingDetalhado.slice(0,3).reduce((a,v) => a + v.participacao, 0))} do faturamento total.`;
      } else if (msg.includes('devolução') || msg.includes('devoluções')) {
        const maiorDevolucao = [...vendedoresPerformance].sort((a, b) => b.totalDevolucoes - a.totalDevolucoes)[0];
        response = `📉 **Análise de Devoluções:**\n\n⚠️ ${maiorDevolucao.nome} tem o maior volume de devoluções: ${formatCurrency(maiorDevolucao.totalDevolucoes)}\n\nTotal geral de devoluções: ${formatCurrency(vendedoresKPIs.totalDevolucoes)}\n\nTaxa média: ${formatPercent((vendedoresKPIs.totalDevolucoes / vendedoresKPIs.totalVendas) * 100)}`;
      } else {
        response = `Entendi sua pergunta sobre "${chatMessage}".\n\n📊 Posso ajudar com:\n- Análise de metas e projeções\n- Ranking de vendedores\n- Devoluções e performance\n- Comparativos entre períodos\n\nPor favor, seja mais específico para uma análise detalhada.`;
      }
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
    }, 1000);
    
    setChatMessage('');
  };

  if (isLoading) return <LoadingState message="Carregando vendedores..." />;
  if (error) return <ErrorState message="Erro ao carregar vendedores" />;

  return (
    <div className="enterprise-page">
      <EnterprisePageHeader
        title="Painel de Vendedores"
        subtitle="Performance, metas, ranking e inteligência comercial"
        metadata={`${vendedoresFiltrados.length.toLocaleString('pt-BR')} vendedores visíveis`}
        actions={
          <div className="flex min-w-0 items-end gap-2">
            <EnterpriseSearchFilter
              label="Busca"
              onChange={setSearchTerm}
              placeholder="Buscar vendedor..."
              value={searchTerm}
            />
          </div>
        }
      />

      <EnterpriseComercialFilters
        pendingFilters={pendingFilters}
        appliedFilters={appliedFilters}
        onPendingFiltersChange={setPendingFilters}
        onApply={handleBuscar}
        onClear={handleClearFilters}
        hasChanges={hasChanges}
        anos={ANOS_DISPONIVEIS}
        vendedores={vendedoresDisponiveis}
        resultCount={vendedoresPerformance.length}
        showVendedorFilter
        useNativeControls
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <TabsList className="grid w-full shrink-0 grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="ia">Assistente IA</TabsTrigger>
        </TabsList>

        {/* TAB: Visão Geral */}
        <TabsContent value="visao-geral" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
          {/* KPIs Principais */}
          <div className="enterprise-grid-metrics">
            <EnterpriseMetricCard label="Meta total" value={formatCurrency(vendedoresKPIs.totalMeta, true)} context="Meta acumulada dos vendedores" target={`${formatPercent(vendedoresKPIs.percentualMeta)} atingido`} icon={<Target className="h-4 w-4" />} tone="info" />
            <EnterpriseMetricCard label="Faturado" value={formatCurrency(vendedoresKPIs.totalFaturado, true)} context="Faturamento líquido no período" target={`${formatCurrency(vendedoresKPIs.faltaMeta, true)} para a meta`} icon={<DollarSign className="h-4 w-4" />} tone="positive" />
            <EnterpriseMetricCard label="Devoluções" value={formatCurrency(vendedoresKPIs.totalDevolucoes, true)} context="Valor devolvido no período" icon={<TrendingDown className="h-4 w-4" />} tone="negative" />
            <EnterpriseMetricCard label="Clientes atendidos" value={formatNumber(vendedoresKPIs.clientesAtendidos)} context={`${formatNumber(vendedoresKPIs.clientesAtivos)} ativos nos últimos 3 meses`} icon={<Users className="h-4 w-4" />} tone="neutral" />
            <EnterpriseMetricCard label="Clientes ativos" value={formatNumber(vendedoresKPIs.clientesAtivos)} context="Carteira com compra recente" icon={<Sparkles className="h-4 w-4" />} tone="info" />
            <EnterpriseMetricCard label="Vendedores" value={formatNumber(vendedoresKPIs.qtdVendedores)} context="Vendedores no período" icon={<UserCheck className="h-4 w-4" />} tone="neutral" />
          </div>

          {/* Barra de Progresso da Meta */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Atingimento da Meta Global</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(vendedoresKPIs.totalFaturado)} de {formatCurrency(vendedoresKPIs.totalMeta)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-primary">{formatPercent(vendedoresKPIs.percentualMeta)}</span>
                  <p className="text-sm text-muted-foreground">
                    Falta: {formatCurrency(vendedoresKPIs.faltaMeta)}
                  </p>
                </div>
              </div>
              <Progress value={Math.min(vendedoresKPIs.percentualMeta, 100)} className="h-4" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>

          {/* Top 3 Pódio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rankingDetalhado.slice(0, 3).map((v, i) => (
              <Card 
                key={v.codigo}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/30',
                  i === 0 && 'md:order-2 ring-2 ring-yellow-500/50 bg-muted/20',
                  i === 1 && 'md:order-1 ring-1 ring-gray-400/30',
                  i === 2 && 'md:order-3 ring-1 ring-orange-400/30',
                  selectedVendedor === v.codigo && 'ring-2 ring-primary'
                )}
                onClick={() => setSelectedVendedor(v.codigo === selectedVendedor ? null : v.codigo)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    'h-12 w-12 rounded-full flex items-center justify-center',
                      i === 0 && 'bg-yellow-500',
                      i === 1 && 'bg-slate-400',
                      i === 2 && 'bg-orange-500'
                    )}>
                      {i === 0 ? (
                        <Trophy className="h-6 w-6 text-white" />
                      ) : (
                        <Medal className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <Badge variant={i === 0 ? 'default' : 'secondary'}>
                      #{i + 1}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{v.nome}</h3>
                  <p className="text-2xl font-bold mono-value text-primary mb-3">
                    {formatCurrency(v.faturamentoLiquido)}
                  </p>
                  
                  {/* Mini Progress de Meta */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Meta</span>
                      <span className={cn(
                        'font-medium',
                        v.percentualAtingido >= 100 ? 'text-success' : 'text-warning'
                      )}>
                        {formatPercent(v.percentualAtingido)}
                      </span>
                    </div>
                    <Progress value={Math.min(v.percentualAtingido, 100)} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Vendas</p>
                      <p className="font-medium text-success">{formatCurrency(v.totalVendas, true)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Devoluções</p>
                      <p className="font-medium text-destructive">
                        {v.totalDevolucoes > 0 ? formatCurrency(v.totalDevolucoes, true) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Falta Meta</p>
                      <p className="font-medium">{v.faltaMeta > 0 ? formatCurrency(v.faltaMeta, true) : '✓ Bateu!'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Part.</p>
                      <p className="font-medium">{formatPercent(v.participacao)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detalhes do vendedor selecionado */}
          {vendedorSelecionadoData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Radar de Performance - {vendedorSelecionadoData.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid className="stroke-border" />
                        <PolarAngleAxis 
                          dataKey="subject" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name={vendedorSelecionadoData.nome}
                          dataKey="A"
                          stroke="hsl(217, 91%, 60%)"
                          fill="hsl(217, 91%, 60%)"
                          fillOpacity={0.3}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Evolução vs Meta - {vendedorSelecionadoData.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={evolucaoVendedor}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis 
                          dataKey="mes" 
                          tickFormatter={formatMes}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          tickFormatter={(v) => formatCurrency(v, true)}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={formatMes}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="vendas" name="Vendas" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                        <Line
                          type="monotone"
                          dataKey="meta"
                          name="Meta"
                          stroke="hsl(0, 72%, 51%)"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Comparativo de vendedores */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento vs Meta - Top 10</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingDetalhado.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(v) => formatCurrency(v, true)}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="nome" 
                      width={120}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="faturamentoLiquido" name="Faturado" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Ranking */}
        <TabsContent value="ranking" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking Detalhado de Vendedores
              </CardTitle>
              <CardDescription>
                Análise completa com metas, atingimento e projeções
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnterpriseTable>
                <EnterpriseThead>
                  <EnterpriseTr>
                    <EnterpriseTh>#</EnterpriseTh>
                    <EnterpriseTh>Vendedor</EnterpriseTh>
                    <EnterpriseTh numeric>Faturamento</EnterpriseTh>
                    <EnterpriseTh numeric>% Atingido</EnterpriseTh>
                    <EnterpriseTh numeric>Pendente</EnterpriseTh>
                    <EnterpriseTh numeric>% Pendente</EnterpriseTh>
                    <EnterpriseTh numeric>Meta</EnterpriseTh>
                    <EnterpriseTh numeric>Falta</EnterpriseTh>
                    <EnterpriseTh numeric>Devoluções</EnterpriseTh>
                    <EnterpriseTh numeric>Líquido</EnterpriseTh>
                    <EnterpriseTh numeric>Part. %</EnterpriseTh>
                  </EnterpriseTr>
                </EnterpriseThead>
                <EnterpriseTbody>
                    {vendedoresFiltrados.map((v, i) => {
                      const detalhado = rankingDetalhado.find(r => r.codigo === v.codigo);
                      if (!detalhado) return null;
                      
                      return (
                        <EnterpriseTr
                          key={v.codigo} 
                          className={cn(
                            'cursor-pointer',
                            selectedVendedor === v.codigo && 'bg-primary/5'
                          )}
                          onClick={() => setSelectedVendedor(v.codigo === selectedVendedor ? null : v.codigo)}
                        >
                          <EnterpriseTd>
                            {i < 3 ? (
                              <Badge variant={i === 0 ? 'default' : 'secondary'} className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                {i + 1}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{i + 1}</span>
                            )}
                          </EnterpriseTd>
                          <EnterpriseTd className="font-medium">{v.nome}</EnterpriseTd>
                          <EnterpriseTd numeric className="mono-value text-success">
                            {formatCurrency(v.faturamentoLiquido)}
                          </EnterpriseTd>
                          <EnterpriseTd numeric>
                            <span className={cn(
                              'inline-flex items-center gap-1 font-medium',
                              detalhado.percentualAtingido >= 100 ? 'text-success' : 
                              detalhado.percentualAtingido >= 70 ? 'text-warning' : 'text-destructive'
                            )}>
                              {detalhado.percentualAtingido >= 100 && <CheckCircle className="h-3 w-3" />}
                              {formatPercent(detalhado.percentualAtingido)}
                            </span>
                          </EnterpriseTd>
                          <EnterpriseTd numeric className="mono-value text-warning">
                            {detalhado.pendente > 0 ? formatCurrency(detalhado.pendente) : '-'}
                          </EnterpriseTd>
                          <EnterpriseTd numeric className="mono-value text-muted-foreground">
                            {formatPercent(detalhado.percentualPendente)}
                          </EnterpriseTd>
                          <EnterpriseTd numeric className="mono-value">
                            {formatCurrency(detalhado.meta)}
                          </EnterpriseTd>
                          <EnterpriseTd numeric className="mono-value">
                            {detalhado.faltaMeta > 0 ? (
                              <span className="text-destructive">{formatCurrency(detalhado.faltaMeta)}</span>
                            ) : (
                              <span className="text-success">✓</span>
                            )}
                          </EnterpriseTd>
                          <EnterpriseTd numeric className="mono-value text-destructive">
                            {v.totalDevolucoes > 0 ? formatCurrency(v.totalDevolucoes) : '-'}
                          </EnterpriseTd>
                          <EnterpriseTd numeric className="mono-value font-medium">
                            {formatCurrency(v.faturamentoLiquido - v.totalDevolucoes)}
                          </EnterpriseTd>
                          <EnterpriseTd numeric>
                            {formatPercent(v.participacao)}
                          </EnterpriseTd>
                        </EnterpriseTr>
                      );
                    })}
                </EnterpriseTbody>
              </EnterpriseTable>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Comparativo */}
        <TabsContent value="comparativo" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
          {/* Projeções por Cenário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-warning" />
                Projeções por Cenário
              </CardTitle>
              <CardDescription>
                Análise preditiva: ritmo atual, comparativo mês e ano anterior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnterpriseTable>
                <EnterpriseThead>
                  <EnterpriseTr>
                    <EnterpriseTh>Vendedor</EnterpriseTh>
                    <EnterpriseTh numeric>Atual (mês)</EnterpriseTh>
                    <EnterpriseTh numeric>Meta Mensal</EnterpriseTh>
                    <EnterpriseTh numeric>Projeção (ritmo)</EnterpriseTh>
                    <EnterpriseTh className="text-center">Bate Meta?</EnterpriseTh>
                    <EnterpriseTh numeric>Mês Anterior</EnterpriseTh>
                    <EnterpriseTh numeric>Var. %</EnterpriseTh>
                    <EnterpriseTh numeric>Mesmo Mês (ano ant.)</EnterpriseTh>
                    <EnterpriseTh numeric>Var. %</EnterpriseTh>
                    <EnterpriseTh numeric>Gap Meta</EnterpriseTh>
                  </EnterpriseTr>
                </EnterpriseThead>
                <EnterpriseTbody>
                    {projecoes.map((p, i) => (
                      <EnterpriseTr key={p.codigo}>
                        <EnterpriseTd className="font-medium">{p.vendedor}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(p.faturamentoMesAtual)}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value text-muted-foreground">{formatCurrency(p.metaMensal)}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value font-medium">{formatCurrency(p.projecaoRitmoAtual)}</EnterpriseTd>
                        <EnterpriseTd className="text-center">
                          {p.bateMeta ? (
                            <Badge variant="default" className="bg-success text-white">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Sim
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Não
                            </Badge>
                          )}
                        </EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(p.faturamentoMesAnterior)}</EnterpriseTd>
                        <EnterpriseTd numeric>
                          <span className={cn(
                            'inline-flex items-center gap-1',
                            p.variacaoMesAnterior >= 0 ? 'text-success' : 'text-destructive'
                          )}>
                            {p.variacaoMesAnterior >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {formatPercent(Math.abs(p.variacaoMesAnterior))}
                          </span>
                        </EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(p.faturamentoAnoAnterior)}</EnterpriseTd>
                        <EnterpriseTd numeric>
                          <span className={cn(
                            'inline-flex items-center gap-1',
                            p.variacaoAnoAnterior >= 0 ? 'text-success' : 'text-destructive'
                          )}>
                            {p.variacaoAnoAnterior >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {formatPercent(Math.abs(p.variacaoAnoAnterior))}
                          </span>
                        </EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">
                          {p.gapMeta > 0 ? (
                            <span className="text-destructive">{formatCurrency(p.gapMeta)}</span>
                          ) : (
                            <span className="text-success">+{formatCurrency(Math.abs(p.gapMeta))}</span>
                          )}
                        </EnterpriseTd>
                      </EnterpriseTr>
                    ))}
                </EnterpriseTbody>
              </EnterpriseTable>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Faturamento vs Meta */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Radar: Faturamento vs Meta (Top 8)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarFaturamentoMeta}>
                      <PolarGrid className="stroke-border" />
                      <PolarAngleAxis 
                        dataKey="vendedor" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name="Faturamento (norm.)"
                        dataKey="faturamento"
                        stroke="hsl(217, 91%, 60%)"
                        fill="hsl(217, 91%, 60%)"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="% Meta"
                        dataKey="meta"
                        stroke="hsl(142, 71%, 45%)"
                        fill="hsl(142, 71%, 45%)"
                        fillOpacity={0.3}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Distribuição por participação */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Distribuição de Participação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribuicaoParticipacao}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                        labelLine={false}
                      >
                        {distribuicaoParticipacao.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Variação por Período */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Variação: Mês Anterior vs Ano Anterior
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projecoes}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis 
                      dataKey="vendedor" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="variacaoMesAnterior" name="vs Mês Anterior" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="variacaoAnoAnterior" name="vs Ano Anterior" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Análise Detalhada para Export */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Análise Detalhada para Exportação
                </CardTitle>
                <CardDescription>Dados completos para análise em Excel</CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent>
              <EnterpriseTable>
                <EnterpriseThead>
                  <EnterpriseTr>
                    <EnterpriseTh>#</EnterpriseTh>
                    <EnterpriseTh>Vendedor</EnterpriseTh>
                    <EnterpriseTh numeric>Vendas</EnterpriseTh>
                    <EnterpriseTh numeric>Devol.</EnterpriseTh>
                    <EnterpriseTh numeric>Líquido</EnterpriseTh>
                    <EnterpriseTh numeric>Meta</EnterpriseTh>
                    <EnterpriseTh numeric>%</EnterpriseTh>
                    <EnterpriseTh numeric>Gap</EnterpriseTh>
                    <EnterpriseTh numeric>Pendente</EnterpriseTh>
                    <EnterpriseTh numeric>Fat.</EnterpriseTh>
                    <EnterpriseTh numeric>Pend.</EnterpriseTh>
                    <EnterpriseTh numeric>Ticket</EnterpriseTh>
                    <EnterpriseTh numeric>Part. %</EnterpriseTh>
                  </EnterpriseTr>
                </EnterpriseThead>
                <EnterpriseTbody>
                    {rankingDetalhado.map((v, i) => (
                      <EnterpriseTr key={v.codigo}>
                        <EnterpriseTd>{i + 1}</EnterpriseTd>
                        <EnterpriseTd className="font-medium">{v.nome}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(v.totalVendas, true)}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value text-destructive">{formatCurrency(v.totalDevolucoes, true)}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value font-medium">{formatCurrency(v.faturamentoLiquido, true)}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(v.meta, true)}</EnterpriseTd>
                        <EnterpriseTd numeric>{formatPercent(v.percentualAtingido)}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(v.faltaMeta, true)}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(v.pendente, true)}</EnterpriseTd>
                        <EnterpriseTd numeric>{v.pedidosFaturados}</EnterpriseTd>
                        <EnterpriseTd numeric>{v.pedidosPendentes}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{formatCurrency(v.ticketMedio, true)}</EnterpriseTd>
                        <EnterpriseTd numeric>{formatPercent(v.participacao)}</EnterpriseTd>
                      </EnterpriseTr>
                    ))}
                </EnterpriseTbody>
              </EnterpriseTable>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Assistente IA */}
        <TabsContent value="ia" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="h-[min(400px,calc(100dvh-18rem))] flex flex-col">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Assistente de Análise Comercial
                  </CardTitle>
                  <CardDescription>
                    Converse com a IA para insights sobre vendedores e metas
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg p-3',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {msg.role === 'assistant' && (
                            <Bot className="h-5 w-5 mt-0.5 shrink-0" />
                          )}
                          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Pergunte sobre vendedores, metas, projeções..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    />
                    <Button onClick={handleSendChat}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-warning" />
                    Sugestões de Perguntas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    'Quem vai bater a meta esse mês?',
                    'Qual vendedor tem mais devoluções?',
                    'Me dê o ranking dos top 5',
                    'Como está a variação vs ano anterior?',
                    'Qual o gap total para a meta?',
                  ].map((sugestao, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-2 text-sm"
                      onClick={() => {
                        setChatMessage(sugestao);
                        setTimeout(handleSendChat, 100);
                      }}
                    >
                      <ArrowRight className="h-3 w-3 mr-2 shrink-0" />
                      {sugestao}
                    </Button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Insights Automáticos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                    <span>{projecoes.filter(p => p.bateMeta).length} vendedores devem bater a meta</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                    <span>Gap total: {formatCurrency(vendedoresKPIs.faltaMeta)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
                    <span>Top 3 = {formatPercent(rankingDetalhado.slice(0,3).reduce((a,v) => a + v.participacao, 0))} do total</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
