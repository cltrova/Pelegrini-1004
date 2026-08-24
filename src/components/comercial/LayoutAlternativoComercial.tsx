import { useMemo, useState, useCallback, useEffect } from 'react';
import { useComercialData } from '@/hooks/useComercialData';
import { useComercialTotais, useComercialTotaisIdeal } from '@/hooks/useComercialTotais';
import {
  useAgrupadoPeriodo,
  useAgrupadoDiaSemana,
  useAgrupadoVendedor,
  useAgrupadoCliente,
  useAgrupadoFilial,
  useAgrupadoEstado,
} from '@/hooks/useComercialAgrupado';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { ErrorState } from '@/components/common/ErrorState';
import { getVendedorAvatar } from '@/config/vendedorAvatars';
import { EvolucaoTab } from './EvolucaoTab';
import { FaturamentoPorFilialPremium } from './FaturamentoPorFilialPremium';
import { PremiumChartTooltip } from './PremiumChartTooltip';
import { MetasTabContent } from './MetasTabContent';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { isContextoChevrolet10041 } from '@/utils/vendedores1004';

import { 
  TrendingUp, TrendingDown, DollarSign,
 Users, FileText, Trophy, ShoppingCart,
 ChevronDown, Crown, Medal, Award, User,
 BarChart3, Percent, AlertTriangle, Target,
 Activity, ChevronRight, Sparkles, Store, ArrowUpRight, RotateCcw, Package, Clock
} from 'lucide-react';
 import { type ComercialFilters as ComercialFiltersType } from '@/types/comercial';
 import { formatCurrency, formatPercent, formatCompactNumber, formatInteger } from '@/utils/formatters';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Sector, ReferenceLine, LabelList
 } from 'recharts';
import { getDiasUteisNoMes } from '@/types/comercial';
 import { cn } from '@/lib/utils';
 import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
  import { 
    ComercialFilters, 
    getDefaultFiltersForEmpresa, 
    getComercialFiltersSummary, 
    countActiveFilters 
  } from '@/components/comercial/ComercialFilters';
 import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
  import { DevolucoesDetalheDialog } from './DevolucoesDetalheDialog';
  import { ValorTotalDetalheDialog } from './ValorTotalDetalheDialog';
 
 const ANOS_DISPONIVEIS = ['2023', '2024', '2025', '2026'];

