import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { LoadingState } from '@/components/common/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package, TrendingUp, AlertTriangle, Tag, Search, Award,
  FileText, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import {
  ComercialFilters, getDefaultFiltersForEmpresa, getComercialFiltersSummary, countActiveFilters,
} from '@/components/comercial/ComercialFilters';
import { useComercialData } from '@/hooks/useComercialData';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { PremiumMarcasView } from '@/components/comercial/PremiumMarcasView';
import { PremiumTopProdutos } from '@/components/comercial/PremiumTopProdutos';
import { PremiumCategoriasView } from '@/components/comercial/PremiumCategoriasView';
import { MarcasViewLegacy } from '@/components/comercial/legacy/MarcasViewLegacy';
import { TopProdutosLegacy } from '@/components/comercial/legacy/TopProdutosLegacy';
import { CategoriasViewLegacy } from '@/components/comercial/legacy/CategoriasViewLegacy';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { PelegriniModuleHeader } from '@/components/pelegrini';

const ANOS = ['2023', '2024', '2025', '2026'];

export default function ProdutosPage() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const isLayoutPremium = String(codEmpresaAtiva ?? '') === '1004';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('marcas');
  const [initialized, setInitialized] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType>({});
  const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Filtro cruzado: marca selecionada via clique no gráfico/tabela/produto
  const [selectedMarca, setSelectedMarca] = useState<string | null>(null);
  const [hoverMarca, setHoverMarca] = useState<string | null>(null);
  // Filtro cruzado por categoria
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);

  const { periodoDisponivel, isLoading: loadingBase, vendedoresDisponiveis } = useComercialData(appliedFilters);
  const {
    topProdutos, porMarca, porCategoria, produtosSemGiro, resumoVendas,
    hasSource, isLoading,
  } = useComercialProdutos(appliedFilters);

  useEffect(() => {
    if (!initialized && !loadingBase) {
      const def = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
      setPendingFilters(def);
      setAppliedFilters(def);
      setInitialized(true);
    }
  }, [initialized, loadingBase, periodoDisponivel, codEmpresaAtiva]);

  const hasChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters);
  const handleBuscar = useCallback(() => {
    setAppliedFilters(pendingFilters);
    setFiltersOpen(false);
  }, [pendingFilters]);
  const handleClear = useCallback(() => {
    const d = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
    setPendingFilters(d); setAppliedFilters(d);
  }, [periodoDisponivel, codEmpresaAtiva]);

  // Filtros locais (busca + marca selecionada via clique)
  const matchMarca = useCallback(
    (m?: string) => !selectedMarca || (m || '').toUpperCase().trim() === selectedMarca.toUpperCase().trim(),
    [selectedMarca]
  );

  const topFiltrado = useMemo(
    () => topProdutos.filter(p =>
      matchMarca(p.marca) && (
        !searchTerm ||
        p.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.cod_produto).includes(searchTerm)
      )
    ),
    [topProdutos, searchTerm, matchMarca]
  );

  const resumoFiltrado = useMemo(
    () => resumoVendas.filter(r =>
      matchMarca(r.marca) && (
        !searchTerm ||
        r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.cliente_razao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.marca || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.num_nf || '').includes(searchTerm)
      )
    ).slice(0, 500),
    [resumoVendas, searchTerm, matchMarca]
  );

  const categoriaFiltrada = useMemo(
    () => selectedMarca ? porCategoria : porCategoria,
    [porCategoria, selectedMarca]
  );

  // Top KPIs da página — reativos a selectedMarca
  const marcasFiltradas = useMemo(
    () => selectedMarca
      ? porMarca.filter(m => (m.marca || '').toUpperCase().trim() === selectedMarca.toUpperCase().trim())
      : porMarca,
    [porMarca, selectedMarca]
  );
  const totalReceitaGeral = useMemo(() => porMarca.reduce((a, m) => a + m.faturamento, 0), [porMarca]);
  const totalQtdGeral = useMemo(() => porMarca.reduce((a, m) => a + m.quantidade, 0), [porMarca]);
  const totalSkusGeral = topProdutos.length;

  const totalReceita = useMemo(() => marcasFiltradas.reduce((a, m) => a + m.faturamento, 0), [marcasFiltradas]);
  const totalQtd = useMemo(() => marcasFiltradas.reduce((a, m) => a + m.quantidade, 0), [marcasFiltradas]);
  const totalProdutos = useMemo(
    () => selectedMarca ? topProdutos.filter(p => matchMarca(p.marca)).length : topProdutos.length,
    [topProdutos, selectedMarca, matchMarca]
  );

  const shareReceita = totalReceitaGeral > 0 ? (totalReceita / totalReceitaGeral) * 100 : 0;
  const shareQtd = totalQtdGeral > 0 ? (totalQtd / totalQtdGeral) * 100 : 0;
  const isFiltered = !!selectedMarca;
  const clearMarcaFilter = () => setSelectedMarca(null);

  if (!hasSource) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="border-warning/40">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Fonte de produtos não configurada</h2>
            <p className="text-sm text-muted-foreground">
              Configure o JSON de produtos (itens dos pedidos) no cadastro da empresa para habilitar esta análise.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || loadingBase) return <LoadingState message="Carregando produtos..." />;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Filtros */}
      <CollapsibleFilterBar
        title="Filtros"
        summary={getComercialFiltersSummary(appliedFilters, vendedoresDisponiveis)}
        activeFiltersCount={countActiveFilters(appliedFilters)}
        onClear={handleClear}
        isOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
      >
        <ComercialFilters
          filters={pendingFilters}
          onFiltersChange={setPendingFilters}
          onBuscar={handleBuscar}
          hasChanges={hasChanges}
          anos={ANOS}
          vendedores={vendedoresDisponiveis}
          showVendedorFilter
        />
      </CollapsibleFilterBar>

      <PelegriniModuleHeader
        title="Produtos & Marcas"
        subtitle="Mix de produtos vendidos, performance por marca e detalhamento por nota fiscal"
        moduleKey="comercial"
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {selectedMarca && (
            <button
              onClick={() => setSelectedMarca(null)}
              className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-medium hover:bg-primary/25 transition-all animate-fade-in"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Filtrando por marca: <span className="font-bold">{selectedMarca}</span>
              <span className="opacity-60">× limpar</span>
            </button>
          )}
        </div>
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto, marca, cliente, NF..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-2 items-stretch">
        <KpiMini
          icon={<TrendingUp className="h-4 w-4" />}
          label={isFiltered ? `Receita • ${selectedMarca}` : 'Receita (itens)'}
          value={totalReceita}
          formatter={(v) => formatCurrency(v, true)}
          color="primary"
          isFiltered={isFiltered}
          onClearFilter={clearMarcaFilter}
          subInfo={isFiltered ? `${shareReceita.toFixed(1)}% do total` : undefined}
          progress={isFiltered ? shareReceita : undefined}
        />
        <KpiMini
          icon={<Tag className="h-4 w-4" />}
          label={isFiltered ? 'Marca selecionada' : 'Marcas ativas'}
          value={isFiltered ? 1 : porMarca.length}
          formatter={(v) => isFiltered ? `1 / ${porMarca.length}` : String(Math.round(v))}
          color="success"
          isFiltered={isFiltered}
          onClearFilter={clearMarcaFilter}
          subInfo={isFiltered ? 'clique para limpar filtro' : `${porMarca.length} marca${porMarca.length !== 1 ? 's' : ''}`}
        />
        <KpiMini
          icon={<Layers className="h-4 w-4" />}
          label={isFiltered ? 'SKUs da marca' : 'SKUs vendidos'}
          value={totalProdutos}
          formatter={(v) => formatNumber(Math.round(v))}
          color="accent"
          isFiltered={isFiltered}
          onClearFilter={clearMarcaFilter}
          subInfo={isFiltered ? `de ${formatNumber(totalSkusGeral)} totais` : undefined}
        />
        <KpiMini
          icon={<Package className="h-4 w-4" />}
          label={isFiltered ? 'Quantidade da marca' : 'Quantidade total'}
          value={totalQtd}
          formatter={(v) => formatNumber(Math.round(v))}
          color="warning"
          isFiltered={isFiltered}
          onClearFilter={clearMarcaFilter}
          subInfo={isFiltered ? `${shareQtd.toFixed(1)}% das unidades` : undefined}
          progress={isFiltered ? shareQtd : undefined}
        />
      </div>

      {/* Tabs principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full lg:w-fit">
          <TabsTrigger value="marcas" className="gap-1.5"><Award className="h-3.5 w-3.5" /> Marcas</TabsTrigger>
          <TabsTrigger value="top" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Top Produtos</TabsTrigger>
          <TabsTrigger value="categoria" className="gap-1.5"><Tag className="h-3.5 w-3.5" /> Categorias</TabsTrigger>
          <TabsTrigger value="sem-giro" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Sem Giro
            {produtosSemGiro.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">{produtosSemGiro.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resumo" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Resumo NF</TabsTrigger>
        </TabsList>

        {/* MARCAS */}
        <TabsContent value="marcas" className="space-y-4">
          {isLayoutPremium ? (
            <PremiumMarcasView
              porMarca={porMarca}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
              periodoLabel={[appliedFilters.anos?.join('/'), appliedFilters.meses?.join('/')].filter(Boolean).join(' • ')}
            />
          ) : (
            <MarcasViewLegacy
              porMarca={porMarca}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
            />
          )}
        </TabsContent>

        {/* TOP PRODUTOS */}
        <TabsContent value="top">
          {isLayoutPremium ? (
            <PremiumTopProdutos
              produtos={topFiltrado}
              resumoVendas={resumoVendas}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
              onHoverMarca={setHoverMarca}
            />
          ) : (
            <TopProdutosLegacy
              produtos={topFiltrado}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
            />
          )}
        </TabsContent>

        {/* CATEGORIAS */}
        <TabsContent value="categoria">
          {isLayoutPremium ? (
            <PremiumCategoriasView
              porCategoria={porCategoria}
              selectedCategoria={selectedCategoria}
              onSelectCategoria={setSelectedCategoria}
              periodoLabel={[appliedFilters.anos?.join('/'), appliedFilters.meses?.join('/')].filter(Boolean).join(' • ')}
            />
          ) : (
            <CategoriasViewLegacy
              porCategoria={porCategoria}
              selectedCategoria={selectedCategoria}
              onSelectCategoria={setSelectedCategoria}
            />
          )}
        </TabsContent>

        {/* SEM GIRO */}
        <TabsContent value="sem-giro">
          <Card className="premium-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Produtos sem giro no período
              </CardTitle>
            </CardHeader>
            <CardContent>
              {produtosSemGiro.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Todos os produtos do catálogo movimentaram no período. 🎯</p>
              ) : (
                <div className="overflow-y-auto max-h-[600px] rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2">Produto</th>
                        <th className="px-3 py-2">Marca/Categoria</th>
                        <th className="px-3 py-2">Última Venda</th>
                        <th className="px-3 py-2 text-right">Dias parado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtosSemGiro.slice(0, 300).map(p => (
                        <tr key={String(p.cod_produto)} className="border-t border-border hover:bg-muted/40">
                          <td className="px-3 py-2">
                            <div className="font-medium leading-tight">{p.descricao}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">#{p.cod_produto}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {[p.marca, p.categoria].filter(Boolean).join(' • ') || '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                            {p.ultimaVenda ? new Date(p.ultimaVenda).toLocaleDateString('pt-BR') : 'Nunca'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {p.diasSemVenda !== undefined ? (
                              <Badge variant="outline" className={
                                p.diasSemVenda > 90 ? 'border-destructive/50 text-destructive'
                                : p.diasSemVenda > 30 ? 'border-warning/50 text-warning' : ''
                              }>
                                {p.diasSemVenda}d
                              </Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESUMO POR NF (linha-a-linha estilo Power BI) */}
        <TabsContent value="resumo">
          <Card className="premium-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Resumo de Vendas — linha por item de NF
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Mostrando {resumoFiltrado.length} de {resumoVendas.length} linhas {searchTerm && '(filtradas)'}
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[700px] rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr className="text-left text-[11px] text-muted-foreground">
                      <th className="px-2 py-2">Data</th>
                      <th className="px-2 py-2">NF</th>
                      <th className="px-2 py-2">Produto</th>
                      <th className="px-2 py-2">Marca</th>
                      <th className="px-2 py-2">Cliente</th>
                      <th className="px-2 py-2 text-right">Receita</th>
                      <th className="px-2 py-2 text-right">Custo</th>
                      <th className="px-2 py-2 text-right">Lucro</th>
                      <th className="px-2 py-2 text-right">% Margem</th>
                      <th className="px-2 py-2">Interno</th>
                      <th className="px-2 py-2">Externo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoFiltrado.map((r, i) => (
                      <tr key={i} className={cn(
                        "border-t border-border hover:bg-muted/40",
                        r.tipo === 'DEVOLUCAO' && 'bg-destructive/5'
                      )}>
                        <td className="px-2 py-1.5 tabular-nums">{r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="px-2 py-1.5 tabular-nums">{r.num_nf || '-'}</td>
                        <td className="px-2 py-1.5">{r.descricao}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.marca || '-'}</td>
                        <td className="px-2 py-1.5 truncate max-w-[200px]">{r.cliente_razao || '-'}</td>
                        <td className={cn("px-2 py-1.5 text-right tabular-nums", r.receita < 0 && 'text-destructive')}>{formatCurrency(r.receita)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{formatCurrency(r.custo)}</td>
                        <td className={cn("px-2 py-1.5 text-right tabular-nums", r.lucro >= 0 ? 'text-success' : 'text-destructive')}>{formatCurrency(r.lucro)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.margem.toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.nome_interno || '-'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.nome_externo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type KpiColor = 'primary' | 'success' | 'warning' | 'accent';

interface KpiMiniProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  formatter: (v: number) => string;
  color: KpiColor;
  isFiltered?: boolean;
  onClearFilter?: () => void;
  subInfo?: string;
  progress?: number; // 0..100
}

function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const fromRef = React.useRef(target);
  const startRef = React.useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

const KpiMini = React.forwardRef<HTMLDivElement, KpiMiniProps>(
  ({ icon, label, value, formatter, color, isFiltered, onClearFilter, subInfo, progress }, ref) => {
    const colorMap: Record<KpiColor, string> = {
      primary: 'border-primary/30 bg-primary/10 text-primary',
      success: 'border-success/30 bg-success/10 text-success',
      warning: 'border-warning/30 bg-warning/10 text-warning',
      accent: 'border-accent/30 bg-accent/10 text-accent',
    };
    const ringMap: Record<KpiColor, string> = {
      primary: 'ring-primary/40',
      success: 'ring-success/40',
      warning: 'ring-warning/40',
      accent: 'ring-accent/40',
    };
    const barMap: Record<KpiColor, string> = {
      primary: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      accent: 'bg-accent',
    };

    const animated = useAnimatedNumber(value);

    const clickable = isFiltered && !!onClearFilter;
    const handleClick = () => { if (clickable) onClearFilter!(); };
    const handleKey = (e: React.KeyboardEvent) => {
      if (clickable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClearFilter!();
      }
    };

    return (
      <div ref={ref} className="h-full">
        <Card
          onClick={handleClick}
          onKeyDown={handleKey}
          tabIndex={clickable ? 0 : -1}
          role={clickable ? 'button' : undefined}
          aria-label={clickable ? `Limpar filtro de marca` : undefined}
          className={cn(
            'group relative overflow-hidden h-full bg-card border transition-colors duration-200',
            'hover:bg-muted/30',
            isFiltered ? colorMap[color] : 'border-border/60',
            isFiltered && `ring-1 ring-offset-0 ${ringMap[color]}`,
            clickable && 'cursor-pointer'
          )}
        >
          {/* Accent bar lateral */}
          <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', barMap[color])} />

          <CardContent className="p-4 h-full flex flex-col justify-between gap-2 min-h-[96px]">
            {/* Header: label + ícone */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] truncate leading-tight">
                {label}
              </p>
              <div
                className={cn(
                  'h-7 w-7 shrink-0 rounded-md flex items-center justify-center',
                  `bg-${color}/15 text-${color}`
                )}
              >
                {icon}
              </div>
            </div>

            {/* Valor principal */}
            <p className={cn('text-2xl font-bold mono-value tabular-nums leading-none truncate', `text-${color}`)}>
              {formatter(animated)}
            </p>

            {/* Sub-info slot (altura reservada para alinhar todos) */}
            <div className="h-4 flex items-center">
              {isFiltered ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className={cn('h-1 w-1 rounded-full animate-pulse', barMap[color])} />
                  {subInfo || 'filtrado'}
                </span>
              ) : subInfo ? (
                <span className="text-[10px] text-muted-foreground truncate">{subInfo}</span>
              ) : (
                <span className="text-[10px] text-muted-foreground/40">—</span>
              )}
            </div>
          </CardContent>

          {/* Progress bar inferior */}
          {typeof progress === 'number' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted/30">
              <div
                className={cn('h-full transition-all duration-700 ease-out', barMap[color])}
                style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
              />
            </div>
          )}
        </Card>
      </div>
    );
  }
);
KpiMini.displayName = 'KpiMini';
