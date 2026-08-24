import { useMemo, useState, useCallback, useEffect } from 'react';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { useComercialData } from '@/hooks/useComercialData';
import { useCampanhas } from '@/hooks/useCampanhas';
import { LoadingState } from '@/components/common/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Award, TrendingUp, TrendingDown, PieChart as PieIcon, LineChart as LineIcon, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComposicaoVendasTab } from '@/components/comercial/ComposicaoVendasTab';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { ProdutoItem } from '@/types/comercialProdutos';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import {
  ComercialFilters,
  getComercialFiltersSummary,
  countActiveFilters,
} from '@/components/comercial/ComercialFilters';


const ANO_ATUAL = 2026;
const ANO_ANTERIOR = 2025;
const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Cores para o gráfico de pizza (mantêm estética moderna, sem 3D)
const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 55%)',
  'hsl(280 65% 60%)',
  'hsl(340 82% 60%)',
  'hsl(180 65% 45%)',
  'hsl(24 90% 55%)',
  'hsl(210 40% 60%)',
  'hsl(160 60% 45%)',
  'hsl(260 60% 65%)',
];

const MARCAS_POR_CODIGO: Record<string, string> = {
  '64': 'PFERD',
  '90': 'VSM',
  '8': 'TRYTECH',
  '156': 'CARRARA',
  '446': 'RHODIUS',
  '24': 'STIER ACESSÓRIOS',
  '377': 'STIER RESINA',
  '425': 'STIER GAXETA',
  '59': 'CHESTERTON IL&MRO',
  'SERV': 'SERVIÇOS',
  '707': 'SERVIÇOS',
};

// Nomes que vêm do ERP e precisam ser normalizados para o nome canônico exibido
const MARCAS_POR_NOME: Record<string, string> = {
  'SERVICO': 'SERVIÇOS',
  'SERVICOS': 'SERVIÇOS',
  'SERVIÇO': 'SERVIÇOS',
};

function normalizaCodigoMarca(valor: unknown): string {
  return valor == null ? '' : String(valor).trim().replace(/^0+/, '');
}

function resolverMarcaNome(marcaRaw: unknown, codMarcaRaw: unknown): string {
  const cod = String(codMarcaRaw ?? '').trim();
  if (cod && MARCAS_POR_CODIGO[cod]) return MARCAS_POR_CODIGO[cod];
  const codNum = normalizaCodigoMarca(codMarcaRaw);
  if (codNum && MARCAS_POR_CODIGO[codNum]) return MARCAS_POR_CODIGO[codNum];

  const nome = marcaRaw == null ? '' : String(marcaRaw).trim();
  const nomeUpper = nome.toUpperCase();
  if (MARCAS_POR_NOME[nomeUpper]) return MARCAS_POR_NOME[nomeUpper];
  if (nome && !/^\d+$/.test(nome)) return nome;

  const codNome = normalizaCodigoMarca(nome);
  if (codNome && MARCAS_POR_CODIGO[codNome]) return MARCAS_POR_CODIGO[codNome];
  return cod || nome || 'SEM MARCA';
}

