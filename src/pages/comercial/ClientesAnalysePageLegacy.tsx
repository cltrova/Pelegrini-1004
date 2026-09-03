import { useState, useMemo } from 'react';
import { useComercialData } from '@/hooks/useComercialData';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { ComercialFilters as ComercialFilterBar } from '@/components/comercial/ComercialFilters';
import { ClienteExpandableRow } from '@/components/comercial/ClienteExpandableRow';

import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import {
  Users,
  Search,
  TrendingUp,
  ShoppingCart,
  Building2,
  Eye,
  Trophy,
  LineChart,
  Sparkles,
  MapPin,
  AlertTriangle,
  UserPlus,
  Bot,
  Target,
  Download,
  FileText,
} from 'lucide-react';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { ComercialFilters, ClientePerformance, Pedido } from '@/types/comercial';
import { BrazilMap } from '@/components/comercial/BrazilMap';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useClientesAnalise } from '@/hooks/useComercialAgrupado';
import { ClientesHeroSection } from '@/components/comercial/ClientesHeroSection';
import { EvolucaoVendasHeroChart } from '@/components/comercial/EvolucaoVendasHeroChart';
import { TopClientesRanking } from '@/components/comercial/TopClientesRanking';
import { VendedoresRanking } from '@/components/comercial/VendedoresRanking';
import { InsightsInteligentes, InsightIcons, type InsightItem } from '@/components/comercial/InsightsInteligentes';
import { aplicarPrimeiraCompraClientesApi } from '@/utils/clientesPrimeiraCompraApi';
import { isContextoChevrolet10041, vendedorForcaP1004 } from '@/utils/vendedores1004';

const COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(173, 80%, 40%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 50%)',
  'hsl(330, 70%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(45, 85%, 55%)',
];

const ANOS_DISPONIVEIS = ['2023', '2024', '2025', '2026'];

const hojeInit = new Date();
const anoInit = String(hojeInit.getFullYear());
const mesInit = String(hojeInit.getMonth() + 1).padStart(2, '0');

function derivarPeriodo(anos?: string[], meses?: string[]) {
  const anosOrd = (anos && anos.length ? anos : [anoInit]).slice().sort();
  const mesesOrd = (meses && meses.length ? meses : ['01','02','03','04','05','06','07','08','09','10','11','12']).slice().sort();
  const anoMin = parseInt(anosOrd[0], 10);
  const anoMax = parseInt(anosOrd[anosOrd.length - 1], 10);
  const mesMin = parseInt(mesesOrd[0], 10);
  const mesMax = parseInt(mesesOrd[mesesOrd.length - 1], 10);
  const inicio = `${anoMin}-${String(mesMin).padStart(2,'0')}-01`;
  const isMesAtual = anoMax === hojeInit.getFullYear() && mesMax === hojeInit.getMonth() + 1;
  const diaFim = isMesAtual ? hojeInit.getDate() : new Date(anoMax, mesMax, 0).getDate();
  const fim = `${anoMax}-${String(mesMax).padStart(2,'0')}-${String(diaFim).padStart(2,'0')}`;
  return { inicio, fim };
}

const filtrosIniciais: ComercialFilters = {
  anos: [anoInit],
  meses: [mesInit],
  periodo: derivarPeriodo([anoInit], [mesInit]),
  status: 'todos',
};