type TendenciaView = 'diario' | 'mensal';
 
 const CHART_COLORS = [
   'hsl(var(--primary))',
   'hsl(var(--chart-2))',
   'hsl(var(--chart-3))',
   'hsl(var(--chart-4))',
   'hsl(var(--chart-5))',
   'hsl(var(--destructive))',
 ];
 
 /**
  * Layout alternativo para empresas SEM METAS de vendedor.
  * Estrutura: Visão Geral | Ranking Vendedores | Evolução
  */
 export function LayoutAlternativoComercial() {
   const [initialized, setInitialized] = useState(false);
   const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType | undefined>(undefined);
   const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType | undefined>(undefined);
   const [filtersOpen, setFiltersOpen] = useState(false);
    const [expandedVendedor, setExpandedVendedor] = useState<string | number | null>(null);
    const [selectedVendedorTop, setSelectedVendedorTop] = useState<string | number | null>(null);
    const [hoveredEvolucao, setHoveredEvolucao] = useState<any | null>(null);
   const [evolucaoSeries, setEvolucaoSeries] = useState<{ vendas: boolean; devolucoes: boolean }>({ vendas: true, devolucoes: true });
   const [evolucaoGranularidade, setEvolucaoGranularidade] = useState<'diaria' | 'mensal' | 'anual'>('diaria');
   const [selectedClienteIdx, setSelectedClienteIdx] = useState<number | null>(null);
   const [hoveredPizzaIdx, setHoveredPizzaIdx] = useState<number | null>(null);
   const [tendenciaView, setTendenciaView] = useState<TendenciaView>('diario');
   const [devolucoesDialogOpen, setDevolucoesDialogOpen] = useState(false);
   const [valorTotalDialogOpen, setValorTotalDialogOpen] = useState(false);
   
   const { codEmpresaAtiva, empresa } = useEmpresaAtiva();
   const { filialAtiva, filialNome } = useFilialSelecionada();
   const isEmpresa1003 = String(codEmpresaAtiva ?? '').trim() === '1003';
   const empresaComFilial = useMemo(() => {
     if (!filialNome) return empresa;
     return { ...empresa, nome: `${empresa?.nome ?? ''} ${filialNome}` };
   }, [empresa, filialNome]);
   const isEmpresa10041 = isContextoChevrolet10041(codEmpresaAtiva, filialAtiva, empresaComFilial);

   const { 
     vendedoresPerformance, 
     clientesPerformance,
     pedidos, 
     devolucoes, 
     evolucaoDiaria,
     periodoDisponivel, 
     vendedoresDisponiveis,
     isLoading: isLoadingBase, 
     error 
   } = useComercialData(appliedFilters, { enabled: !isEmpresa1003 });

   // Normaliza o cliente selecionado (aceita string, número ou objeto). Em "Todos" fica undefined.
   const clienteSelRaw: any = (appliedFilters as any)?.cliente ?? (appliedFilters as any)?.codCliente;
   const codClienteAtivoRaw =
     clienteSelRaw == null
       ? undefined
       : typeof clienteSelRaw === 'string' || typeof clienteSelRaw === 'number'
         ? clienteSelRaw
         : (clienteSelRaw?.cod_cliente ?? clienteSelRaw?.codigo ?? clienteSelRaw?.value);
   const codClienteAtivo =
     codClienteAtivoRaw != null && String(codClienteAtivoRaw).trim() !== ''
       ? String(codClienteAtivoRaw).trim()
       : undefined;

   // Totalizadores consolidados via novo endpoint /comercial/totais (usados nos cards da Visão Geral)
   const { kpis: kpisTotalizador, totais: totalizadorRaw } = useComercialTotais(
     appliedFilters?.periodo,
     isEmpresa1003 ? codClienteAtivo : undefined,
   );
   // Ideal (1003): endpoints /total dedicados — valores prontos, sem reduce/soma local
   const {
     pedidos: totIdealPedidos,
     devolucoes: totIdealDevolucoes,
     produtos: totIdealProdutos,
     isLoading: isLoadingTotIdeal,
   } = useComercialTotaisIdeal(
      (isEmpresa1003 || isEmpresa10041) ? appliedFilters?.periodo : undefined,
      isEmpresa1003 ? codClienteAtivo : undefined,
      {
        enabled: isEmpresa1003 || isEmpresa10041,
        keepPreviousData: false,
      },
    );

   // Ideal (1003): endpoints /comercial/agrupado — substituem toda derivação local
   const periodicidadeEvolucao =
     evolucaoGranularidade === 'anual' ? 'anual'
       : evolucaoGranularidade === 'mensal' ? 'mensal'
       : 'diario';
   const { data: agrPeriodo, isLoading: isLoadingAgrPeriodo } = useAgrupadoPeriodo(
     appliedFilters?.periodo,
     periodicidadeEvolucao as any,
     { codCliente: codClienteAtivo, enabled: isEmpresa1003 },
   );
   const { data: agrDiaSemana } = useAgrupadoDiaSemana(
     appliedFilters?.periodo, { codCliente: codClienteAtivo, enabled: isEmpresa1003 });
   const { data: agrVendedor, isLoading: isLoadingAgrVend } = useAgrupadoVendedor(
     appliedFilters?.periodo, { codCliente: codClienteAtivo, enabled: isEmpresa1003 });
   const { data: agrCliente, isLoading: isLoadingAgrCli } = useAgrupadoCliente(
     appliedFilters?.periodo, { codCliente: codClienteAtivo, enabled: isEmpresa1003 });
   const { data: agrFilial } = useAgrupadoFilial(
     appliedFilters?.periodo, { codCliente: codClienteAtivo, enabled: isEmpresa1003 });
   const { data: agrEstado } = useAgrupadoEstado(
     appliedFilters?.periodo, { codCliente: codClienteAtivo, enabled: isEmpresa1003 });



   const isLoading = isEmpresa1003
     ? (isLoadingTotIdeal || isLoadingAgrPeriodo || isLoadingAgrVend || isLoadingAgrCli)
     : isLoadingBase;





   const clientesDisponiveis = useMemo(() => {
     const fonte = isEmpresa1003
       ? (agrCliente || []).map((c: any) => ({
           codigo: c.cod_cliente,
           nome: c.nome_fantasia || c.cliente || String(c.cod_cliente),
         }))
       : clientesPerformance.map(c => ({
           codigo: c.codigo,
           nome: c.fantasia || c.razao || String(c.codigo),
         }));
     return fonte
       .filter(c => c.codigo != null && String(c.codigo).trim() !== '')
       .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
   }, [clientesPerformance, isEmpresa1003, agrCliente]);

 
    useEffect(() => {
      if (!initialized && (isEmpresa1003 || (periodoDisponivel && !isLoading))) {
        const filtrosInteligentes = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
        setPendingFilters(filtrosInteligentes);
        setAppliedFilters(filtrosInteligentes);
        setInitialized(true);
      }
    }, [periodoDisponivel, isLoading, initialized, codEmpresaAtiva, isEmpresa1003]);

  
    const hasChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters);
  
    const handleBuscar = useCallback(() => {
      setAppliedFilters(pendingFilters);
      setFiltersOpen(false);
    }, [pendingFilters]);
  
    const handleClearFilters = useCallback(() => {
      const defaults = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
      setPendingFilters(defaults);
      setAppliedFilters(defaults);
    }, [periodoDisponivel, codEmpresaAtiva]);
 
   // Cálculos por vendedor
   const vendedoresRanking = useMemo(() => {
     if (isEmpresa1003) {
       return (agrVendedor || [])
         .map((v: any) => {
           const total = Number(v.total_liquido) || 0;
           return {
             codigo: v.cod_vendedor,
             nome: String(v.vendedor || ''),
             faturamentoLiquido: total,
             faturamentoBruto: Number(v.total_faturado) || total,
             ticketMedio: Number(v.ticket_medio) || 0,
             qtdPedidos: Number(v.quantidade_pedidos) || 0,
             qtdPedidosCancelados: 0,
             valorCancelado: 0,
             margemMedia: Number(v.margem_percentual) || 0,
             totalDevolvido: 0,
             percentualDevolucao: 0,
             clientesAtendidos: Number(v.quantidade_clientes) || 0,
             ranking: 0,
             foto: getVendedorAvatar(String(v.vendedor || '')),
           } as any;
         })
         .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido)
         .map((v, index) => ({ ...v, ranking: index + 1 }));
     }
     return vendedoresPerformance
       .map((v) => {
         const pedidosVendedor = pedidos.filter(p => p.vendedor_codigo === v.codigo && (p.tipo || 'PEDIDO') === 'PEDIDO');
         const devolucoesUnificadas = pedidos.filter(p => p.vendedor_codigo === v.codigo && p.tipo === 'DEVOLUCAO');
         const devolucoesVendedor = devolucoes.filter(d => d.vendedor_codigo === v.codigo);

         const pedidosCancelados = pedidosVendedor.filter(p => 
           p.status === 'cancelado' || p.status === 'canceled'
         );
         const valorCancelado = pedidosCancelados.reduce((acc, p) => acc + Math.abs(p.valor_bruto || 0), 0);
         
         const margensValidas = pedidosVendedor.filter(p => p.margem !== undefined);
         const margemMedia = margensValidas.length > 0 
           ? margensValidas.reduce((acc, p) => acc + (p.margem || 0), 0) / margensValidas.length 
           : 0;
         
         const totalFaturado = v.faturamentoLiquido;
         const totalDevolvidoUnificado = devolucoesUnificadas.reduce(
           (acc, p) => acc + Math.abs(p.valor_real ?? p.valor_liquido ?? 0), 0
         );
         const totalDevolvidoLegado = devolucoesVendedor.reduce((acc, d) => acc + Math.abs(d.valor_liquido || 0), 0);
         const totalDevolvido = totalDevolvidoUnificado || totalDevolvidoLegado;
         
         const clientesAtendidos = new Set(pedidosVendedor.map(p => p.cliente_codigo)).size;
         
         return {
           ...v,
           ranking: 0,
           foto: getVendedorAvatar(v.nome),
           qtdPedidos: pedidosVendedor.length,
           qtdPedidosCancelados: pedidosCancelados.length,
           valorCancelado,
           margemMedia,
           totalDevolvido,
           percentualDevolucao: totalFaturado > 0 ? (totalDevolvido / totalFaturado) * 100 : 0,
           clientesAtendidos,
         };
       })
       .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido)
       .map((v, index) => ({ ...v, ranking: index + 1 }));
   }, [isEmpresa1003, agrVendedor, vendedoresPerformance, pedidos, devolucoes]);

 
   // Calcular participação
   const vendedoresComParticipacao = useMemo(() => {
     const totalGeral = vendedoresRanking.reduce((acc, v) => acc + v.faturamentoLiquido, 0) || 1;
     return vendedoresRanking.map(v => ({
       ...v,
       participacao: (v.faturamentoLiquido / totalGeral) * 100
     }));
   }, [vendedoresRanking]);
 
   // Vendas por UF
   const vendasPorUF = useMemo(() => {
     if (isEmpresa1003) {
       return (agrEstado || [])
         .map((e: any) => ({
           uf: String(e.estado || 'N/D'),
           vendas: Number(e.total_liquido) || 0,
           pedidos: Number(e.quantidade_pedidos) || 0,
           clientes: Number(e.quantidade_clientes) || 0,
         }))
         .sort((a, b) => b.vendas - a.vendas);
     }
     const porUF: Record<string, { uf: string; vendas: number; pedidos: number; clientes: Set<string | number> }> = {};
     
     pedidos.forEach(p => {
       const uf = p.cliente_uf || 'N/D';
       if (!porUF[uf]) {
         porUF[uf] = { uf, vendas: 0, pedidos: 0, clientes: new Set() };
       }
       porUF[uf].vendas += p.valor_liquido || 0;
       porUF[uf].pedidos += 1;
       porUF[uf].clientes.add(p.cliente_codigo);
     });
     
     return Object.values(porUF)
       .map(item => ({
         uf: item.uf,
         vendas: item.vendas,
         pedidos: item.pedidos,
         clientes: item.clientes.size,
       }))
       .sort((a, b) => b.vendas - a.vendas);
   }, [isEmpresa1003, agrEstado, pedidos]);

 
    // KPIs gerais — base por data_pedido (sem meta)
    const kpisCalculados = useMemo(() => {
      const totalVendas = vendedoresRanking.reduce((acc, v) => acc + v.faturamentoLiquido, 0);
      const totalDevolucoes = vendedoresRanking.reduce((acc, v) => acc + v.totalDevolvido, 0);
      const totalPedidos = vendedoresRanking.reduce((acc, v) => acc + v.qtdPedidos, 0);
      const totalCancelados = vendedoresRanking.reduce((acc, v) => acc + v.qtdPedidosCancelados, 0);

      // Valor Total = TODOS os pedidos pela data do pedido, menos devoluções
      const pedidosOnly = pedidos.filter(p => (p.tipo || 'PEDIDO') === 'PEDIDO' && p.status !== 'cancelado' && p.status !== 'canceled');
      const vendaBruta = pedidosOnly.reduce((s, p) => s + (p.valor_liquido || 0), 0);
      const totalVendido = vendaBruta - totalDevolucoes;

      // Quantidade de vendas = COUNT(DISTINCT cod_pedido) — exclui devoluções, cancelados e cod_pedido=0
      const codPedidosDistintos = new Set<string>();
      for (const p of pedidosOnly) {
        const cod = String((p as any).numero ?? (p as any).id ?? '').trim();
        if (cod && cod !== '0') codPedidosDistintos.add(cod);
      }
      const qtdVendas = codPedidosDistintos.size;

      // Ticket Médio = valor total / qtd de vendas
      const ticketMedioGeral = qtdVendas > 0 ? totalVendido / qtdVendas : 0;

     // Faturado = apenas pedidos que já têm data_faturamento (ou status faturado)
     const faturadoBruto = pedidosOnly
       .filter(p => !!p.data_faturamento || p.status === 'faturado')
       .reduce((s, p) => s + (p.valor_liquido || 0), 0);
     const totalFaturadoReal = Math.max(faturadoBruto - totalDevolucoes, 0);
     const percentualFaturado = totalVendido > 0 ? (totalFaturadoReal / totalVendido) * 100 : 0;
     const totalPendenteFaturamento = Math.max(totalVendido - totalFaturadoReal, 0);

     const margensValidas = vendedoresRanking.filter(v => v.margemMedia > 0);
     const margemMediaGeral = margensValidas.length > 0
       ? margensValidas.reduce((acc, v) => acc + v.margemMedia, 0) / margensValidas.length
       : 0;

     return {
       totalVendas,
       totalVendido,
       totalFaturadoReal,
       percentualFaturado,
       totalPendenteFaturamento,
       totalDevolucoes,
       totalPedidos,
       qtdVendas,
       totalCancelados,
       qtdProdutosVendidos: pedidosOnly.length,
       ticketMedioGeral,
       margemMediaGeral,
       qtdVendedores: vendedoresRanking.length,
       qtdClientes: clientesPerformance.length,
       percentualDevolucao: totalVendas > 0 ? (totalDevolucoes / totalVendas) * 100 : 0,
     };
   }, [vendedoresRanking, clientesPerformance, pedidos]);

   // Se o endpoint totalizador retornou dados, ele SUBSTITUI os cálculos locais nos cards.
   // Ideal (1003): usa exclusivamente os 3 endpoints /total conforme mapeamento oficial.
   const kpisView = useMemo(() => {
     // ---------------- IDEAL 1003 — mapeamento oficial dos endpoints /total ----------------
     if (isEmpresa1003) {
       const p = totIdealPedidos || {};
       const d = totIdealDevolucoes || {};
       const pr = totIdealProdutos || {};
       const nz = (v: any) => (v == null ? 0 : Number(v) || 0);
       const totalVendido = nz(p.total_pedidos);
        const qtdVendas = nz(p.quantidade_pedidos);
        const totalDevolucoes = nz(d.valor_total_devolvido);
        // Valor Faturado = total_liquido_faturado - valor_total_devolvido
        const totalLiquidoFaturado = nz((p as any).total_liquido_faturado) || nz(p.total_notas_fiscais);
        const totalFaturadoReal = Math.max(totalLiquidoFaturado - totalDevolucoes, 0);
       return {
         ...kpisCalculados,
         totalVendas: totalVendido,
         totalVendido,
         totalFaturadoReal,
         percentualFaturado: totalVendido > 0 ? (totalFaturadoReal / totalVendido) * 100 : 0,
         totalPendenteFaturamento: Math.max(totalVendido - totalFaturadoReal, 0),
         totalDevolucoes,
         totalPedidos: qtdVendas,
         qtdVendas,
         ticketMedioGeral: nz(p.ticket_medio) || (qtdVendas > 0 ? totalVendido / qtdVendas : 0),
         qtdVendedores: nz(p.quantidade_vendedores),
         qtdClientes: nz(p.quantidade_clientes),
         margemMediaGeral: nz(p.margem_percentual) || nz(pr.margem_percentual),
         qtdProdutosVendidos: nz(pr.quantidade_total_vendida),
         percentualDevolucao: totalVendido > 0 ? (totalDevolucoes / totalVendido) * 100 : 0,
       };
     }

     // ---------------- Demais empresas — hook antigo /comercial/totais ----------------
      if (isEmpresa10041) {
        const p = totIdealPedidos || {};
        const d = totIdealDevolucoes || {};
        const pr = totIdealProdutos || {};
        const nz = (v: any) => (v == null ? 0 : Number(v) || 0);
        const totalVendido = kpisCalculados.totalVendido || kpisCalculados.totalVendas || 0;
        const totalFaturadoReal = kpisCalculados.totalFaturadoReal || totalVendido;
        const totalDevolucoes = nz(d.valor_total_devolvido) || kpisCalculados.totalDevolucoes || 0;
        const qtdVendas = nz(pr.quantidade_total_vendida) || nz(p.quantidade_pedidos) || kpisCalculados.qtdVendas;
        const ticketMedioGeral = qtdVendas > 0 ? totalVendido / qtdVendas : 0;
        return {
          ...kpisCalculados,
          totalVendas: totalVendido,
          totalVendido,
          totalFaturadoReal,
          percentualFaturado: totalVendido > 0 ? (totalFaturadoReal / totalVendido) * 100 : 0,
          totalPendenteFaturamento: Math.max(totalVendido - totalFaturadoReal, 0),
          totalDevolucoes,
          totalPedidos: qtdVendas,
          qtdVendas,
          ticketMedioGeral,
          qtdClientes: nz(p.quantidade_clientes) || kpisCalculados.qtdClientes,
          qtdProdutosVendidos: qtdVendas,
          percentualDevolucao: totalVendido > 0 ? (totalDevolucoes / totalVendido) * 100 : 0,
        };
      }

      const hasTotalizador = kpisTotalizador && totalizadorRaw && Object.keys(totalizadorRaw).length > 0;
     if (!hasTotalizador) return kpisCalculados;
     const totalVendido = kpisTotalizador.faturamentoLiquido || kpisTotalizador.faturamentoBruto || 0;
     const totalFaturadoReal = kpisTotalizador.realizadoFaturado || totalVendido;
     const totalDevolucoes = kpisTotalizador.totalDevolucoes || 0;
     const qtdVendas = kpisTotalizador.qtdPedidos || kpisCalculados.qtdVendas;
     const ticketMedioGeral = qtdVendas > 0 ? totalVendido / qtdVendas : 0;
     return {
       ...kpisCalculados,
       totalVendas: totalVendido,
       totalVendido,
       totalFaturadoReal,
       percentualFaturado: totalVendido > 0 ? (totalFaturadoReal / totalVendido) * 100 : 0,
       totalPendenteFaturamento: Math.max(totalVendido - totalFaturadoReal, 0),
       totalDevolucoes,
       totalPedidos: kpisTotalizador.qtdPedidos || kpisCalculados.totalPedidos,
       qtdVendas,
       ticketMedioGeral,
       qtdVendedores: kpisTotalizador.qtdVendedores || kpisCalculados.qtdVendedores,
       qtdClientes: kpisTotalizador.qtdClientes || kpisCalculados.qtdClientes,
       percentualDevolucao: totalVendido > 0 ? (totalDevolucoes / totalVendido) * 100 : 0,
     };
    }, [isEmpresa1003, isEmpresa10041, totIdealPedidos, totIdealDevolucoes, totIdealProdutos, kpisTotalizador, totalizadorRaw, kpisCalculados]);


 
   // Dados para gráficos
  const dadosEvolucao = useMemo(() => {
    if (isEmpresa1003) {
      const rows = [...(agrPeriodo || [])].sort((a: any, b: any) =>
        String(a.periodo || '').localeCompare(String(b.periodo || ''))
      );
      return rows.map((row: any) => {
        const periodoStr = String(row.periodo || '');
        let label = periodoStr;
        if (evolucaoGranularidade === 'diaria' && /^\d{4}-\d{2}-\d{2}/.test(periodoStr)) {
          const d = new Date(periodoStr.slice(0, 10) + 'T00:00:00');
          if (!isNaN(d.getTime())) label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        } else if (evolucaoGranularidade === 'mensal' && /^\d{4}-\d{2}/.test(periodoStr)) {
          const [y, m] = periodoStr.split('-');
          label = new Date(Number(y), Number(m) - 1, 1)
            .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        } else if (evolucaoGranularidade === 'anual' && /^\d{4}/.test(periodoStr)) {
          label = periodoStr.slice(0, 4);
        }
        return {
          data: periodoStr,
          dataFormatada: label,
          vendas: Number(row.total_liquido) || 0,
          devolucoes: Number(row.total_devolucoes) || 0,
          pedidos: Number(row.quantidade_pedidos) || 0,
          clientes: Number(row.quantidade_clientes) || 0,
          ticket: Number(row.ticket_medio) || 0,
        };
      });
    }
    return evolucaoDiaria.map(d => ({
      ...d,
      dataFormatada: new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    }));
  }, [isEmpresa1003, agrPeriodo, evolucaoGranularidade, evolucaoDiaria]);

 
   const dadosPizzaVendedores = useMemo(() => {
     return vendedoresComParticipacao.slice(0, 6).map((v, index) => ({
       name: v.nome.split(' ')[0],
       value: v.faturamentoLiquido,
       color: CHART_COLORS[index % CHART_COLORS.length],
     }));
   }, [vendedoresComParticipacao]);
 
   const top5Vendedores = useMemo(() => {
     return vendedoresComParticipacao.slice(0, 5).map(v => ({
       nome: v.nome.split(' ').slice(0, 2).join(' '),
       valor: v.faturamentoLiquido,
     }));
   }, [vendedoresComParticipacao]);

  // Faturamento por Filial (para gráfico de rosca)
  const faturamentoPorFilial = useMemo(() => {
    if (isEmpresa1003) {
      return (agrFilial || [])
        .slice()
        .sort((a: any, b: any) => (Number(b.total_liquido) || 0) - (Number(a.total_liquido) || 0))
        .slice(0, 6)
        .map((f: any, index: number) => {
          const nome = String(f.empresa || f.cod_empresa || 'Sem Filial');
          return {
            name: nome.length > 15 ? nome.substring(0, 15) + '...' : nome,
            fullName: nome,
            value: Number(f.total_liquido) || 0,
            pedidos: Number(f.quantidade_pedidos) || 0,
            color: CHART_COLORS[index % CHART_COLORS.length],
          };
        });
    }
    const porFilial: Record<string, { nome: string; valor: number; pedidos: number }> = {};
    
    pedidos.forEach(p => {
      const filialNome = p.filial_nome || 'Sem Filial';
      if (!porFilial[filialNome]) {
        porFilial[filialNome] = { nome: filialNome, valor: 0, pedidos: 0 };
      }
      porFilial[filialNome].valor += p.valor_liquido || 0;
      porFilial[filialNome].pedidos += 1;
    });
    
    return Object.values(porFilial)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6)
      .map((f, index) => ({
        name: f.nome.length > 15 ? f.nome.substring(0, 15) + '...' : f.nome,
        fullName: f.nome,
        value: f.valor,
        pedidos: f.pedidos,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [isEmpresa1003, agrFilial, pedidos]);

 
   const top5UF = useMemo(() => {
     return vendasPorUF.slice(0, 5);
   }, [vendasPorUF]);

  // Dados de tendência mensal
  const dadosTendenciaMensal = useMemo(() => {
    const porMes: Record<string, { mes: string; valor: number }> = {};
    
    pedidos.forEach(p => {
      const data = new Date(p.data_pedido || p.data_faturamento);
      if (isNaN(data.getTime())) return;
      
      const mesKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const mesLabel = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      if (!porMes[mesKey]) {
        porMes[mesKey] = { mes: mesLabel, valor: 0 };
      }
      porMes[mesKey].valor += p.valor_liquido || 0;
    });
    
    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);
  }, [pedidos]);
 
   const getRankingIcon = (position: number) => {
     if (position === 1) return <Crown className="h-3 w-3" />;
     if (position === 2) return <Medal className="h-3 w-3" />;
     if (position === 3) return <Award className="h-3 w-3" />;
     return <span className="text-xs font-bold">#{position}</span>;
   };
 
   const getRankingBgColor = (position: number) => {
     if (position === 1) return 'bg-amber-500 text-black';
     if (position === 2) return 'bg-slate-300 text-slate-900';
     if (position === 3) return 'bg-amber-700 text-white';
     return 'bg-muted text-muted-foreground';
   };

  // Top 5 clientes
  const top5Clientes = useMemo(() => {
    if (isEmpresa1003) {
      return (agrCliente || [])
        .slice()
        .sort((a: any, b: any) => (Number(b.total_liquido) || 0) - (Number(a.total_liquido) || 0))
        .slice(0, 5)
        .map((c: any) => {
          const nome = String(c.nome_fantasia || c.cliente || c.cod_cliente || '');
          return {
            nome: nome.length > 20 ? nome.substring(0, 20) + '...' : nome,
            valor: Number(c.total_liquido) || 0,
          };
        });
    }
    return clientesPerformance
      .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido)
      .slice(0, 5)
      .map(c => ({
        nome: (c.fantasia || c.razao).length > 20 ? (c.fantasia || c.razao).substring(0, 20) + '...' : (c.fantasia || c.razao),
        valor: c.faturamentoLiquido,
      }));
  }, [isEmpresa1003, agrCliente, clientesPerformance]);

 
    if (isLoading) {
      return (
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-20" />
              </Card>
            ))}
          </div>
          <Card className="animate-pulse h-96" />
        </div>
      );
    }
 
   if (error) {
     return <ErrorState message="Erro ao carregar dados comerciais" />;
   }
 
   return (
     <div className="p-4 md:p-6 space-y-4 comercial-premium-scope">
       {/* Filtros */}
       <CollapsibleFilterBar
         title="Filtros"
         summary={appliedFilters ? getComercialFiltersSummary(appliedFilters, vendedoresDisponiveis, clientesDisponiveis) : []}
         activeFiltersCount={appliedFilters ? countActiveFilters(appliedFilters) : 0}
         onClear={handleClearFilters}
         isOpen={filtersOpen}
         onOpenChange={setFiltersOpen}
       >
          <ComercialFilters
            filters={pendingFilters || getDefaultFiltersForEmpresa(codEmpresaAtiva)}
            onFiltersChange={setPendingFilters}
            onBuscar={handleBuscar}
            hasChanges={hasChanges}
            anos={ANOS_DISPONIVEIS}
            vendedores={vendedoresDisponiveis}
            clientes={clientesDisponiveis}
            showVendedorFilter
            showClienteFilter={isEmpresa1003}
          />
       </CollapsibleFilterBar>
 
       {/* 3 Abas: Visão Geral, Ranking Vendedores, Evolução */}
       <Tabs defaultValue="visao-geral" className="space-y-6">
         <TabsList className="grid w-full grid-cols-4 h-12">
           <TabsTrigger value="visao-geral" className="text-sm">
             <BarChart3 className="h-4 w-4 mr-2 hidden sm:inline" />
             Visão Geral
           </TabsTrigger>
           <TabsTrigger value="metas" className="text-sm">
             <Target className="h-4 w-4 mr-2 hidden sm:inline" />
             Metas
           </TabsTrigger>
           <TabsTrigger value="ranking-vendedores" className="text-sm">
             <Trophy className="h-4 w-4 mr-2 hidden sm:inline" />
             Ranking Vendedores
           </TabsTrigger>
           <TabsTrigger value="evolucao" className="text-sm">
             <Activity className="h-4 w-4 mr-2 hidden sm:inline" />
             Evolução
           </TabsTrigger>
          </TabsList>

          <TabsContent value="metas" className="space-y-6">
            <MetasTabContent
              vendedoresPerformance={vendedoresPerformance}
              pedidos={pedidos}
              devolucoes={devolucoes}
              appliedFilters={appliedFilters}
              periodoDisponivel={periodoDisponivel}
            />
          </TabsContent>


         {/* ==================== ABA: VISÃO GERAL ==================== */}
         <TabsContent value="visao-geral" className="space-y-6">
          {/* Cards de destaque principais — PREMIUM INTERATIVO */}
          {(() => {
            const valorPendente = Math.max(0, kpisView.totalVendido - kpisView.totalFaturadoReal);
            const pctPendente = kpisView.totalVendido > 0 ? (valorPendente / kpisView.totalVendido) * 100 : 0;
            const mainCards = [
              { label: 'Valor Total', value: formatCurrency(kpisView.totalVendido), icon: DollarSign, accent: 'primary', sub: `${formatInteger(kpisView.totalPedidos)} pedidos`, trend: 'up' as const, onClick: () => setValorTotalDialogOpen(true) },
              { label: 'Valor Faturado', value: formatCurrency(kpisView.totalFaturadoReal), icon: TrendingUp, accent: 'chart-2', sub: `${formatPercent(kpisView.percentualFaturado)} faturado`, trend: 'up' as const },
              { label: 'Valor Pendente', value: formatCurrency(valorPendente), icon: Clock, accent: 'chart-3', sub: `${formatPercent(pctPendente)} a faturar`, trend: pctPendente > 20 ? 'down' as const : 'stable' as const },
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mainCards.map((kpi, i) => {
                  const Icon = kpi.icon;
                  return (
                    <Card
                      key={kpi.label}
                      onClick={(kpi as any).onClick}
                      className={cn(
                        "group relative overflow-hidden border-border/40",
                        (kpi as any).onClick ? "cursor-pointer" : "cursor-default",
                        "transition-all duration-300 ease-out",
                        "hover:-translate-y-1 hover:shadow-2xl hover:border-border",
                        `hover:shadow-${kpi.accent}/20`
                      )}
                      style={{
                        background: `linear-gradient(135deg, hsl(var(--${kpi.accent}) / 0.10) 0%, hsl(var(--card)) 55%)`,
                        animation: `fadeSlideUp 0.5s ${i * 0.08}s both`,
                      }}
                    >
                      <div
                        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                        style={{ background: `radial-gradient(circle, hsl(var(--${kpi.accent}) / 0.6), transparent 70%)` }}
                      />
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
                      <CardContent className="relative p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={cn(
                              "h-11 w-11 rounded-xl flex items-center justify-center",
                              "transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                            )}
                            style={{
                              background: `linear-gradient(135deg, hsl(var(--${kpi.accent}) / 0.25), hsl(var(--${kpi.accent}) / 0.10))`,
                              boxShadow: `0 6px 20px -8px hsl(var(--${kpi.accent}) / 0.5)`,
                            }}
                          >
                            <Icon className="h-5 w-5" style={{ color: `hsl(var(--${kpi.accent}))` }} />
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium gap-1 backdrop-blur-sm",
                              kpi.trend === 'up' && "text-success border-success/30 bg-success/5",
                              kpi.trend === 'down' && "text-destructive border-destructive/30 bg-destructive/5",
                              kpi.trend === 'stable' && "text-muted-foreground border-border bg-muted/30"
                            )}
                          >
                            {kpi.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                            {kpi.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                            {kpi.trend === 'stable' && <Activity className="h-3 w-3" />}
                            {kpi.sub}
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold mono-value tracking-tight transition-colors group-hover:text-primary">
                          {kpi.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">{kpi.label}</p>
                        <div
                          className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500"
                          style={{ background: `linear-gradient(90deg, hsl(var(--${kpi.accent})), transparent)` }}
                        />
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Card unificado: Vendas + Ticket Médio + Clientes Atendidos */}
                <Card
                  className="group relative overflow-hidden border-border/40 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:border-border hover:shadow-chart-5/20"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--chart-5) / 0.12) 0%, hsl(var(--chart-4) / 0.08) 50%, hsl(var(--card)) 100%)`,
                    animation: `fadeSlideUp 0.5s 0.24s both`,
                  }}
                >
                  <div
                    className="absolute -top-16 -right-10 w-40 h-40 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle, hsl(var(--chart-5) / 0.5), transparent 70%)` }}
                  />
                  <CardContent className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Atividade Comercial</p>
                      <Badge variant="outline" className="text-[10px] gap-1 border-border bg-muted/30 text-muted-foreground">
                        <Activity className="h-3 w-3" /> resumo
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Vendas', value: formatInteger(kpisView.qtdVendas), icon: ShoppingCart, accent: 'chart-5' },
                        { label: 'Ticket Médio', value: formatCurrency(kpisView.ticketMedioGeral), icon: Percent, accent: 'chart-3' },
                        { label: 'Clientes', value: formatInteger(kpisView.qtdClientes), icon: Store, accent: 'chart-4' },
                      ].map((m, idx) => {
                        const MIcon = m.icon;
                        return (
                          <div
                            key={m.label}
                            className={cn(
                              "flex flex-col items-start gap-1.5 rounded-lg p-2.5 transition-all duration-300",
                              idx !== 0 && "border-l border-border/40"
                            )}
                          >
                            <div
                              className="h-7 w-7 rounded-md flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, hsl(var(--${m.accent}) / 0.25), hsl(var(--${m.accent}) / 0.08))`,
                              }}
                            >
                              <MIcon className="h-3.5 w-3.5" style={{ color: `hsl(var(--${m.accent}))` }} />
                            </div>
                            <p className="text-base font-bold mono-value tracking-tight leading-none">{m.value}</p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider leading-tight">{m.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500"
                      style={{ background: `linear-gradient(90deg, hsl(var(--chart-5)), hsl(var(--chart-4)), transparent)` }}
                    />
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Métricas Secundárias — linha compacta */}
          {(() => {
            const pctDevBar = Math.min(100, kpisView.percentualDevolucao);
            const secundarios = [
              {
                label: 'Devoluções',
                value: formatCurrency(kpisView.totalDevolucoes),
                icon: TrendingDown,
                color: 'hsl(var(--destructive))',
                bar: pctDevBar,
              },
              {
                label: 'Produtos Vendidos',
                value: formatInteger(kpisView.qtdProdutosVendidos),
                icon: Package,
                color: 'hsl(var(--chart-4))',
              },
              {
                label: 'Margem Média',
                value: formatPercent(kpisView.margemMediaGeral),
                icon: Percent,
                color: 'hsl(var(--chart-2))',
              },
              {
                label: 'Vendedores Ativos',
                value: formatInteger(kpisView.qtdVendedores),
                icon: Users,
                color: 'hsl(var(--chart-5))',
              },
            ];
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {secundarios.map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <Card
                      key={m.label}
                      className="relative overflow-hidden border-border/40 bg-card/60"
                      style={{ animation: `fadeSlideUp 0.5s ${0.5 + i * 0.06}s both` }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{m.label}</p>
                            <p className="text-xl font-bold mono-value tracking-tight" style={{ color: m.color }}>
                              {m.value}
                            </p>
                          </div>
                          <Icon className="h-5 w-5 shrink-0 opacity-70" style={{ color: m.color }} />
                        </div>
                        {typeof m.bar === 'number' && (
                          <div className="mt-3 h-1 bg-muted/60 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${m.bar}%`, background: m.color }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}








          {/* Modal de detalhes do vendedor selecionado */}
          <Dialog open={selectedVendedorTop !== null} onOpenChange={(open) => !open && setSelectedVendedorTop(null)}>
            <DialogContent className="max-w-lg">
              {(() => {
                const v = vendedoresComParticipacao.find((x) => x.codigo === selectedVendedorTop);
                if (!v) return null;
                const idx = vendedoresComParticipacao.findIndex((x) => x.codigo === selectedVendedorTop);
                return (
                  <>
                    <DialogHeader>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={cn(
                            "absolute -top-1 -left-1 h-6 w-6 rounded-full flex items-center justify-center z-10 shadow-md",
                            getRankingBgColor(idx + 1)
                          )}>
                            {getRankingIcon(idx + 1)}
                          </div>
                          <Avatar className="h-16 w-16 ring-2 ring-primary/40">
                            {v.foto ? <AvatarImage src={v.foto} alt={v.nome} className="object-cover object-center" /> : null}
                            <AvatarFallback className="bg-primary/10 text-primary text-lg">
                              {v.nome.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <DialogTitle className="uppercase tracking-tight truncate">{v.nome}</DialogTitle>
                          <DialogDescription className="mono-value text-base text-foreground font-semibold mt-1">
                            {formatCurrency(v.faturamentoLiquido)}
                            <span className="ml-2 text-xs text-muted-foreground font-normal">
                              ({formatPercent(v.participacao)} do total)
                            </span>
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="mt-4">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(v.participacao * 4, 100)}%`,
                            background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--chart-2)))',
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Pedidos</p>
                        <p className="text-xl font-bold mono-value">{formatInteger(v.qtdPedidos)}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Ticket Médio</p>
                        <p className="text-xl font-bold mono-value">{formatCurrency(v.ticketMedio)}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Clientes</p>
                        <p className="text-xl font-bold mono-value">{formatInteger(v.clientesAtendidos)}</p>
                      </div>
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Devoluções</p>
                        <p className="text-xl font-bold mono-value text-destructive">{formatPercent(v.percentualDevolucao)}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mono-value">{formatCurrency(v.totalDevolvido)}</p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Blocos analíticos - 3 colunas no desktop */}
          <div className={`grid grid-cols-1 gap-6 ${isEmpresa1003 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
            {/* Faturamento por Filial - PRIMEIRO */}
            <FaturamentoPorFilialPremium data={faturamentoPorFilial} />

            {/* Top 5 Clientes — Ranking Executivo Premium */}
            {(() => {
              const sortedClientes = [...top5Clientes].sort((a: any, b: any) => b.valor - a.valor);
              const top3 = sortedClientes.slice(0, 3);
              const others = sortedClientes.slice(3);
              const totalTop5 = sortedClientes.reduce((s, c) => s + c.valor, 0);
              const top2Total = sortedClientes.slice(0, 2).reduce((s, c) => s + c.valor, 0);
              const top2Percent = totalTop5 > 0 ? Math.round((top2Total / totalTop5) * 100) : 0;
              const GOLD = '#F4B233';
              const GOLD_DIM = 'rgba(244,178,51,0.55)';
              const MEDAL_BG = ['rgba(244,178,51,0.18)', 'rgba(244,178,51,0.12)', 'rgba(244,178,51,0.08)'];

              return (
                <Card
                  className="overflow-hidden group transition-all duration-300 h-full flex flex-col rounded-2xl"
                  style={{
                    background: 'hsl(221 46% 8%)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                  }}
                >
                  <CardHeader className="pb-1 pt-3 px-5">
                    <CardTitle className="text-[15px] font-semibold tracking-tight text-white flex items-center gap-2">
                      <Trophy className="h-4 w-4" style={{ color: GOLD }} />
                      Top 5 Clientes
                    </CardTitle>
                    <p className="text-[11px] text-white/50 mt-0.5 font-normal">Clientes com maior faturamento</p>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col px-5 pb-4 pt-1">
                    {/* Pódio — Top 3 */}
                    <div className="flex flex-col gap-2.5 flex-1 justify-center">
                      {top3.map((c, i) => (
                        <div
                          key={c.nome}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200"
                          style={{
                            background: MEDAL_BG[i],
                            border: i === 0 ? `1px solid ${GOLD}30` : '1px solid transparent',
                          }}
                        >
                          <div
                            className="flex items-center justify-center rounded-full flex-shrink-0"
                            style={{
                              width: 28,
                              height: 28,
                              background: i === 0 ? GOLD : i === 1 ? GOLD_DIM : 'rgba(255,255,255,0.08)',
                              color: i === 0 ? '#071426' : GOLD,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {i === 0 ? '1' : i === 1 ? '2' : '3'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-white/95 truncate" title={c.nome}>
                              {c.nome}
                            </p>
                          </div>
                          <p
                            className="text-[14px] font-bold tabular-nums whitespace-nowrap flex-shrink-0"
                            style={{ color: i === 0 ? GOLD : 'rgba(255,255,255,0.85)' }}
                          >
                            {formatCurrency(c.valor)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Divisor */}
                    {others.length > 0 && (
                      <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    )}

                    {/* Demais posições — 4º e 5º */}
                    <div className="flex flex-col gap-2">
                      {others.map((c, i) => (
                        <div
                          key={c.nome}
                          className="flex items-center gap-3 rounded-md px-3 py-1.5 transition-all duration-200 hover:bg-white/[0.03]"
                        >
                          <span className="text-[11px] font-bold text-white/30 tabular-nums w-7 text-center flex-shrink-0">
                            #{i + 4}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-white/60 truncate" title={c.nome}>
                              {c.nome}
                            </p>
                          </div>
                          <p className="text-[12px] font-semibold tabular-nums whitespace-nowrap text-white/70 flex-shrink-0">
                            {formatCurrency(c.valor)}
                          </p>
                        </div>
                      ))}
                    </div>

                  </CardContent>
                </Card>
              );
            })()}

            {/* Vendas por Estado - Lista Premium (oculto para 1003) */}
            {!isEmpresa1003 && (

            <Card className="premium-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-chart-3 icon-hover-glow" />
                    Vendas por Estado
                  </span>
                  <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
                    {vendasPorUF.length} estados
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[420px] overflow-y-auto pr-1 -mr-1">
                  {(() => {
                    const lista = vendasPorUF.slice(0, 10);
                    const totalGeral = vendasPorUF.reduce((s, u) => s + u.vendas, 0);
                    const max = lista[0]?.vendas || 1;
                    return (
                      <ul className="divide-y divide-border/40">
                        {lista.map((uf, i) => {
                          const perc = totalGeral > 0 ? (uf.vendas / totalGeral) * 100 : 0;
                          const barW = Math.max(2, (uf.vendas / max) * 100);
                          const ticket = uf.pedidos > 0 ? uf.vendas / uf.pedidos : 0;
                          return (
                            <li
                              key={uf.uf}
                              className="group flex items-center gap-4 py-3.5 px-1 hover:bg-muted/30 rounded-md transition-colors"
                              style={{ animation: `fadeSlideUp 0.4s ${i * 0.03}s both` }}
                            >
                              {/* rank */}
                              <span className="w-6 text-center text-xs font-semibold text-muted-foreground tabular-nums shrink-0">
                                {i + 1}
                              </span>

                              {/* UF */}
                              <span className="font-bold text-base tracking-tight w-10 shrink-0">
                                {uf.uf}
                              </span>

                              {/* bar + meta */}
                              <div className="flex-1 min-w-0">
                                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                    style={{
                                      width: `${barW}%`,
                                      backgroundColor: 'hsl(var(--chart-3))',
                                    }}
                                  />
                                </div>
                                <div className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                                  {uf.pedidos.toLocaleString('pt-BR')} pedidos
                                </div>
                              </div>

                              {/* valor + % */}
                              <div className="text-right shrink-0">
                                <div className="text-sm font-bold mono-value tabular-nums">
                                  {formatCurrency(uf.vendas, true)}
                                </div>
                                <div className="text-[10px] text-chart-3 font-semibold tabular-nums mt-0.5">
                                  {perc < 0.1 ? '<0,1%' : `${perc.toFixed(1)}%`}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
            )}
          </div>


          {/* Evolução de Vendas — largura total, logo após totalizadores */}
          {(() => {
            const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            const agrupar = (items: any[], gran: 'diaria' | 'mensal' | 'anual') => {
              if (gran === 'diaria') return items;
              const buckets = new Map<string, { data: string; vendas: number; devolucoes: number }>();
              for (const it of items) {
                const raw = (it.data || '').toString();
                if (!raw) continue;
                const key = gran === 'mensal' ? raw.substring(0, 7) : raw.substring(0, 4);
                const cur = buckets.get(key) ?? { data: key, vendas: 0, devolucoes: 0 };
                cur.vendas += it.vendas || 0;
                cur.devolucoes += it.devolucoes || 0;
                buckets.set(key, cur);
              }
              return Array.from(buckets.values())
                .sort((a, b) => a.data.localeCompare(b.data))
                .map((b) => {
                  let label = b.data;
                  if (gran === 'mensal') {
                    const [ano, mes] = b.data.split('-').map(Number);
                    if (ano && mes) label = `${MESES_PT[mes - 1]}/${String(ano).slice(-2)}`;
                  }
                  return { ...b, dataFormatada: label };
                });
            };
            const agrupado = agrupar(dadosEvolucao, evolucaoGranularidade);
            const limite = evolucaoGranularidade === 'diaria' ? 20 : evolucaoGranularidade === 'mensal' ? 12 : 8;
            const dataEv = agrupado.slice(-limite);
            const focoData = hoveredEvolucao || dataEv[dataEv.length - 1];
            const totalVendas = dataEv.reduce((s, d: any) => s + (d.vendas || 0), 0);
            const totalDev = dataEv.reduce((s, d: any) => s + (d.devolucoes || 0), 0);
            const pontosAtivos = dataEv.filter((d: any) => (d.vendas || 0) > 0);
            const mediaPeriodo = pontosAtivos.length ? totalVendas / pontosAtivos.length : 0;
            const melhorPonto = dataEv.reduce((acc: any, d: any) => (d.vendas || 0) > (acc?.vendas || 0) ? d : acc, null as any);
            const ultimo = dataEv[dataEv.length - 1];
            const penultimo = dataEv[dataEv.length - 2];
            const variacao = penultimo && penultimo.vendas
              ? (((ultimo?.vendas || 0) - penultimo.vendas) / penultimo.vendas) * 100
              : 0;
            const taxaDev = totalVendas > 0 ? (totalDev / totalVendas) * 100 : 0;
            const labelUnidade = evolucaoGranularidade === 'diaria' ? 'dia' : evolucaoGranularidade === 'mensal' ? 'mês' : 'ano';
            const labelMediaUnidade = evolucaoGranularidade === 'diaria' ? 'diária' : evolucaoGranularidade === 'mensal' ? 'mensal' : 'anual';
            const labelVariacao = evolucaoGranularidade === 'diaria' ? 'Variação D-1' : evolucaoGranularidade === 'mensal' ? 'Variação M-1' : 'Variação A-1';
            const granOptions: Array<{ id: 'diaria' | 'mensal' | 'anual'; label: string }> = [
              { id: 'diaria', label: 'Diária' },
              { id: 'mensal', label: 'Mensal' },
              { id: 'anual', label: 'Anual' },
            ];
            return (
              <Card className="border-border/40 overflow-hidden w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Evolução de Vendas
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Alternador de granularidade */}
                      <div className="inline-flex items-center rounded-md border border-border/40 bg-muted/20 p-0.5">
                        {granOptions.map((opt) => {
                          const ativo = evolucaoGranularidade === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setEvolucaoGranularidade(opt.id)}
                              className={cn(
                                "px-2.5 py-1 rounded text-[10px] font-medium transition-all",
                                ativo
                                  ? "bg-primary/20 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.25)]"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEvolucaoSeries((s) => ({ ...s, vendas: !s.vendas }))}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-medium border transition-all",
                            evolucaoSeries.vendas
                              ? "bg-primary/15 border-primary/40 text-primary"
                              : "bg-transparent border-border/40 text-muted-foreground line-through"
                          )}
                        >
                          ● Vendas
                        </button>
                        <button
                          onClick={() => setEvolucaoSeries((s) => ({ ...s, devolucoes: !s.devolucoes }))}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-medium border transition-all",
                            evolucaoSeries.devolucoes
                              ? "bg-destructive/15 border-destructive/40 text-destructive"
                              : "bg-transparent border-border/40 text-muted-foreground line-through"
                          )}
                        >
                          ● Devoluções
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] tabular-nums">
                    <span className="text-muted-foreground">{hoveredEvolucao ? 'Foco:' : 'Período:'}</span>
                    <span className="font-bold text-foreground mono-value">{focoData?.dataFormatada || '—'}</span>
                    <span className="text-primary mono-value">{formatCurrency(focoData?.vendas || 0)}</span>
                    <span className="text-destructive mono-value">−{formatCurrency(focoData?.devolucoes || 0)}</span>
                    <span className="ml-auto text-muted-foreground">Total: <span className="text-foreground font-semibold mono-value">{formatCurrency(totalVendas - totalDev)}</span></span>
                  </div>
                </CardHeader>
                <CardContent>
                  {dataEv.length === 0 ? (
                    <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
                      Sem dados de evolução no período selecionado.
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 360 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          key={evolucaoGranularidade}
                          data={dataEv}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                          onMouseMove={(e: any) => e?.activePayload?.[0] && setHoveredEvolucao(e.activePayload[0].payload)}
                          onMouseLeave={() => setHoveredEvolucao(null)}
                        >
                          <defs>
                            <linearGradient id="colorVendasVGNew" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorDevVGNew" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                          <XAxis dataKey="dataFormatada" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip
                            cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                            content={<PremiumChartTooltip labelMap={{ vendas: 'Vendas', devolucoes: 'Devoluções' }} />}
                          />
                          {evolucaoSeries.vendas && (
                            <Area type="monotone" dataKey="vendas" name="Vendas" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#colorVendasVGNew)" activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }} isAnimationActive={false} />
                          )}
                          {evolucaoSeries.devolucoes && (
                            <Area type="monotone" dataKey="devolucoes" name="Devoluções" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#colorDevVGNew)" activeDot={{ r: 5 }} isAnimationActive={false} />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Mini KPIs */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border border-border/40 bg-muted/20 px-3.5 py-2.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Melhor {labelUnidade}
                      </p>
                      <p className="text-base font-bold mono-value text-primary truncate mt-0.5">{formatCurrency(melhorPonto?.vendas || 0, true)}</p>
                      <p className="text-[11px] text-muted-foreground mono-value">{melhorPonto?.dataFormatada || '—'}</p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 px-3.5 py-2.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Média {labelMediaUnidade}
                      </p>
                      <p className="text-base font-bold mono-value text-foreground truncate mt-0.5">{formatCurrency(mediaPeriodo, true)}</p>
                      <p className="text-[11px] text-muted-foreground mono-value">{pontosAtivos.length}/{dataEv.length} {labelUnidade}s ativos</p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 px-3.5 py-2.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> {labelVariacao}
                      </p>
                      <p className={cn("text-base font-bold mono-value truncate mt-0.5", variacao >= 0 ? "text-emerald-500" : "text-destructive")}>
                        {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-muted-foreground mono-value">vs {penultimo?.dataFormatada || '—'}</p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 px-3.5 py-2.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <RotateCcw className="h-3 w-3" /> Tx. Devolução
                      </p>
                      <p className="text-base font-bold mono-value text-destructive truncate mt-0.5">{taxaDev.toFixed(2)}%</p>
                      <p className="text-[11px] text-muted-foreground mono-value">−{formatCurrency(totalDev, true)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
})()}

          </TabsContent>
 
         {/* ==================== ABA: RANKING VENDEDORES ==================== */}
         <TabsContent value="ranking-vendedores" className="space-y-6">
           {(() => {
             const focused = vendedoresComParticipacao.find(v => v.codigo === selectedVendedorTop) ?? null;
             const podio = vendedoresComParticipacao.slice(0, 3);
             const podioOrder = [podio[1], podio[0], podio[2]].filter(Boolean);
             const totalFat = vendedoresComParticipacao.reduce((a, v) => a + v.faturamentoLiquido, 0) || 1;
             const pizzaData = vendedoresComParticipacao.slice(0, 6).map((v, i) => ({
               name: v.nome.split(' ')[0],
               codigo: v.codigo,
               value: v.faturamentoLiquido,
               color: CHART_COLORS[i % CHART_COLORS.length],
             }));
             const activePizzaIdx = focused ? pizzaData.findIndex(p => p.codigo === focused.codigo) : -1;

             const focusKpis = focused ? {
               margem: focused.margemMedia,
               cancelados: focused.qtdPedidosCancelados,
               percDev: focused.percentualDevolucao,
             } : {
               margem: kpisCalculados.margemMediaGeral,
               cancelados: kpisCalculados.totalCancelados,
               percDev: kpisCalculados.percentualDevolucao,
             };

             return (
               <>
                 {/* Pódio Top 3 */}
                 {podio.length > 0 && (
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                     {podioOrder.map((v, i) => {
                       const isFirst = v.ranking === 1;
                       const podColor = v.ranking === 1 ? 'amber' : v.ranking === 2 ? 'slate' : 'orange';
                       const isSelected = selectedVendedorTop === v.codigo;
                       return (
                         <button
                           key={v.codigo}
                           onClick={() => setSelectedVendedorTop(isSelected ? null : v.codigo)}
                           className={cn(
                             "group relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 text-left transition-all duration-300",
                             "hover:scale-[1.02] hover:shadow-2xl hover:-translate-y-1",
                             isFirst ? "md:order-2 md:-mt-2 md:pb-6" : i === 0 ? "md:order-1" : "md:order-3",
                             isFirst
                               ? "from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/40 shadow-[0_0_30px_-10px_hsl(45_93%_47%/0.4)]"
                               : v.ranking === 2
                               ? "from-slate-300/10 via-slate-300/5 to-transparent border-slate-300/30"
                               : "from-orange-700/10 via-orange-700/5 to-transparent border-orange-700/30",
                             isSelected && "ring-2 ring-primary shadow-[0_0_40px_-5px_hsl(var(--primary)/0.5)]",
                             selectedVendedorTop && !isSelected && "opacity-50"
                           )}
                         >
                           <div className={cn(
                             "absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl transition-opacity",
                             podColor === 'amber' && "bg-amber-500/30",
                             podColor === 'slate' && "bg-slate-400/20",
                             podColor === 'orange' && "bg-orange-700/20",
                             "group-hover:opacity-80"
                           )} />
                           <div className="relative flex items-center gap-3">
                             <div className={cn(
                               "h-12 w-12 rounded-full flex items-center justify-center shrink-0 shadow-lg",
                               getRankingBgColor(v.ranking)
                             )}>
                               {getRankingIcon(v.ranking)}
                             </div>
                             <Avatar className={cn("shrink-0 ring-2", isFirst ? "h-14 w-14 ring-amber-500/50" : "h-11 w-11 ring-border")}>
                               {v.foto && <AvatarImage src={v.foto} alt={v.nome} className="object-cover object-top" />}
                               <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                 {v.nome.substring(0, 2).toUpperCase()}
                               </AvatarFallback>
                             </Avatar>
                             <div className="min-w-0 flex-1">
                               <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                 {v.ranking === 1 ? '🥇 Líder' : v.ranking === 2 ? '🥈 Vice' : '🥉 3º Lugar'}
                               </p>
                               <p className="font-bold truncate text-sm">{v.nome}</p>
                               <p className={cn("font-mono font-bold mt-0.5", isFirst ? "text-xl text-amber-500" : "text-base")}>
                                 {formatCurrency(v.faturamentoLiquido)}
                               </p>
                             </div>
                           </div>
                           <div className="relative mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                             <span>{formatInteger(v.qtdPedidos)} pedidos</span>
                             <span className="font-semibold text-foreground">{formatPercent(v.participacao)}</span>
                           </div>
                           <div className="relative mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                             <div
                               className={cn(
                                 "h-full rounded-full transition-all duration-700",
                                 podColor === 'amber' && "bg-gradient-to-r from-amber-400 to-amber-600",
                                 podColor === 'slate' && "bg-gradient-to-r from-slate-300 to-slate-500",
                                 podColor === 'orange' && "bg-gradient-to-r from-orange-500 to-orange-700"
                               )}
                               style={{ width: `${Math.min(v.participacao * 3, 100)}%` }}
                             />
                           </div>
                         </button>
                       );
                     })}
                   </div>
                 )}

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Lista Premium Interativa */}
                   <div className="lg:col-span-2">
                     <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-card/50">
                       <CardHeader className="pb-3 border-b border-border/40 bg-gradient-to-r from-amber-500/5 to-transparent">
                         <div className="flex items-center justify-between">
                           <CardTitle className="text-base flex items-center gap-2">
                             <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
                               <Trophy className="h-4 w-4 text-white" />
                             </div>
                             Ranking por Faturamento
                             <Badge variant="outline" className="ml-1 text-[10px]">
                               {vendedoresComParticipacao.length}
                             </Badge>
                           </CardTitle>
                           {selectedVendedorTop && (
                             <button
                               onClick={() => setSelectedVendedorTop(null)}
                               className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                             >
                               Limpar seleção
                             </button>
                           )}
                         </div>
                       </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y divide-border/40 max-h-[680px] overflow-y-auto">
                            {vendedoresComParticipacao.map((vendedor, idx) => {
                              const isSelected = selectedVendedorTop === vendedor.codigo;
                              const isDimmed = selectedVendedorTop && !isSelected;
                              const barColor = CHART_COLORS[idx % CHART_COLORS.length];
                              return (
                                <div
                                  key={String(vendedor.codigo)}
                                  className={cn(
                                    "group relative transition-all duration-300",
                                    isSelected && "bg-primary/5",
                                    isDimmed && "opacity-40"
                                  )}
                                >
                                  {/* Barra lateral animada */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-300"
                                    style={{
                                      background: barColor,
                                      opacity: isSelected ? 1 : 0,
                                      boxShadow: isSelected ? `0 0 12px ${barColor}` : 'none',
                                    }}
                                  />
                                  <div className="flex items-stretch">
                                    <button
                                      className="flex-1 text-left"
                                      onClick={() => setExpandedVendedor(vendedor.codigo)}
                                    >
                                      <div className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors cursor-pointer">
                                        <div className={cn(
                                          "flex items-center justify-center h-9 w-9 rounded-full shrink-0 shadow-md transition-transform group-hover:scale-110",
                                          getRankingBgColor(vendedor.ranking)
                                        )}>
                                          {getRankingIcon(vendedor.ranking)}
                                        </div>
                                        <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/60">
                                          {vendedor.foto && (
                                            <AvatarImage src={vendedor.foto} alt={vendedor.nome} className="object-cover object-top" />
                                          )}
                                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                            {vendedor.nome.substring(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold truncate text-sm">{vendedor.nome}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                              <div
                                                className="h-full rounded-full transition-all duration-700 ease-out"
                                                style={{
                                                  width: `${Math.min((vendedor.faturamentoLiquido / (podio[0]?.faturamentoLiquido || 1)) * 100, 100)}%`,
                                                  background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                                                  boxShadow: `0 0 8px ${barColor}66`,
                                                }}
                                              />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-10 text-right">
                                              {formatPercent(vendedor.participacao)}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className="font-bold mono-value text-sm">{formatCurrency(vendedor.faturamentoLiquido)}</p>
                                          <p className="text-[10px] text-muted-foreground">{formatInteger(vendedor.qtdPedidos)} ped.</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
                                      </div>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVendedorTop(isSelected ? null : vendedor.codigo);
                                      }}
                                      className={cn(
                                        "px-3 border-l border-border/40 transition-colors text-xs font-medium",
                                        isSelected
                                          ? "bg-primary text-primary-foreground"
                                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                      )}
                                      title={isSelected ? "Desfocar" : "Focar este vendedor"}
                                    >
                                      <Target className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Dialog de detalhes do vendedor */}
                          <Dialog open={expandedVendedor !== null} onOpenChange={(open) => !open && setExpandedVendedor(null)}>
                            <DialogContent className="max-w-2xl">
                              {(() => {
                                const v = vendedoresComParticipacao.find(x => x.codigo === expandedVendedor);
                                if (!v) return null;
                                const barColor = CHART_COLORS[(v.ranking - 1) % CHART_COLORS.length];
                                return (
                                  <>
                                    <DialogHeader>
                                      <div className="flex items-center gap-4">
                                        <div className={cn(
                                          "flex items-center justify-center h-12 w-12 rounded-full shrink-0 shadow-lg",
                                          getRankingBgColor(v.ranking)
                                        )}>
                                          {getRankingIcon(v.ranking)}
                                        </div>
                                        <Avatar className="h-14 w-14 shrink-0 ring-2 ring-border/60">
                                          {v.foto && <AvatarImage src={v.foto} alt={v.nome} className="object-cover object-top" />}
                                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                            {v.nome.substring(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 text-left">
                                          <DialogTitle className="text-xl truncate">{v.nome}</DialogTitle>
                                          <DialogDescription className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px]">#{v.ranking} no ranking</Badge>
                                            <span className="text-xs text-muted-foreground">{formatPercent(v.participacao)} de participação</span>
                                          </DialogDescription>
                                        </div>
                                      </div>
                                    </DialogHeader>

                                    {/* Faturamento destaque */}
                                    <div className="rounded-xl p-4 mt-2 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faturamento Líquido</p>
                                      <p className="font-bold text-3xl mt-1 mono-value" style={{ color: barColor }}>
                                        {formatCurrency(v.faturamentoLiquido)}
                                      </p>
                                      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-700"
                                          style={{
                                            width: `${Math.min((v.faturamentoLiquido / (podio[0]?.faturamentoLiquido || 1)) * 100, 100)}%`,
                                            background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                                            boxShadow: `0 0 12px ${barColor}66`,
                                          }}
                                        />
                                      </div>
                                    </div>

                                    {/* Métricas */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                                      <div className="rounded-lg p-3 bg-muted/40 border border-border/40">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                          <FileText className="h-3 w-3" />
                                          <p className="text-[10px] uppercase tracking-wider">Pedidos</p>
                                        </div>
                                        <p className="font-bold text-lg mt-1">{formatInteger(v.qtdPedidos)}</p>
                                      </div>
                                      <div className="rounded-lg p-3 bg-muted/40 border border-border/40">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                          <DollarSign className="h-3 w-3" />
                                          <p className="text-[10px] uppercase tracking-wider">Ticket Médio</p>
                                        </div>
                                        <p className="font-bold text-lg mt-1">{formatCurrency(v.ticketMedio)}</p>
                                      </div>
                                      <div className="rounded-lg p-3 bg-destructive/5 border border-destructive/20">
                                        <div className="flex items-center gap-1.5 text-destructive">
                                          <TrendingDown className="h-3 w-3" />
                                          <p className="text-[10px] uppercase tracking-wider">Devoluções</p>
                                        </div>
                                        <p className="font-bold text-lg mt-1 text-destructive">{formatPercent(v.percentualDevolucao)}</p>
                                        <p className="text-[10px] text-muted-foreground">{formatCurrency(v.totalDevolvido)}</p>
                                      </div>
                                      <div className="rounded-lg p-3 bg-muted/40 border border-border/40">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                          <Users className="h-3 w-3" />
                                          <p className="text-[10px] uppercase tracking-wider">Clientes</p>
                                        </div>
                                        <p className="font-bold text-lg mt-1">{formatInteger(v.clientesAtendidos)}</p>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </DialogContent>
                          </Dialog>
                       </CardContent>
                     </Card>
                   </div>

                   {/* Painel lateral interativo */}
                   <div className="space-y-4">
                     {/* Pizza interativa */}
                     <Card className="overflow-hidden border-border/60">
                       <CardHeader className="pb-2 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
                         <CardTitle className="text-sm flex items-center justify-between">
                           <span className="flex items-center gap-2">
                             <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                             Participação no Faturamento
                           </span>
                           <span className="text-[10px] font-normal text-muted-foreground">
                             Top {pizzaData.length}
                           </span>
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="pb-4 pt-3">
                         {(() => {
                           const activeIdx = hoveredPizzaIdx ?? activePizzaIdx;
                           const displayed = activeIdx >= 0 ? pizzaData[activeIdx] : null;
                           const displayedVendor = displayed
                             ? vendedoresComParticipacao.find(v => v.codigo === displayed.codigo)
                             : null;
                           return (
                             <>
                               <div className="relative h-[230px]">
                                 <ResponsiveContainer width="100%" height="100%">
                                   <PieChart>
                                     <defs>
                                       {pizzaData.map((p, i) => (
                                         <radialGradient key={i} id={`pizzaGrad-${i}`}>
                                           <stop offset="0%" stopColor={p.color} stopOpacity={1} />
                                           <stop offset="100%" stopColor={p.color} stopOpacity={0.7} />
                                         </radialGradient>
                                       ))}
                                     </defs>
                                     <Pie
                                       data={pizzaData}
                                       cx="50%"
                                       cy="50%"
                                       innerRadius={58}
                                       outerRadius={88}
                                       paddingAngle={3}
                                       dataKey="value"
                                       activeIndex={activeIdx >= 0 ? activeIdx : undefined}
                                       activeShape={(props: any) => (
                                         <g>
                                           <Sector
                                             {...props}
                                             outerRadius={props.outerRadius + 8}
                                             innerRadius={props.innerRadius - 2}
                                             style={{
                                               filter: `drop-shadow(0 0 12px ${props.fill})`,
                                               transition: 'all 0.3s ease',
                                             }}
                                           />
                                           <Sector
                                             cx={props.cx}
                                             cy={props.cy}
                                             startAngle={props.startAngle}
                                             endAngle={props.endAngle}
                                             innerRadius={props.outerRadius + 12}
                                             outerRadius={props.outerRadius + 14}
                                             fill={props.fill}
                                             opacity={0.5}
                                           />
                                         </g>
                                       )}
                                       onMouseEnter={(_, idx) => setHoveredPizzaIdx(idx)}
                                       onMouseLeave={() => setHoveredPizzaIdx(null)}
                                       onClick={(d: any) => setSelectedVendedorTop(
                                         selectedVendedorTop === d.codigo ? null : d.codigo
                                       )}
                                       className="cursor-pointer outline-none"
                                       animationDuration={600}
                                     >
                                       {pizzaData.map((entry, index) => (
                                         <Cell
                                           key={`cell-${index}`}
                                           fill={`url(#pizzaGrad-${index})`}
                                           stroke={entry.color}
                                           strokeWidth={1}
                                           style={{
                                             opacity: activeIdx === -1 || activeIdx === index ? 1 : 0.3,
                                             transition: 'opacity 0.25s ease',
                                           }}
                                         />
                                       ))}
                                     </Pie>
                                   </PieChart>
                                 </ResponsiveContainer>
                                 {/* Centro animado */}
                                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                   {displayed ? (
                                     <div key={displayed.codigo as any} className="text-center animate-in fade-in-0 zoom-in-95 duration-200">
                                       <div
                                         className="h-1.5 w-1.5 rounded-full mx-auto mb-1"
                                         style={{ background: displayed.color, boxShadow: `0 0 10px ${displayed.color}` }}
                                       />
                                       <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold max-w-[80px] truncate">
                                         {displayedVendor?.nome || displayed.name}
                                       </p>
                                       <p className="text-lg font-bold mono-value leading-tight" style={{ color: displayed.color }}>
                                         {formatPercent(displayedVendor?.participacao ?? 0)}
                                       </p>
                                       <p className="text-[10px] text-muted-foreground mono-value">
                                         {formatCompactNumber(displayed.value)}
                                       </p>
                                     </div>
                                   ) : (
                                     <div className="text-center animate-in fade-in-0 duration-200">
                                       <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
                                       <p className="text-lg font-bold mono-value">{formatCompactNumber(totalFat)}</p>
                                       <p className="text-[10px] text-muted-foreground">
                                         {pizzaData.length} vendedores
                                       </p>
                                     </div>
                                   )}
                                 </div>
                               </div>
                               {/* Legenda interativa premium */}
                               <div className="grid grid-cols-2 gap-1 mt-3">
                                 {pizzaData.map((p, idx) => {
                                   const sel = selectedVendedorTop === p.codigo;
                                   const hov = hoveredPizzaIdx === idx;
                                   const v = vendedoresComParticipacao.find(x => x.codigo === p.codigo);
                                   return (
                                     <button
                                       key={String(p.codigo)}
                                       onMouseEnter={() => setHoveredPizzaIdx(idx)}
                                       onMouseLeave={() => setHoveredPizzaIdx(null)}
                                       onClick={() => setSelectedVendedorTop(sel ? null : p.codigo)}
                                       className={cn(
                                         "group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] transition-all duration-200 border",
                                         sel
                                           ? "bg-muted border-border shadow-sm scale-[1.02]"
                                           : hov
                                           ? "bg-muted/60 border-border/60"
                                           : "border-transparent hover:bg-muted/40",
                                         selectedVendedorTop && !sel && "opacity-40"
                                       )}
                                       style={sel ? { boxShadow: `0 0 12px ${p.color}33` } : undefined}
                                     >
                                       <span
                                         className={cn("h-2 w-2 rounded-sm shrink-0 transition-transform", hov && "scale-125")}
                                         style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
                                       />
                                       <span className="truncate font-medium flex-1 text-left">{p.name}</span>
                                       <span className="font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                                         {formatPercent(v?.participacao ?? 0)}
                                       </span>
                                     </button>
                                   );
                                 })}
                               </div>
                             </>
                           );
                         })()}
                       </CardContent>
                     </Card>

                     {/* Métricas reativas premium */}
                     <Card className={cn(
                       "overflow-hidden border-border/60 transition-all duration-300",
                       focused && "ring-1 ring-primary/40 shadow-[0_0_25px_-5px_hsl(var(--primary)/0.35)]"
                     )}>
                       <CardHeader className="pb-2 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
                         <CardTitle className="text-sm flex items-center justify-between">
                           <span className="flex items-center gap-2">
                             <Percent className="h-4 w-4 text-primary" />
                             {focused ? 'Métricas do Vendedor' : 'Métricas Adicionais'}
                           </span>
                           {focused ? (
                             <Badge variant="outline" className="text-[9px] gap-1 border-primary/40">
                               <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                               {focused.nome.split(' ')[0]}
                             </Badge>
                           ) : (
                             <span className="text-[10px] font-normal text-muted-foreground">Geral</span>
                           )}
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4 pt-4">
                         {/* Margem com anel de progresso */}
                         <div className="flex items-center gap-3">
                           <div className="relative h-14 w-14 shrink-0">
                             <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                               <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                               <circle
                                 cx="28" cy="28" r="24" fill="none"
                                 stroke="hsl(142 76% 45%)" strokeWidth="4" strokeLinecap="round"
                                 strokeDasharray={`${Math.min(focusKpis.margem, 100) * 1.508} 1000`}
                                 style={{ transition: 'stroke-dasharray 0.7s ease', filter: 'drop-shadow(0 0 4px hsl(142 76% 45% / 0.5))' }}
                               />
                             </svg>
                             <div className="absolute inset-0 flex items-center justify-center">
                               <span className="text-[10px] font-bold mono-value text-emerald-500">
                                 {Math.round(focusKpis.margem)}%
                               </span>
                             </div>
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margem Média</p>
                             <p className="text-xl font-bold mono-value text-emerald-500">{formatPercent(focusKpis.margem)}</p>
                             <p className="text-[10px] text-muted-foreground mt-0.5">
                               {focusKpis.margem >= kpisCalculados.margemMediaGeral ? '↑' : '↓'} vs {formatPercent(kpisCalculados.margemMediaGeral)} geral
                             </p>
                           </div>
                         </div>

                         {/* Cancelamentos */}
                         <div className="rounded-lg border border-border/40 bg-gradient-to-br from-destructive/5 to-transparent p-3 hover:border-destructive/40 transition-colors">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <div className="h-7 w-7 rounded-md bg-destructive/10 flex items-center justify-center">
                                 <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                               </div>
                               <span className="text-xs text-muted-foreground">Cancelamentos</span>
                             </div>
                             <div className="text-right">
                               <p className="font-bold mono-value text-base text-destructive">
                                 {formatInteger(focusKpis.cancelados)}
                               </p>
                               <p className="text-[9px] text-muted-foreground">pedidos</p>
                             </div>
                           </div>
                         </div>

                         {/* % Devoluções com barra */}
                         <div className="space-y-1.5">
                           <div className="flex justify-between items-center">
                             <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                               <TrendingDown className="h-3 w-3" />
                               % Devoluções
                             </span>
                             <span className={cn(
                               "font-bold mono-value text-base",
                               focusKpis.percDev > 5 ? "text-destructive" : "text-emerald-500"
                             )}>
                               {formatPercent(focusKpis.percDev)}
                             </span>
                           </div>
                           <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                             <div
                               className={cn(
                                 "h-full rounded-full transition-all duration-700",
                                 focusKpis.percDev > 5
                                   ? "bg-gradient-to-r from-orange-400 via-red-500 to-destructive"
                                   : "bg-gradient-to-r from-emerald-400 to-emerald-600"
                               )}
                               style={{
                                 width: `${Math.min(focusKpis.percDev * 10, 100)}%`,
                                 boxShadow: focusKpis.percDev > 5
                                   ? '0 0 10px hsl(var(--destructive) / 0.6)'
                                   : '0 0 10px hsl(142 76% 45% / 0.5)',
                               }}
                             />
                             {/* Marcador de meta 5% */}
                             <div className="absolute top-0 bottom-0 w-px bg-foreground/40" style={{ left: '50%' }} />
                           </div>
                           <p className="text-[9px] text-muted-foreground">Meta: até 5%</p>
                         </div>

                         {/* Detalhes do vendedor focado */}
                         {focused && (
                           <div className="pt-3 mt-1 border-t border-border/40 space-y-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                             <div className="grid grid-cols-2 gap-2">
                               <div className="rounded-md bg-muted/40 p-2">
                                 <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Ticket</p>
                                 <p className="font-bold mono-value text-sm">{formatCurrency(focused.ticketMedio)}</p>
                               </div>
                               <div className="rounded-md bg-muted/40 p-2">
                                 <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Clientes</p>
                                 <p className="font-bold mono-value text-sm">{formatInteger(focused.clientesAtendidos)}</p>
                               </div>
                               <div className="rounded-md bg-muted/40 p-2">
                                 <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Pedidos</p>
                                 <p className="font-bold mono-value text-sm">{formatInteger(focused.qtdPedidos)}</p>
                               </div>
                               <div className="rounded-md bg-muted/40 p-2">
                                 <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Ranking</p>
                                 <p className="font-bold mono-value text-sm flex items-center gap-1">
                                   <Trophy className="h-3 w-3 text-amber-500" /> #{focused.ranking}
                                 </p>
                               </div>
                             </div>
                           </div>
                         )}
                       </CardContent>
                     </Card>
                   </div>
                 </div>
               </>
             );
           })()}
         </TabsContent>
 
        {/* ==================== ABA: EVOLUÇÃO ==================== */}
        <TabsContent value="evolucao" className="space-y-6">
          <EvolucaoTab 
            pedidos={pedidos}
            devolucoes={devolucoes}
            vendedoresPerformance={vendedoresPerformance}
            evolucaoDiaria={evolucaoDiaria}
            appliedFilters={appliedFilters}
          />
        </TabsContent>

       </Tabs>
       <DevolucoesDetalheDialog
         open={devolucoesDialogOpen}
         onOpenChange={setDevolucoesDialogOpen}
         devolucoes={(() => {
           const ini = appliedFilters?.periodo?.inicio ? new Date(appliedFilters.periodo.inicio).getTime() : -Infinity;
           const fim = appliedFilters?.periodo?.fim ? new Date(appliedFilters.periodo.fim).getTime() + 86400000 : Infinity;
           return (devolucoes || []).filter(d => {
             if (!d.data) return true;
             const t = new Date(d.data).getTime();
             if (!Number.isFinite(t)) return true;
             return t >= ini && t <= fim;
           });
         })()}
         periodoLabel={appliedFilters?.periodo ? `${appliedFilters.periodo.inicio} a ${appliedFilters.periodo.fim}` : undefined}
       />
       <ValorTotalDetalheDialog
         open={valorTotalDialogOpen}
         onOpenChange={setValorTotalDialogOpen}
         pedidos={pedidos}
         totalEsperado={kpisCalculados.totalVendido}
         periodoLabel={appliedFilters?.periodo ? `${appliedFilters.periodo.inicio} a ${appliedFilters.periodo.fim}` : undefined}
       />
     </div>
   );
 }