function getMarcaNome(it: ProdutoItem): string {
  return resolverMarcaNome(it.marca, it.cod_marca);
}
function getMarcaKey(it: ProdutoItem): string {
  return getMarcaNome(it).toUpperCase();
}
function getAno(it: ProdutoItem): number | null {
  const d = it.data_faturamento || it.data_pedido || '';
  if (!d) return null;
  const y = parseInt(String(d).substring(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}
function getMes(it: ProdutoItem): number | null {
  const d = it.data_faturamento || it.data_pedido || '';
  if (!d) return null;
  const m = parseInt(String(d).substring(5, 7), 10);
  return m >= 1 && m <= 12 ? m : null;
}

export default function MarcasPage() {
  // Carrega itens cobrindo 2025 e 2026 completos
  const fetchFilters: ComercialFiltersType = useMemo(() => ({
    periodo: { inicio: `${ANO_ANTERIOR}-01-01`, fim: `${ANO_ATUAL}-12-31` },
  } as any), []);

  const { produtos, isLoading } = useComercialProdutos(fetchFilters);
  const { pedidos, vendedoresDisponiveis, isLoading: loadingPedidos } = useComercialData(fetchFilters);
  const { campanhas } = useCampanhas();

  // ---- Filtros interativos (barra de filtros no topo) ----
  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType>({});
  const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const it of produtos) {
      const nome = getMarcaNome(it);
      if (!nome || nome === 'SEM MARCA') continue;
      set.add(nome);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [produtos]);


  const handleBuscar = useCallback(() => {
    setAppliedFilters({ ...pendingFilters });
  }, [pendingFilters]);
  const handleLimpar = useCallback(() => {
    setPendingFilters({});
    setAppliedFilters({});
  }, []);
  const hasChanges = useMemo(
    () => JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters),
    [pendingFilters, appliedFilters],
  );

  // Conjuntos para aplicar filtros nas agregações
  const marcaSet = useMemo(() => {
    const list = appliedFilters.marcas && appliedFilters.marcas.length > 0
      ? appliedFilters.marcas
      : (appliedFilters.marca ? [appliedFilters.marca] : []);
    return new Set(list.map((m) => m.toUpperCase()));
  }, [appliedFilters.marcas, appliedFilters.marca]);

  const vendedorSet = useMemo(() => {
    const list = appliedFilters.vendedores && appliedFilters.vendedores.length > 0
      ? appliedFilters.vendedores.map(String)
      : (appliedFilters.vendedor != null ? [String(appliedFilters.vendedor)] : []);
    return new Set(list);
  }, [appliedFilters.vendedores, appliedFilters.vendedor]);

  const tipoFiltro = appliedFilters.tipo && appliedFilters.tipo !== 'todos' ? appliedFilters.tipo : null;

  const produtoPassaFiltro = useCallback((it: ProdutoItem) => {
    if (marcaSet.size > 0 && !marcaSet.has(getMarcaKey(it))) return false;
    if (vendedorSet.size > 0) {
      const v = String((it as any).vendedor_codigo ?? (it as any).cod_vendedor_externo ?? (it as any).cod_vendedor_interno ?? '');
      if (!vendedorSet.has(v)) return false;
    }
    if (tipoFiltro) {
      const t = String((it as any).tipo ?? 'PEDIDO').toUpperCase();
      if (t !== tipoFiltro) return false;
    }
    return true;
  }, [marcaSet, vendedorSet, tipoFiltro]);

  const pedidoPassaFiltro = useCallback((p: any) => {
    if (marcaSet.size > 0) {
      const key = resolverMarcaNome(p.marca, p.cod_marca).toUpperCase();
      if (!marcaSet.has(key)) return false;
    }
    if (vendedorSet.size > 0) {
      const v = String(p.cod_vendedor_meta ?? p.cod_vendedor_externo ?? p.cod_vendedor_interno ?? p.vendedor_codigo ?? '');
      if (!vendedorSet.has(v)) return false;
    }
    if (tipoFiltro) {
      const t = String(p.tipo ?? 'PEDIDO').toUpperCase();
      if (t !== tipoFiltro) return false;
    }
    return true;
  }, [marcaSet, vendedorSet, tipoFiltro]);



  const produtosFiltrados = useMemo(() => produtos.filter(produtoPassaFiltro), [produtos, produtoPassaFiltro]);
  const pedidosFiltrados = useMemo(() => (pedidos ?? []).filter(pedidoPassaFiltro), [pedidos, pedidoPassaFiltro]);



  // ---- Meta 2026 por marca (fonte primária: JSON de pedidos) ----
  // Cada pedido traz valor_meta + cod_vendedor_meta + cod_marca/marca.
  // Meta anual da marca = SOMA de MAX(valor_meta) por (mes × vendedor_meta × marca) em 2026.
  const metaPorMarca2026 = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();

    // 1) Tenta pelo JSON de pedidos (fonte oficial do ERP)
    const maxPorChave = new Map<string, { marca: string; valor: number }>();
    for (const p of pedidosFiltrados) {
      const anyP = p as any;
      const meta = Number(anyP.valor_meta ?? 0);
      if (!meta || meta <= 0) continue;
      const dref = (p.data_faturamento || p.data_pedido || '').toString();
      if (!dref.startsWith(String(ANO_ATUAL))) continue;
      const mes = dref.substring(0, 7);
      const codVendMeta = String(anyP.cod_vendedor_meta ?? anyP.cod_vendedor_externo ?? anyP.cod_vendedor_interno ?? p.vendedor_codigo ?? '').trim();
      const marcaExib = resolverMarcaNome(anyP.marca, anyP.cod_marca);
      const marcaKey = marcaExib.toUpperCase();
      if (!mes || !codVendMeta) continue;
      const key = `${mes}|${codVendMeta}|${marcaKey}`;
      const atual = maxPorChave.get(key);
      if (!atual || meta > atual.valor) maxPorChave.set(key, { marca: marcaExib, valor: meta });
    }
    if (maxPorChave.size > 0) {
      for (const { marca, valor } of maxPorChave.values()) {
        const key = marca.toUpperCase();
        map.set(key, (map.get(key) || 0) + valor);
      }
      return map;
    }

    // 2) Fallback: campanhas ativas em 2026
    for (const c of campanhas ?? []) {
      const ini = (c.data_inicio || '').toString().substring(0, 7);
      const fim = (c.data_fim || '').toString().substring(0, 7);
      if (!ini || !fim) continue;
      const [ysRaw, msRaw] = ini.split('-').map(Number);
      const [yeRaw, meRaw] = fim.split('-').map(Number);
      if (!ysRaw || !msRaw || !yeRaw || !meRaw) continue;
      let mesesEm2026 = 0;
      let y = ysRaw, m = msRaw;
      for (let i = 0; i < 120; i++) {
        if (y === ANO_ATUAL) mesesEm2026++;
        if (y === yeRaw && m === meRaw) break;
        m++; if (m > 12) { m = 1; y++; }
        if (y > ANO_ATUAL + 1) break;
      }
      if (!mesesEm2026) continue;
      for (const cm of c.marcas || []) {
        const key = (cm.marca || '').toString().trim().toUpperCase();
        const meta = Number(cm.meta_mensal || 0) * mesesEm2026;
        if (!key || !meta) continue;
        map.set(key, (map.get(key) || 0) + meta);
      }
    }



    return map;
  }, [pedidosFiltrados, campanhas]);

  // ---- Meta 2026 por marca × mês (fonte primária: JSON de pedidos) ----
  // Para cada mês, soma MAX(valor_meta) por (vendedor_meta × marca).
  const metaMensalPorMarca = useMemo<Map<string, number[]>>(() => {
    const maxPorChave = new Map<string, number>(); // `${mes}|${vend}|${marca}` -> valor
    for (const p of pedidosFiltrados) {
      const anyP = p as any;
      const meta = Number(anyP.valor_meta ?? 0);
      if (!meta || meta <= 0) continue;
      const dref = (p.data_faturamento || p.data_pedido || '').toString();
      if (!dref.startsWith(String(ANO_ATUAL))) continue;
      const mes = dref.substring(0, 7);
      const codVendMeta = String(anyP.cod_vendedor_meta ?? anyP.cod_vendedor_externo ?? anyP.cod_vendedor_interno ?? p.vendedor_codigo ?? '').trim();
      const marcaKey = resolverMarcaNome(anyP.marca, anyP.cod_marca).toUpperCase();
      if (!mes || !codVendMeta) continue;
      const key = `${mes}|${codVendMeta}|${marcaKey}`;
      const atual = maxPorChave.get(key) ?? 0;
      if (meta > atual) maxPorChave.set(key, meta);
    }
    const map = new Map<string, number[]>();
    for (const [key, valor] of maxPorChave.entries()) {
      const [mes, , marcaKey] = key.split('|');
      const m = parseInt(mes.substring(5, 7), 10);
      if (!(m >= 1 && m <= 12)) continue;
      const arr = map.get(marcaKey) ?? Array(12).fill(0);
      arr[m - 1] += valor;
      map.set(marcaKey, arr);
    }


    return map;
  }, [pedidosFiltrados]);

  // ---- Agregações por marca × ano ----
  const { linhasComparativo, linhasComparativoSemMeta, linhasMeta, mensal2025, mensal2026, faturamentoTotal2026, realMensalPorMarca } = useMemo(() => {
    const byMarca = new Map<string, { nome: string; f2025: number; f2026: number; mensal25: number[]; mensal26: number[] }>();

    for (const it of produtosFiltrados) {
      const ano = getAno(it);
      if (ano !== ANO_ANTERIOR && ano !== ANO_ATUAL) continue;
      const mes = getMes(it);
      const key = getMarcaKey(it);
      const nome = getMarcaNome(it);
      const val = Number(it.valor_total) || 0;

      const cur = byMarca.get(key) || { nome, f2025: 0, f2026: 0, mensal25: Array(12).fill(0), mensal26: Array(12).fill(0) };
      if (nome && !/^\d+$/.test(nome) && (!cur.nome || /^\d+$/.test(cur.nome))) cur.nome = nome;
      if (ano === ANO_ATUAL) {
        cur.f2026 += val;
        if (mes) cur.mensal26[mes - 1] += val;
      } else {
        cur.f2025 += val;
        if (mes) cur.mensal25[mes - 1] += val;
      }
      byMarca.set(key, cur);
    }

    // Garante marcas com meta mesmo sem venda em 2026
    const marcasComMeta = new Set(metaPorMarca2026.keys());
    for (const key of marcasComMeta) {
      if (!byMarca.has(key)) {
        byMarca.set(key, { nome: key, f2025: 0, f2026: 0, mensal25: Array(12).fill(0), mensal26: Array(12).fill(0) });
      }
    }

    // SERVIÇOS entra nas listagens/gráficos de "Com meta" mesmo sem valor_meta no ERP.
    // Sem meta inventada: meta = 0, conclusão = null. Apenas visibilidade do realizado.
    const SERV_KEY = 'SERVIÇOS';
    const incluirChaves = new Set<string>(marcasComMeta);
    if (byMarca.has(SERV_KEY)) incluirChaves.add(SERV_KEY);

    const todos = Array.from(byMarca.entries()).map(([key, v]) => {
      const crescimento = v.f2025 > 0 ? ((v.f2026 - v.f2025) / v.f2025) * 100 : null;
      return { key, marca: v.nome, f2025: v.f2025, f2026: v.f2026, crescimento };
    });

    const comMeta = todos.filter(r => incluirChaves.has(r.key)).sort((a, b) => b.f2026 - a.f2026);
    const semMeta = todos.filter(r => !incluirChaves.has(r.key) && r.f2026 + r.f2025 > 0).sort((a, b) => b.f2026 - a.f2026);

    const totalFat2026 = comMeta.reduce((s, r) => s + Math.max(0, r.f2026), 0);

    const metaLinhas = comMeta.map((r) => {
      const meta = metaPorMarca2026.get(r.key) || 0;
      const conclusao = meta > 0 ? (r.f2026 / meta) * 100 : null;
      const saldo = meta > 0 ? r.f2026 - meta : null;
      return { key: r.key, marca: r.marca, realizado: r.f2026, meta, conclusao, saldo };
    }).sort((a, b) => (b.conclusao ?? -1) - (a.conclusao ?? -1));

    // Séries mensais considerando as marcas exibidas em "Com meta" (inclui SERVIÇOS)
    const m2025 = Array(12).fill(0) as number[];
    const m2026 = Array(12).fill(0) as number[];
    const realMensal = new Map<string, number[]>();
    for (const key of incluirChaves) {
      const v = byMarca.get(key);
      if (!v) continue;
      realMensal.set(key, v.mensal26);
      for (let i = 0; i < 12; i++) {
        m2025[i] += v.mensal25[i];
        m2026[i] += v.mensal26[i];
      }
    }


    return {
      linhasComparativo: comMeta,
      linhasComparativoSemMeta: semMeta,
      linhasMeta: metaLinhas,
      mensal2025: m2025,
      mensal2026: m2026,
      faturamentoTotal2026: totalFat2026,
      realMensalPorMarca: realMensal,
    };
  }, [produtosFiltrados, metaPorMarca2026]);

  // ---- Matriz de conclusão % por marca × mês (para o bloco Detalhamento) ----
  const detalhamentoMensal = useMemo(() => {
    return linhasMeta.map((linha) => {
      const real = realMensalPorMarca.get(linha.key) ?? Array(12).fill(0);
      const meta = metaMensalPorMarca.get(linha.key) ?? Array(12).fill(0);
      const meses = Array.from({ length: 12 }, (_, i) => {
        const r = real[i] || 0;
        const m = meta[i] || 0;
        const pct = m > 0 ? (r / m) * 100 : null;
        return { pct, temMeta: m > 0 };
      });
      return { key: linha.key, marca: linha.marca, meses };
    });
  }, [linhasMeta, realMensalPorMarca, metaMensalPorMarca]);

  // ---- Representatividade (Top N + Outras) ----
  const representatividade = useMemo(() => {
    const arr = linhasComparativo
      .filter(r => r.f2026 > 0)
      .map(r => ({ nome: r.marca, valor: r.f2026 }));
    const TOP = 8;
    if (arr.length <= TOP) return arr;
    const top = arr.slice(0, TOP);
    const outras = arr.slice(TOP).reduce((s, r) => s + r.valor, 0);
    return [...top, { nome: 'Outras', valor: outras }];
  }, [linhasComparativo]);

  // ---- Série mensal para o gráfico de linha ----
  const serieMensal = useMemo(() => {
    return MESES_LABEL.map((m, i) => ({
      mes: m,
      '2026': mensal2026[i],
      '2025': mensal2025[i],
    }));
  }, [mensal2025, mensal2026]);

  const totais = useMemo(() => {
    const t2025 = linhasComparativo.reduce((s, r) => s + r.f2025, 0);
    const t2026 = linhasComparativo.reduce((s, r) => s + r.f2026, 0);
    const cresc = t2025 > 0 ? ((t2026 - t2025) / t2025) * 100 : null;
    const metaTotal = linhasMeta.reduce((s, r) => s + (r.meta || 0), 0);
    const realTotal = linhasMeta.reduce((s, r) => s + (r.realizado || 0), 0);
    const conclusao = metaTotal > 0 ? (realTotal / metaTotal) * 100 : null;
    const saldo = metaTotal > 0 ? realTotal - metaTotal : null;
    return { t2025, t2026, cresc, metaTotal, realTotal, conclusao, saldo };
  }, [linhasComparativo, linhasMeta]);

  const totaisSemMeta = useMemo(() => {
    const t2025 = linhasComparativoSemMeta.reduce((s, r) => s + r.f2025, 0);
    const t2026 = linhasComparativoSemMeta.reduce((s, r) => s + r.f2026, 0);
    const cresc = t2025 > 0 ? ((t2026 - t2025) / t2025) * 100 : null;
    return { t2025, t2026, cresc };
  }, [linhasComparativoSemMeta]);


  if (isLoading || loadingPedidos) return <LoadingState message="Carregando dados de marcas..." />;

  return (
    <div className="dashboard-ambient p-4 md:p-6 space-y-6">
      {/* Filtros */}
      <CollapsibleFilterBar
        isOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeFiltersCount={countActiveFilters(pendingFilters)}
        summary={getComercialFiltersSummary(pendingFilters, vendedoresDisponiveis)}
        onClear={handleLimpar}
      >
        <ComercialFilters
          filters={pendingFilters}
          onFiltersChange={setPendingFilters}
          onBuscar={handleBuscar}
          hasChanges={hasChanges}
          anos={[String(ANO_ANTERIOR), String(ANO_ATUAL)]}
          vendedores={vendedoresDisponiveis}
          marcas={marcasDisponiveis}
          showVendedorFilter
          showMarcaFilter
        />
      </CollapsibleFilterBar>


      <Tabs defaultValue="com-meta" className="space-y-6">
        <TabsList>
          <TabsTrigger value="com-meta">Com meta ({linhasMeta.length})</TabsTrigger>
          <TabsTrigger value="sem-meta">Sem meta ({linhasComparativoSemMeta.length})</TabsTrigger>
          <TabsTrigger value="composicao">Composição</TabsTrigger>
        </TabsList>


        <TabsContent value="com-meta" className="space-y-6 mt-0">
      {/* KPIs rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Faturamento {ANO_ATUAL}</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(totais.t2026)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Faturamento {ANO_ANTERIOR}</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(totais.t2025)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Crescimento</p>
            <p className={cn(
              'text-xl font-bold mt-1 flex items-center gap-1',
              totais.cresc == null ? '' : totais.cresc >= 0 ? 'text-success' : 'text-destructive'
            )}>
              {totais.cresc == null ? '—' : (
                <>
                  {totais.cresc >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {formatPercent(totais.cresc, true)}
                </>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Conclusão Meta {ANO_ATUAL}</p>
            <p className={cn(
              'text-xl font-bold mt-1',
              totais.conclusao == null ? '' : totais.conclusao >= 100 ? 'text-success' : 'text-destructive'
            )}>
              {totais.conclusao == null ? 'Sem meta' : formatPercent(totais.conclusao)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Linha 1: Meta Geral + Detalhamento Mensal */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* 1. Andamento da Meta Geral 2026 */}
        <Card className="xl:col-span-5 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Andamento da Meta Geral {ANO_ATUAL}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {linhasMeta.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma meta cadastrada para {ANO_ATUAL}. Configure metas em Campanhas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-2 text-xs uppercase tracking-wider">Marca</TableHead>
                      <TableHead className="w-[55%] py-2 text-xs uppercase tracking-wider">Conclusão</TableHead>
                      <TableHead className="text-right py-2 text-xs uppercase tracking-wider">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhasMeta.map((r) => {
                      const pct = r.conclusao ?? 0;
                      const bateuMeta = pct >= 100;
                      const fillPct = Math.min(100, Math.max(0, pct));
                      return (
                        <TableRow key={r.key} className="hover:bg-muted/40 border-b-0">
                          <TableCell className="py-2 font-semibold whitespace-nowrap text-xs uppercase tracking-wide">{r.marca}</TableCell>
                          <TableCell className="py-2">
                            {r.conclusao == null ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="relative h-5 rounded-sm overflow-hidden bg-destructive/70">
                                <div
                                  className="absolute inset-y-0 left-0 bg-success"
                                  style={{ width: `${fillPct}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-bold tabular-nums text-primary-foreground">
                                  {formatPercent(pct)}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={cn(
                            'py-2 text-right tabular-nums font-semibold text-xs',
                            r.saldo == null ? '' : r.saldo >= 0 ? 'text-success' : 'text-destructive'
                          )}>
                            {r.saldo == null ? '—' : formatCurrency(r.saldo, true)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {totais.metaTotal > 0 && (() => {
                      const pct = totais.conclusao ?? 0;
                      const fillPct = Math.min(100, Math.max(0, pct));
                      return (
                        <TableRow className="bg-muted/40 font-bold border-t hover:bg-muted/50">
                          <TableCell className="py-2 text-xs uppercase tracking-wide">Total</TableCell>
                          <TableCell className="py-2">
                            <div className="relative h-5 rounded-sm overflow-hidden bg-destructive/70">
                              <div
                                className="absolute inset-y-0 left-0 bg-success"
                                style={{ width: `${fillPct}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-bold tabular-nums text-primary-foreground">
                                {formatPercent(pct)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={cn(
                            'py-2 text-right tabular-nums text-xs',
                            (totais.saldo ?? 0) >= 0 ? 'text-success' : 'text-destructive'
                          )}>
                            {formatCurrency(totais.saldo ?? 0, true)}
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Detalhamento Mensal de Conclusão de Meta */}
      <Card className="xl:col-span-7 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Detalhamento mensal de conclusão de meta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detalhamentoMensal.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma meta cadastrada para {ANO_ATUAL}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">Marca</TableHead>
                    {MESES_LABEL.map((m) => (
                      <TableHead key={m} className="text-center text-[11px] uppercase">{m}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhamentoMensal.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="sticky left-0 bg-card z-10 font-medium whitespace-nowrap">{r.marca}</TableCell>
                      {r.meses.map((mes, i) => {
                        if (!mes.temMeta) {
                          return (
                            <TableCell key={i} className="text-center text-xs text-muted-foreground bg-muted/20">—</TableCell>
                          );
                        }
                        const pct = mes.pct ?? 0;
                        const cor =
                          pct >= 100 ? 'bg-success/25 text-success' :
                          pct >= 80  ? 'bg-emerald-500/15 text-emerald-500' :
                          pct >= 50  ? 'bg-amber-500/15 text-amber-500' :
                          pct > 0    ? 'bg-destructive/20 text-destructive' :
                                       'bg-destructive/25 text-destructive';
                        return (
                          <TableCell key={i} className="p-1">
                            <div className={cn('text-center text-xs font-semibold tabular-nums rounded px-1.5 py-1', cor)}>
                              {formatPercent(pct)}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Linha 2: Comparativo + Gráfico + Representatividade */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* 2. Comparativo 2026 x 2025 */}
      <Card className="xl:col-span-5 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Comparativo {ANO_ATUAL} x {ANO_ANTERIOR} por marca
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          {linhasComparativo.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-2 text-xs uppercase tracking-wider">Marca</TableHead>
                    <TableHead className="py-2 text-xs uppercase tracking-wider text-right">Faturamento {ANO_ATUAL}</TableHead>
                    <TableHead className="py-2 text-xs uppercase tracking-wider text-right">Faturamento {ANO_ANTERIOR}</TableHead>
                    <TableHead className="py-2 text-xs uppercase tracking-wider text-right">Crescimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasComparativo.map((r) => (
                    <TableRow key={r.key} className="hover:bg-muted/40 border-b-0">
                      <TableCell className="py-2 font-semibold whitespace-nowrap text-xs uppercase tracking-wide">{r.marca}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-xs font-semibold">{formatCurrency(r.f2026)}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-xs">
                        {r.f2025 > 0 ? formatCurrency(r.f2025) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {r.crescimento == null ? (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sem base {ANO_ANTERIOR}</span>
                        ) : (
                          <span className={cn(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums',
                            r.crescimento >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                          )}>
                            {r.crescimento >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {formatPercent(r.crescimento, true)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-bold border-t hover:bg-muted/50">
                    <TableCell className="py-2 text-xs uppercase tracking-wide">Total</TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs font-bold">{formatCurrency(totais.t2026)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs font-bold">{formatCurrency(totais.t2025)}</TableCell>
                    <TableCell className="py-2 text-right">
                      {totais.cresc == null ? '—' : (
                        <span className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold tabular-nums',
                          totais.cresc >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                        )}>
                          {formatPercent(totais.cresc, true)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

        {/* 3. Gráfico Faturamento 2026 x 2025 */}
        <Card className="xl:col-span-4 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <LineIcon className="h-4 w-4 text-primary" />
              Faturamento mensal {ANO_ATUAL} x {ANO_ANTERIOR}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieMensal} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => {
                      const n = Number(v);
                      if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
                      if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
                      return `R$ ${n}`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="2026"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="2025"
                    stroke="hsl(210 40% 60%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. Representatividade */}
        <Card className="xl:col-span-3 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Representatividade de marcas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {representatividade.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem dados em {ANO_ATUAL}.</p>
            ) : (
              <>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={representatividade}
                        dataKey="valor"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {representatividade.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: any, name: any) => {
                          const pct = faturamentoTotal2026 > 0 ? (Number(value) / faturamentoTotal2026) * 100 : 0;
                          return [`${formatCurrency(Number(value))} · ${formatPercent(pct)}`, name];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-3 max-h-[180px] overflow-y-auto pr-1">
                  {representatividade.map((r, i) => {
                    const pct = faturamentoTotal2026 > 0 ? (r.valor / faturamentoTotal2026) * 100 : 0;
                    return (
                      <div key={r.nome} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="flex-1 truncate">{r.nome}</span>
                        <span className="tabular-nums text-muted-foreground">{formatCurrency(r.valor)}</span>
                        <span className="tabular-nums font-semibold w-12 text-right">{formatPercent(pct)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="sem-meta" className="space-y-6 mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Marcas sem meta cadastrada
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Faturamento observado em {ANO_ATUAL} e {ANO_ANTERIOR} para marcas que ainda não possuem meta definida.
              </p>
            </CardHeader>
            <CardContent>
              {linhasComparativoSemMeta.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Todas as marcas com movimento já possuem meta cadastrada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marca</TableHead>
                        <TableHead className="text-right">Faturamento {ANO_ATUAL}</TableHead>
                        <TableHead className="text-right">Faturamento {ANO_ANTERIOR}</TableHead>
                        <TableHead className="text-right">Crescimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhasComparativoSemMeta.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell className="font-medium">{r.marca}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.f2026 > 0 ? formatCurrency(r.f2026) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.f2025 > 0 ? formatCurrency(r.f2025) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.crescimento == null ? (
                              <Badge variant="outline" className="text-xs">Sem base {ANO_ANTERIOR}</Badge>
                            ) : (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold tabular-nums',
                                r.crescimento >= 0
                                  ? 'bg-success/15 text-success'
                                  : 'bg-destructive/15 text-destructive'
                              )}>
                                {r.crescimento >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {formatPercent(r.crescimento, true)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(totaisSemMeta.t2026)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(totaisSemMeta.t2025)}</TableCell>
                        <TableCell className="text-right">
                          {totaisSemMeta.cresc == null ? '—' : (
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tabular-nums',
                              totaisSemMeta.cresc >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                            )}>
                              {formatPercent(totaisSemMeta.cresc, true)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="composicao" className="space-y-4 mt-0">
          {(() => {
            const per = appliedFilters.periodo;
            const ini = per?.inicio;
            const fim = per?.fim;
            const list = produtosFiltrados.filter((it) => {
              if (!ini && !fim) return true;
              const d = (it.data_faturamento || it.data_pedido || '').substring(0, 10);
              if (!d) return false;
              if (ini && d < ini) return false;
              if (fim && d > fim) return false;
              return true;
            });
            const label = ini && fim ? `${ini}_a_${fim}` : `${ANO_ANTERIOR}-01-01_a_${ANO_ATUAL}-12-31`;
            return <ComposicaoVendasTab produtos={list} isLoading={isLoading} periodoLabel={label} />;
          })()}
        </TabsContent>
      </Tabs>

    </div>
  );
}