function normalizarDataIso(raw?: string | null) {
  if (!raw) return null;
  const iso = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function formatarDataBr(raw?: string | null) {
  const iso = normalizarDataIso(raw);
  if (!iso) return '-';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function periodoNovosClientes(filters: ComercialFilters) {
  if (filters.periodo?.inicio && filters.periodo?.fim) return filters.periodo;
  if (filters.anos?.length || filters.meses?.length) return derivarPeriodo(filters.anos, filters.meses);

  const hoje = new Date();
  const limite = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return {
    inicio: `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-01`,
    fim: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`,
  };
}

export default function ClientesAnalysePageLegacy() {
  const [pendingFilters, setPendingFilters] = useState<ComercialFilters>(filtrosIniciais);
  const [appliedFilters, setAppliedFilters] = useState<ComercialFilters>(filtrosIniciais);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [relatorioNovosOpen, setRelatorioNovosOpen] = useState(false);
  const [relatorioVendedor, setRelatorioVendedor] = useState('todos');
  const [relatorioMinPedidos, setRelatorioMinPedidos] = useState('0');
  const hasFilterChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters);
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const codEmpresaNorm = String(codEmpresaAtiva ?? '').trim();
  const empresaComFilial = filialAtiva
    ? { ...empresa, nome: `${empresa?.nome ?? ''} ${filialAtiva}` }
    : empresa;
  const isEmpresa10041 = codEmpresaNorm === '10041' || isContextoChevrolet10041(codEmpresaAtiva, filialAtiva, empresaComFilial);
  const isEmpresa1004 = codEmpresaNorm === '1004' && !isEmpresa10041;
  const isEmpresaPelegrini = isEmpresa1004 || isEmpresa10041;

  const { 
    clientesPerformance: clientesPerformanceRaw,
    vendedoresPerformance: vendedoresPerformanceRaw,
    pedidos,
    evolucaoMensal,
    kpis,
    vendedoresDisponiveis,
    isLoading, 
    error 
  } = useComercialData(appliedFilters);

  const vendedoresPerformance = useMemo(
    () => isEmpresaPelegrini
      ? vendedoresPerformanceRaw.filter((vendedor) => !vendedorForcaP1004({
          codigo: vendedor.codigo,
          nome: vendedor.nome,
        }))
      : vendedoresPerformanceRaw,
    [isEmpresaPelegrini, vendedoresPerformanceRaw],
  );

  const clientesPerformance = useMemo(
    () => isEmpresaPelegrini
      ? clientesPerformanceRaw.filter((cliente) => !vendedorForcaP1004({
          codigo: cliente.vendedor_codigo,
          nome: cliente.vendedor_nome,
        }))
      : clientesPerformanceRaw,
    [clientesPerformanceRaw, isEmpresaPelegrini],
  );

  const {
    data: clientesAnaliseApi,
    isLoading: isLoadingClientesAnaliseApi,
  } = useClientesAnalise({
    periodo: appliedFilters.periodo,
    enabled: isEmpresaPelegrini,
  });

  const clientesPerformanceComApi = useMemo(
    () => isEmpresaPelegrini
      ? aplicarPrimeiraCompraClientesApi(clientesPerformance, clientesAnaliseApi as Array<Record<string, unknown>>)
      : clientesPerformance,
    [clientesPerformance, clientesAnaliseApi, isEmpresaPelegrini],
  );

  // Vendedores para filtro - usa lista completa da empresa, não só os com performance
  const vendedoresParaFiltro = useMemo(() => {
    const base = vendedoresDisponiveis && vendedoresDisponiveis.length > 0
      ? vendedoresDisponiveis
      : vendedoresPerformance.map(v => ({
      codigo: v.codigo,
      nome: v.nome,
    }));

    return isEmpresaPelegrini
      ? base.filter((vendedor) => !vendedorForcaP1004(vendedor))
      : base;
  }, [isEmpresaPelegrini, vendedoresPerformance, vendedoresDisponiveis]);

  // Clientes filtrados por busca
  const clientesFiltrados = useMemo(() => {
    let result = clientesPerformanceComApi;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.razao.toLowerCase().includes(term) ||
        (c.fantasia?.toLowerCase().includes(term)) ||
        String(c.codigo).includes(term)
      );
    }
    
    // Ordenação
    if (pendingFilters.ordenacao) {
      result = [...result].sort((a, b) => {
        const order = pendingFilters.ordem === 'asc' ? 1 : -1;
        switch (pendingFilters.ordenacao) {
          case 'nome':
            return order * a.razao.localeCompare(b.razao);
          case 'ultima_compra':
            return order * ((a.ultimaCompra || '').localeCompare(b.ultimaCompra || ''));
          case 'dias_sem_compra':
            return order * ((a.diasSemCompra || 0) - (b.diasSemCompra || 0));
          default:
            return order * (b.faturamentoLiquido - a.faturamentoLiquido);
        }
      });
    }
    
    return result;
  }, [clientesPerformanceComApi, searchTerm, pendingFilters]);

  // Dados para gráficos
  const evolucaoVendasMensal = useMemo(() => {
    return evolucaoMensal.map(e => ({
      mes: e.mes,
      vendas: e.vendas,
    }));
  }, [evolucaoMensal]);

  // Agregado diário (para gráfico do mês filtrado quando houver 1 mês)
  const evolucaoVendasDiaria = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.forEach((p: Pedido) => {
      if (p.tipo === 'DEVOLUCAO') return;
      const raw = p.data_pedido || p.data_faturamento;
      if (!raw) return;
      const dia = String(raw).slice(0, 10);
      if (!dia || dia.length < 10) return;
      map.set(dia, (map.get(dia) || 0) + (p.valor_liquido || 0));
    });
    return Array.from(map.entries())
      .map(([dia, vendas]) => ({ dia, vendas }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }, [pedidos]);

  const top5Clientes = useMemo(() => {
    const top5 = clientesPerformance.slice(0, 5);
    const totalTop5 = top5.reduce((acc, c) => acc + c.faturamentoLiquido, 0);
    const totalGeral = clientesPerformance.reduce((acc, c) => acc + c.faturamentoLiquido, 0);
    
    return {
      data: top5.map((c, i) => ({
        name: c.fantasia || c.razao.substring(0, 20),
        value: c.faturamentoLiquido,
        fill: COLORS[i],
      })),
      percentualTotal: totalGeral > 0 ? (totalTop5 / totalGeral) * 100 : 0,
    };
  }, [clientesPerformance]);

  const top10Barras = useMemo(() => {
    return clientesPerformance.slice(0, 10).map((c, i) => ({
      name: (c.fantasia || c.razao).substring(0, 25),
      valor: c.faturamentoLiquido,
      fill: COLORS[i % COLORS.length],
    }));
  }, [clientesPerformance]);

  const clientesPorVendedor = useMemo(() => {
    const vendedorMap = new Map<string, number>();
    const fotoPorNome = new Map<string, string>();

    vendedoresPerformance.forEach(v => {
      if (v.foto) fotoPorNome.set(v.nome, v.foto);
    });

    clientesPerformance.forEach(c => {
      const vendedor = c.vendedor_nome || 'Sem vendedor';
      vendedorMap.set(vendedor, (vendedorMap.get(vendedor) || 0) + 1);
    });

    return Array.from(vendedorMap.entries())
      .map(([nome, qtd]) => ({ nome, qtd, avatarUrl: fotoPorNome.get(nome) }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [clientesPerformance, vendedoresPerformance]);

  const vendedoresChartData = useMemo(() => {
    const vendedoresComVenda = vendedoresPerformance.filter((v) => Math.abs(Number(v.faturamentoLiquido || 0)) > 0.009);
    const vendedoresVisiveis = isEmpresa1004 ? vendedoresComVenda : vendedoresComVenda.slice(0, 12);

    return vendedoresVisiveis.map(v => ({
      nome: v.nome,
      valor: v.faturamentoLiquido,
    }));
  }, [isEmpresa1004, vendedoresPerformance]);

  // Variação MoM por vendedor (faturamento mês atual vs. anterior) — usa pedidos já carregados
  const variacoesVendedores = useMemo(() => {
    const perVendMes = new Map<string, Map<string, number>>();
    const codToNome = new Map<string, string>();
    clientesPerformance.forEach(c => {
      if (c.vendedor_codigo !== undefined && c.vendedor_nome) {
        codToNome.set(String(c.vendedor_codigo), c.vendedor_nome);
      }
    });
    pedidos.forEach((p: Pedido) => {
      const nome = p.vendedor_nome || codToNome.get(String(p.vendedor_codigo)) || 'Sem vendedor';
      const mes = (p.data_pedido || '').substring(0, 7);
      if (!mes) return;
      if (!perVendMes.has(nome)) perVendMes.set(nome, new Map());
      const m = perVendMes.get(nome)!;
      m.set(mes, (m.get(mes) || 0) + (p.valor_liquido || 0));
    });
    const result = new Map<string, number>();
    perVendMes.forEach((m, nome) => {
      const meses = Array.from(m.keys()).sort();
      if (meses.length < 2) return;
      const atual = m.get(meses[meses.length - 1]) || 0;
      const anterior = m.get(meses[meses.length - 2]) || 0;
      if (anterior > 0) result.set(nome, ((atual - anterior) / anterior) * 100);
    });
    return result;
  }, [pedidos, clientesPerformance]);


  // Evolução top 5 por mês
  const evolucaoTop5 = useMemo(() => {
    const top5Codigos = clientesPerformance.slice(0, 5).map(c => c.codigo);
    const mesMap = new Map<string, Record<string, number>>();
    
    pedidos.filter(p => top5Codigos.includes(p.cliente_codigo)).forEach(p => {
      const mes = p.data_pedido.substring(0, 7);
      const clienteKey = String(p.cliente_codigo);
      const existing = mesMap.get(mes) || {};
      existing[clienteKey] = (existing[clienteKey] || 0) + (p.valor_liquido || 0);
      mesMap.set(mes, existing);
    });
    
    return Array.from(mesMap.entries())
      .map(([mes, valores]) => ({ mes, ...valores }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [pedidos, clientesPerformance]);

  // Variação MoM por cliente (usa pedidos já carregados)
  const variacoesTop10 = useMemo(() => {
    const top10Cods = clientesPerformance.slice(0, 10).map(c => String(c.codigo));
    const setCods = new Set(top10Cods);
    const perCliMes = new Map<string, Map<string, number>>();
    pedidos.forEach(p => {
      const cod = String(p.cliente_codigo);
      if (!setCods.has(cod)) return;
      const mes = (p.data_pedido || '').substring(0, 7);
      if (!mes) return;
      if (!perCliMes.has(cod)) perCliMes.set(cod, new Map());
      const m = perCliMes.get(cod)!;
      m.set(mes, (m.get(mes) || 0) + (p.valor_liquido || 0));
    });
    const result = new Map<string, number>();
    perCliMes.forEach((m, cod) => {
      const meses = Array.from(m.keys()).sort();
      if (meses.length < 2) return;
      const atual = m.get(meses[meses.length - 1]) || 0;
      const anterior = m.get(meses[meses.length - 2]) || 0;
      if (anterior > 0) result.set(cod, ((atual - anterior) / anterior) * 100);
    });
    return result;
  }, [pedidos, clientesPerformance]);


  // Clientes em risco e novos
  const clientesEmRisco = useMemo(() => {
    const hoje = new Date();
    return clientesPerformanceComApi.filter(c => (c.diasSemCompra || 0) > 90).slice(0, 10);
  }, [clientesPerformanceComApi]);

  const periodoNovos = useMemo(() => periodoNovosClientes(appliedFilters), [appliedFilters]);

  const novosClientes = useMemo(() => {
    return clientesPerformanceComApi.filter(c => {
      const primeiraCompra = normalizarDataIso(c.primeiraCompra);
      if (!primeiraCompra) return false;
      return primeiraCompra >= periodoNovos.inicio && primeiraCompra <= periodoNovos.fim;
    });
  }, [clientesPerformanceComApi, periodoNovos]);

  const resumoNovosClientes = useMemo(() => {
    const ordenados = [...novosClientes].sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);
    const volume = ordenados.reduce((sum, cliente) => sum + cliente.faturamentoLiquido, 0);
    const pedidosNovos = ordenados.reduce((sum, cliente) => sum + cliente.totalPedidos, 0);
    const ticketMedioNovos = pedidosNovos > 0 ? volume / pedidosNovos : 0;
    const participacao = kpis.faturamentoLiquido > 0 ? (volume / kpis.faturamentoLiquido) * 100 : 0;
    return {
      quantidade: ordenados.length,
      volume,
      pedidos: pedidosNovos,
      ticketMedio: ticketMedioNovos,
      participacao,
      topClientes: ordenados.slice(0, 5),
    };
  }, [novosClientes, kpis.faturamentoLiquido]);

  const vendedoresNovosClientes = useMemo(() => {
    return Array.from(new Set(novosClientes.map(c => c.vendedor_nome).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
  }, [novosClientes]);

  const relatorioNovosClientes = useMemo(() => {
    const minPedidos = Math.max(0, Number(relatorioMinPedidos) || 0);
    return [...novosClientes]
      .filter(c => relatorioVendedor === 'todos' || c.vendedor_nome === relatorioVendedor)
      .filter(c => (c.totalPedidos || 0) >= minPedidos)
      .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);
  }, [novosClientes, relatorioVendedor, relatorioMinPedidos]);

  const resumoRelatorioNovos = useMemo(() => {
    const volume = relatorioNovosClientes.reduce((sum, cliente) => sum + cliente.faturamentoLiquido, 0);
    const pedidosRelatorio = relatorioNovosClientes.reduce((sum, cliente) => sum + (cliente.totalPedidos || 0), 0);
    return {
      quantidade: relatorioNovosClientes.length,
      volume,
      pedidos: pedidosRelatorio,
      ticketMedio: pedidosRelatorio > 0 ? volume / pedidosRelatorio : 0,
    };
  }, [relatorioNovosClientes]);

  const exportarRelatorioNovosClientes = () => {
    const linhas = relatorioNovosClientes.map(cliente => ({
      codigo: String(cliente.codigo ?? ''),
      cliente: cliente.fantasia || cliente.razao || '',
      vendedor: cliente.vendedor_nome || '',
      cidade: cliente.cidade || '',
      uf: cliente.uf || '',
      primeira_compra: formatarDataBr(cliente.primeiraCompra),
      pedidos: String(cliente.totalPedidos || 0),
      faturamento_liquido: String((cliente.faturamentoLiquido || 0).toFixed(2)).replace('.', ','),
      ticket_medio: String((cliente.ticketMedio || 0).toFixed(2)).replace('.', ','),
    }));
    const cabecalho = ['codigo', 'cliente', 'vendedor', 'cidade', 'uf', 'primeira_compra', 'pedidos', 'faturamento_liquido', 'ticket_medio'];
    const csv = [
      cabecalho.join(';'),
      ...linhas.map(linha => cabecalho.map(campo => `"${String(linha[campo as keyof typeof linha]).replace(/"/g, '""')}"`).join(';')),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `novos-clientes-1004-${periodoNovos.inicio}-${periodoNovos.fim}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Distribuição por UF
  const distribuicaoPorUF = useMemo(() => {
     const ufMap = new Map<string, { faturamento: number; pedidos: number; clientes: Set<string | number>; cidades: Map<string, { faturamento: number; pedidos: number; clientes: Set<string | number> }> }>();
     
    clientesPerformance.forEach(c => {
      const uf = c.uf || 'N/D';
       const cidade = c.cidade || 'N/D';
       
       if (!ufMap.has(uf)) {
         ufMap.set(uf, { faturamento: 0, pedidos: 0, clientes: new Set(), cidades: new Map() });
       }
       
       const ufData = ufMap.get(uf)!;
       ufData.faturamento += c.faturamentoLiquido;
       ufData.pedidos += c.totalPedidos;
       ufData.clientes.add(c.codigo);
       
       if (!ufData.cidades.has(cidade)) {
         ufData.cidades.set(cidade, { faturamento: 0, pedidos: 0, clientes: new Set() });
       }
       
       const cidadeData = ufData.cidades.get(cidade)!;
       cidadeData.faturamento += c.faturamentoLiquido;
       cidadeData.pedidos += c.totalPedidos;
       cidadeData.clientes.add(c.codigo);
    });
     
    return Array.from(ufMap.entries())
       .map(([uf, data]) => ({
         uf,
         nome: uf,
         faturamento: data.faturamento,
         pedidos: data.pedidos,
         clientes: data.clientes.size,
         cidades: Array.from(data.cidades.entries())
           .map(([cidade, cidadeData]) => ({
             cidade,
             faturamento: cidadeData.faturamento,
             pedidos: cidadeData.pedidos,
             clientes: cidadeData.clientes.size,
           }))
           .sort((a, b) => b.faturamento - a.faturamento),
       }))
       .sort((a, b) => b.faturamento - a.faturamento);
  }, [clientesPerformance]);

  // Evolução mensal por cliente para expandable row
  const getEvolucaoCliente = (clienteCodigo: string | number) => {
    const mesMap = new Map<string, number>();
    pedidos.filter(p => p.cliente_codigo === clienteCodigo).forEach(p => {
      const mes = p.data_pedido.substring(0, 7);
      mesMap.set(mes, (mesMap.get(mes) || 0) + (p.valor_liquido || 0));
    });
    return Array.from(mesMap.entries())
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  };

  const initialsFromName = (nome: string) => {
    const parts = (nome || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Sparkline por vendedor (últimos 6 meses de faturamento)
  const sparklinePorVendedor = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const codToNome = new Map<string, string>();
    clientesPerformance.forEach(c => {
      if (c.vendedor_codigo !== undefined && c.vendedor_nome) codToNome.set(String(c.vendedor_codigo), c.vendedor_nome);
    });
    pedidos.forEach(p => {
      const nome = p.vendedor_nome || codToNome.get(String(p.vendedor_codigo)) || 'Sem vendedor';
      const mes = (p.data_pedido || '').substring(0, 7);
      if (!mes) return;
      if (!map.has(nome)) map.set(nome, new Map());
      const m = map.get(nome)!;
      m.set(mes, (m.get(mes) || 0) + (p.valor_liquido || 0));
    });
    const out = new Map<string, { mes: string; valor: number }[]>();
    map.forEach((m, nome) => {
      const arr = Array.from(m.entries()).map(([mes, valor]) => ({ mes, valor })).sort((a, b) => a.mes.localeCompare(b.mes));
      out.set(nome, arr.slice(-6));
    });
    return out;
  }, [pedidos, clientesPerformance]);

  const formatMes = (mes: string) => {
    const [year, month] = mes.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
  };

  if (isLoading || (isEmpresaPelegrini && isLoadingClientesAnaliseApi)) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-10 space-y-8">
        {/* Hero skeleton */}
        <div className="rounded-lg border border-border/60 bg-card p-6 md:p-8">
          <div className="mb-6 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="h-6 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-border/60 bg-card"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
        {/* Filtros skeleton */}
        <div className="h-14 animate-pulse rounded-lg border border-border/60 bg-card" />
        {/* Tabs skeleton */}
        <div className="h-10 animate-pulse rounded-lg bg-muted/50" />
        {/* Hero chart skeleton */}
        <div className="h-[520px] animate-pulse rounded-lg border border-border/60 bg-card" />
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-lg border border-border/60 bg-card"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }


  if (error) return <ErrorState message="Erro ao carregar clientes" />;

  if (!clientesPerformance.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <Target className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhum dado disponível</h2>
        <p className="text-muted-foreground">Selecione um período para visualizar os dados de clientes.</p>
      </div>
    );
  }

  // === Insights Inteligentes (cálculos derivados dos dados já carregados) ===
  const insightsItems: InsightItem[] = (() => {
    const items: InsightItem[] = [];

    // Vendedor que mais cresceu
    let vendMax: { nome: string; pct: number } | null = null;
    variacoesVendedores.forEach((pct, nome) => {
      if (!isFinite(pct)) return;
      if (!vendMax || pct > vendMax.pct) vendMax = { nome, pct };
    });
    if (vendMax && vendMax.pct > 0) {
      items.push({
        id: 'vendedor-cresceu',
        label: 'Vendedor que mais cresceu',
        emoji: '📈',
        icon: InsightIcons.TrendingUp,
        tone: 'emerald',
        headline: vendMax.nome,
        detail: `Crescimento de ${formatPercent(vendMax.pct)} vs. mês anterior`,
      });
    }

    // Cliente que mais cresceu (dentro dos que temos variação)
    let cliMax: { nome: string; pct: number } | null = null;
    variacoesTop10.forEach((pct, cod) => {
      if (!isFinite(pct)) return;
      if (!cliMax || pct > cliMax.pct) {
        const c = clientesPerformance.find(x => String(x.codigo) === cod);
        if (c) cliMax = { nome: c.fantasia || c.razao, pct };
      }
    });
    if (cliMax && cliMax.pct > 0) {
      items.push({
        id: 'cliente-cresceu',
        label: 'Cliente que mais cresceu',
        emoji: '🚀',
        icon: InsightIcons.ArrowUpRight,
        tone: 'sky',
        headline: cliMax.nome,
        detail: `Alta de ${formatPercent(cliMax.pct)} vs. mês anterior`,
      });
    }

    // Concentração da carteira (Top 5)
    items.push({
      id: 'concentracao',
      label: 'Concentração da carteira',
      emoji: '🎯',
      icon: InsightIcons.PieChart,
      tone: top5Clientes.percentualTotal > 60 ? 'amber' : 'violet',
      headline: `${formatPercent(top5Clientes.percentualTotal)} nos Top 5`,
      detail:
        top5Clientes.percentualTotal > 60
          ? 'Alta concentração — avalie diversificação da base.'
          : 'Distribuição saudável entre os principais clientes.',
    });

    // Vendedores acima da média
    const totalVend = vendedoresPerformance.reduce((s, v) => s + v.faturamentoLiquido, 0);
    const mediaVend = vendedoresPerformance.length ? totalVend / vendedoresPerformance.length : 0;
    const acimaMedia = vendedoresPerformance.filter(v => v.faturamentoLiquido > mediaVend).length;
    if (vendedoresPerformance.length > 0) {
      items.push({
        id: 'vend-acima-media',
        label: 'Vendedores acima da média',
        emoji: '⭐',
        icon: InsightIcons.Users,
        tone: 'primary',
        headline: `${acimaMedia} de ${vendedoresPerformance.length}`,
        detail: `Faturamento médio de ${formatCurrency(mediaVend)} por vendedor no período.`,
      });
    }

    // Clientes em queda (usa clientesEmRisco: > 90 dias sem compra)
    if (clientesEmRisco.length > 0) {
      items.push({
        id: 'clientes-queda',
        label: 'Clientes em queda',
        emoji: '⚠️',
        icon: InsightIcons.AlertTriangle,
        tone: 'rose',
        headline: `${clientesEmRisco.length} inativos`,
        detail: 'Sem compras há mais de 90 dias — priorize retomada de contato.',
      });
    }

    // Oportunidades: novos clientes com potencial
    if (novosClientes.length > 0) {
      const topNovo = [...novosClientes].sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido)[0];
      items.push({
        id: 'oportunidades',
        label: 'Oportunidades',
        emoji: '💡',
        icon: InsightIcons.Lightbulb,
        tone: 'amber',
        headline: `${novosClientes.length} novos clientes`,
        detail: topNovo
          ? `Destaque: ${topNovo.fantasia || topNovo.razao} — ${formatCurrency(topNovo.faturamentoLiquido)}`
          : 'Base em expansão no período.',
      });
    }

    return items;
  })();



  const heroNode = (
    <ClientesHeroSection
      qtdClientes={kpis.qtdClientes}
      novosClientes={novosClientes.length}
      faturamentoLiquido={kpis.faturamentoLiquido}
      ticketMedio={kpis.ticketMedio}
      qtdVendedores={kpis.qtdVendedores}
      evolucaoMensal={evolucaoVendasMensal}
    />
  );

  return (
    <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-10 space-y-8 animate-fade-in">
      {/* Totalizadores (hero) */}
      {heroNode}

      {/* Filtros */}
      <ComercialFilterBar
        filters={pendingFilters}
        onFiltersChange={setPendingFilters}
        onBuscar={() => setAppliedFilters(pendingFilters)}
        hasChanges={hasFilterChanges}
        anos={ANOS_DISPONIVEIS}
        vendedores={vendedoresParaFiltro}
        showVendedorFilter
        collapsible
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-11 w-full grid-cols-5 rounded-lg border border-border/60 bg-muted/40 p-1 [&_[data-state=active]]:bg-primary [&_[data-state=active]]:text-primary-foreground [&_button]:rounded-md [&_button]:transition-colors">
          <TabsTrigger value="visao-geral" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="top-clientes" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Top Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="por-vendedor" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Por Vendedor</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Insights</span>
          </TabsTrigger>
          <TabsTrigger value="geografico" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Geográfico</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-6 animate-fade-in focus-visible:outline-none">
          {/* Protagonista: Evolução de Vendas Mensal */}
          <EvolucaoVendasHeroChart data={evolucaoVendasMensal} />

          {/* Insights Inteligentes */}
          {insightsItems.length > 0 && <InsightsInteligentes items={insightsItems} />}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TopClientesRanking
              clientes={clientesPerformance.slice(0, 10)}
              variacoesPorCodigo={variacoesTop10}
              totalGeral={clientesPerformance.reduce((s, c) => s + c.faturamentoLiquido, 0)}
            />

            <VendedoresRanking
              vendedores={clientesPorVendedor}
              variacoesPorNome={variacoesVendedores}
            />
          </div>
        </TabsContent>

        {/* Aba Top Clientes */}
        <TabsContent value="top-clientes" className="space-y-4 animate-fade-in focus-visible:outline-none">
          <>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Card>
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-border">
                  {clientesFiltrados.map((cliente, index) => (
                    <ClienteExpandableRow
                      key={String(cliente.codigo)}
                      cliente={cliente}
                      ranking={index + 1}
                      evolucaoMensal={getEvolucaoCliente(cliente.codigo)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </>
        </TabsContent>

        {/* Aba Por Vendedor */}
        <TabsContent value="por-vendedor" className="space-y-6 animate-fade-in focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Valor Total de Vendas por Vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vendedoresChartData}>
                    <defs>
                      <linearGradient id="colorVendedor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="hsl(var(--chart-2))"
                      fill="url(#colorVendedor)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Insights */}
        <TabsContent value="insights" className="space-y-6 animate-fade-in focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clientes em Risco */}
            <Card className="border-warning/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Clientes em Risco
                  <Badge variant="secondary">{clientesEmRisco.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">Sem compras há mais de 90 dias</p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {clientesEmRisco.map(c => (
                      <div key={String(c.codigo)} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.fantasia || c.razao}</p>
                          <p className="text-xs text-muted-foreground">
                            Última compra: {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : 'Nunca'}
                          </p>
                        </div>
                        <Badge variant="destructive">{c.diasSemCompra} dias</Badge>
                      </div>
                    ))}
                    {!clientesEmRisco.length && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum cliente em risco identificado 🎉
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Novos Clientes */}
            <Card className="border-success/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-success" />
                  Novos Clientes
                  <Badge variant="secondary">{novosClientes.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">Primeira compra no último mês</p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {novosClientes.map(c => (
                      <div key={String(c.codigo)} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.fantasia || c.razao}</p>
                          <p className="text-xs text-muted-foreground">
                            Primeira compra: {c.primeiraCompra ? new Date(c.primeiraCompra).toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                        <span className="text-sm font-medium mono-value">{formatCurrency(c.faturamentoLiquido)}</span>
                      </div>
                    ))}
                    {!novosClientes.length && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum novo cliente no período
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Análise IA */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Análise IA
              </CardTitle>
              <p className="text-sm text-muted-foreground">Insights automáticos baseados nos dados</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h4 className="font-medium mb-2">📈 Tendência</h4>
                  <p className="text-sm text-muted-foreground">
                    {evolucaoMensal.length >= 2 && 
                    evolucaoMensal[evolucaoMensal.length - 1].vendas > evolucaoMensal[evolucaoMensal.length - 2].vendas
                      ? 'Vendas em crescimento no último mês.'
                      : 'Vendas estáveis ou em queda no último mês.'}
                  </p>
                </div>
                <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
                  <h4 className="font-medium mb-2">⚠️ Atenção</h4>
                  <p className="text-sm text-muted-foreground">
                    {clientesEmRisco.length > 0
                      ? `${clientesEmRisco.length} clientes podem estar inativos.`
                      : 'Nenhum cliente em risco identificado.'}
                  </p>
                </div>
                <div className="p-4 bg-success/5 rounded-lg border border-success/20">
                  <h4 className="font-medium mb-2">✨ Destaque</h4>
                  <p className="text-sm text-muted-foreground">
                    Top 5 clientes representam {formatPercent(top5Clientes.percentualTotal)} do faturamento total.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Geográfico */}
        <TabsContent value="geografico" className="space-y-4 animate-fade-in focus-visible:outline-none">
           <BrazilMap data={distribuicaoPorUF} />
        </TabsContent>

      </Tabs>

      <Dialog open={relatorioNovosOpen} onOpenChange={setRelatorioNovosOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden border-border/70 bg-background p-0">
          <DialogHeader className="border-b border-border/60 bg-card/70 px-6 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5 text-primary" />
                  Relatorio de novos clientes
                </DialogTitle>
                <DialogDescription>
                  Cadastros recentes com primeira compra entre {formatarDataBr(periodoNovos.inicio)} e {formatarDataBr(periodoNovos.fim)}.
                </DialogDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={exportarRelatorioNovosClientes}
                disabled={!relatorioNovosClientes.length}
                className="shrink-0"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vendedor</p>
                <Select value={relatorioVendedor} onValueChange={setRelatorioVendedor}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos os vendedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os vendedores</SelectItem>
                    {vendedoresNovosClientes.map(vendedor => (
                      <SelectItem key={vendedor} value={vendedor}>{vendedor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Min. vendas</p>
                <Input
                  type="number"
                  min={0}
                  value={relatorioMinPedidos}
                  onChange={(event) => setRelatorioMinPedidos(event.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Clientes</p>
                <p className="mono-value mt-2 text-2xl font-black text-foreground">{resumoRelatorioNovos.quantidade.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Volume</p>
                <p className="mono-value mt-2 text-xl font-black text-emerald-400">{formatCurrency(resumoRelatorioNovos.volume)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vendas</p>
                <p className="mono-value mt-2 text-2xl font-black text-foreground">{resumoRelatorioNovos.pedidos.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ticket medio</p>
                <p className="mono-value mt-2 text-xl font-black text-foreground">{formatCurrency(resumoRelatorioNovos.ticketMedio)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="grid grid-cols-[minmax(220px,1.7fr)_minmax(130px,0.9fr)_110px_130px_120px] gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <span>Cliente</span>
                <span>Vendedor</span>
                <span>1a compra</span>
                <span className="text-right">Volume</span>
                <span className="text-right">Vendas</span>
              </div>
              <ScrollArea className="max-h-[360px]">
                <div className="divide-y divide-border/50">
                  {relatorioNovosClientes.map(cliente => (
                    <div
                      key={String(cliente.codigo)}
                      className="grid grid-cols-[minmax(220px,1.7fr)_minmax(130px,0.9fr)_110px_130px_120px] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-primary/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{cliente.fantasia || cliente.razao}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || 'Sem cidade informada'}
                        </p>
                      </div>
                      <span className="truncate text-muted-foreground">{cliente.vendedor_nome || '-'}</span>
                      <span className="text-muted-foreground">{formatarDataBr(cliente.primeiraCompra)}</span>
                      <span className="mono-value text-right font-bold text-emerald-400">{formatCurrency(cliente.faturamentoLiquido)}</span>
                      <span className="text-right font-semibold text-foreground">{(cliente.totalPedidos || 0).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                  {!relatorioNovosClientes.length && (
                    <div className="px-4 py-12 text-center">
                      <p className="font-semibold text-foreground">Nenhum novo cliente encontrado</p>
                      <p className="mt-1 text-sm text-muted-foreground">Ajuste o vendedor ou a quantidade minima de vendas.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
