import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { formatCurrency, formatCurrencyCompact, formatNumber } from '@/utils/formatters';
import { LoadingIndicator, LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDefaultFiltersForEmpresa } from '@/components/comercial/ComercialFilters';
import { useComercialData } from '@/hooks/useComercialData';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { PremiumMarcasView } from '@/components/comercial/PremiumMarcasView';
import { PremiumTopProdutos } from '@/components/comercial/PremiumTopProdutos';
import { PremiumCategoriasView } from '@/components/comercial/PremiumCategoriasView';
import { MarcasViewLegacy } from '@/components/comercial/legacy/MarcasViewLegacy';
import { TopProdutosLegacy } from '@/components/comercial/legacy/TopProdutosLegacy';
import { CategoriasViewLegacy } from '@/components/comercial/legacy/CategoriasViewLegacy';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { EnterpriseSearchFilter } from '@/components/enterprise';
import { EnterpriseComercialFilters } from '@/components/comercial/EnterpriseComercialFilters';
import {
  ComercialCommandBar,
  ComercialCompactPage,
  ComercialDataViewport,
  ComercialMetricStrip,
} from '@/components/comercial/compact';

const ANOS = ['2023', '2024', '2025', '2026'];

export default function ProdutosPage() {
  const queryClient = useQueryClient();
  const { codEmpresaAtiva, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const isLayoutPremium = String(codEmpresaAtiva ?? '') === '1004';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('marcas');
  const [initialized, setInitialized] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType>({});
  const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType>({});
  // Filtro cruzado: marca selecionada via clique no gráfico/tabela/produto
  const [selectedMarca, setSelectedMarca] = useState<string | null>(null);
  const [, setHoverMarca] = useState<string | null>(null);
  // Filtro cruzado por categoria
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);

  const {
    periodoDisponivel,
    isLoading: loadingBase,
    isFetching: fetchingBase,
    vendedoresDisponiveis,
    error: baseError,
  } = useComercialData(appliedFilters);
  const {
    topProdutos, porMarca, porCategoria, produtosSemGiro, resumoVendas,
    hasSource, isLoading, isFetching, error: productsError,
  } = useComercialProdutos(appliedFilters);

  const resolvedScopeRef = useRef<string | null>(null);
  const companyKey = String(codEmpresaAtiva ?? '').trim();
  const branchKey = String(filialAtiva ?? '').trim() || 'sem-filial';
  const dataScopeKey = companyKey ? `${companyKey}:${branchKey}` : '';
  const hasProductData = topProdutos.length > 0
    || porMarca.length > 0
    || porCategoria.length > 0
    || produtosSemGiro.length > 0
    || resumoVendas.length > 0;
  if (!isLoadingEmpresa && companyKey
    && !isLoading && !loadingBase && !isFetching && !fetchingBase
    && !productsError && !baseError) {
    resolvedScopeRef.current = dataScopeKey;
  }
  const hasResolvedData = resolvedScopeRef.current === dataScopeKey && dataScopeKey !== '';
  const isRefreshing = (isFetching || fetchingBase || isLoading || loadingBase) && hasResolvedData;
  const blockingError = (productsError || baseError) && !hasResolvedData;
  const showBlockingLoading = isLoadingEmpresa || (!productsError && !baseError && !hasResolvedData);
  const pageClassName = 'commercial-products h-[calc(100dvh-9.5rem)] max-h-[calc(100dvh-9.5rem)] overflow-hidden overflow-x-hidden px-3 pb-3 pt-2 sm:px-4 md:h-full md:max-h-full';

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

  // Top KPIs da página — reativos a selectedMarca
  const marcasFiltradas = useMemo(
    () => selectedMarca
      ? porMarca.filter(m => (m.marca || '').toUpperCase().trim() === selectedMarca.toUpperCase().trim())
      : porMarca,
    [porMarca, selectedMarca]
  );
  const totalSkusGeral = topProdutos.length;

  const totalReceita = useMemo(() => marcasFiltradas.reduce((a, m) => a + m.faturamento, 0), [marcasFiltradas]);
  const totalQtd = useMemo(() => marcasFiltradas.reduce((a, m) => a + m.quantidade, 0), [marcasFiltradas]);
  const totalProdutos = useMemo(
    () => selectedMarca ? topProdutos.filter(p => matchMarca(p.marca)).length : topProdutos.length,
    [topProdutos, selectedMarca, matchMarca]
  );

  const isFiltered = !!selectedMarca;

  if (showBlockingLoading || blockingError) {
    return (
      <ComercialCompactPage
        as="div"
        className={pageClassName}
      >
        <ComercialCommandBar title="Produtos" context={showBlockingLoading ? undefined : 'Falha na consulta'} />
        <section
          className="commercial-detail-panel flex min-h-0 flex-1 items-center justify-center"
          aria-label={showBlockingLoading ? 'Carregando produtos' : 'Falha ao carregar produtos'}
        >
          {showBlockingLoading
            ? <LoadingState message="Carregando produtos" variant="content" surface={false} />
            : <ErrorState message="Erro ao carregar produtos" />}
        </section>
      </ComercialCompactPage>
    );
  }

  if (!hasSource) {
    return (
      <ComercialCompactPage
        as="div"
        className={pageClassName}
      >
        <ComercialCommandBar title="Produtos" context="Fonte indisponível" />
        <section className="flex min-h-0 flex-1 items-center justify-center border border-warning/30 bg-warning/5 p-6 text-center">
          <div className="max-w-md">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-warning" />
            <h2 className="text-base font-semibold">Fonte de produtos não configurada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure a fonte de itens dos pedidos no cadastro da empresa para habilitar esta análise.
            </p>
          </div>
        </section>
      </ComercialCompactPage>
    );
  }

  return (
    <ComercialCompactPage
      as="div"
      className={pageClassName}
    >
      <ComercialCommandBar title="Produtos" />

      <EnterpriseComercialFilters
        pendingFilters={pendingFilters}
        appliedFilters={appliedFilters}
        onPendingFiltersChange={setPendingFilters}
        onApply={handleBuscar}
        isApplying={isRefreshing}
        onClear={handleClear}
        hasChanges={hasChanges}
        anos={ANOS}
        vendedores={vendedoresDisponiveis}
        showVendedorFilter
        useNativeControls
      />

      <ComercialMetricStrip
        ariaLabel="Indicadores de produtos"
        metrics={[
          {
            label: isFiltered ? 'Receita da marca' : 'Receita dos itens',
            value: formatCurrencyCompact(totalReceita),
            context: isFiltered ? selectedMarca : undefined,
            tooltip: 'Receita somada dos itens vendidos no período selecionado.',
          },
          {
            label: isFiltered ? 'Marca selecionada' : 'Marcas ativas',
            value: isFiltered ? `1 / ${porMarca.length}` : formatNumber(porMarca.length, 0),
            tone: 'success',
            tooltip: 'Quantidade de marcas com venda no período.',
          },
          {
            label: isFiltered ? 'SKUs da marca' : 'SKUs vendidos',
            value: formatNumber(totalProdutos, 0),
            context: isFiltered ? `de ${formatNumber(totalSkusGeral, 0)}` : undefined,
            tooltip: 'Quantidade de códigos de produto presentes nas vendas.',
          },
          {
            label: isFiltered ? 'Quantidade da marca' : 'Quantidade total',
            value: formatNumber(Math.round(totalQtd), 0),
            tone: 'warning',
            tooltip: 'Soma das unidades vendidas no período.',
          },
        ]}
      />

      {!hasProductData ? (
        <ComercialDataViewport ariaLabel="Estado dos produtos" className="commercial-detail-panel flex flex-1 items-center justify-center">
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum produto encontrado no período.</p>
        </ComercialDataViewport>
      ) : <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div data-testid="produtos-navigation" className="flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-9 w-fit max-w-full shrink-0 justify-start overflow-x-auto">
            <TabsTrigger value="marcas">Marcas</TabsTrigger>
            <TabsTrigger value="top">Top Produtos</TabsTrigger>
            <TabsTrigger value="categoria">Categorias</TabsTrigger>
            <TabsTrigger value="sem-giro">Sem Giro
              {produtosSemGiro.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">{produtosSemGiro.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="resumo">Resumo NF</TabsTrigger>
          </TabsList>
          <div className="flex min-w-0 items-center justify-end gap-2">
            {(productsError || baseError) ? (
              <span role="status" aria-label="Falha ao atualizar produtos" className="flex min-w-0 items-center gap-1 text-warning">
                <span className="truncate" title="Falha ao atualizar produtos. Dados anteriores mantidos.">Falha ao atualizar</span>
                <button
                  type="button"
                  aria-label="Tentar atualizar produtos novamente"
                  title="Tentar atualizar produtos novamente"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  disabled={isRefreshing}
                  onClick={() => {
                    void Promise.all([
                      queryClient.refetchQueries({ queryKey: ['comercial-produtos', codEmpresaAtiva], type: 'active' }),
                      queryClient.refetchQueries({ queryKey: ['comercial-receita-comissao-1004', codEmpresaAtiva], type: 'active' }),
                      queryClient.refetchQueries({ queryKey: ['comercial', 'raw', codEmpresaAtiva], type: 'active' }),
                    ]);
                  }}
                >
                  {isRefreshing
                    ? <LoadingIndicator size="sm" />
                    : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
                </button>
              </span>
            ) : selectedMarca ? (
              <button type="button" className="hidden text-xs font-semibold text-primary hover:underline lg:block" onClick={() => setSelectedMarca(null)}>
                {selectedMarca} - limpar filtro
              </button>
            ) : null}
            <EnterpriseSearchFilter
              label="Buscar produtos"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Produto, marca, cliente ou NF"
            />
          </div>
        </div>

        <TabsContent value="marcas" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport
            ariaLabel="Desempenho por marca"
            className={cn('h-full max-h-full', !isLayoutPremium && 'commercial-table-frame')}
          >
          {isLayoutPremium ? (
            <PremiumMarcasView
              porMarca={porMarca}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
              periodoLabel={[appliedFilters.anos?.join('/'), appliedFilters.meses?.join('/')].filter(Boolean).join(' • ')}
              showInsights={false}
              embedded
            />
          ) : (
            <MarcasViewLegacy
              porMarca={porMarca}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
            />
          )}
          </ComercialDataViewport>
        </TabsContent>

        <TabsContent value="top" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport
            ariaLabel="Ranking de produtos"
            className={cn('h-full max-h-full', !isLayoutPremium && 'commercial-table-frame')}
          >
          {isLayoutPremium ? (
            <PremiumTopProdutos
              produtos={topFiltrado}
              resumoVendas={resumoVendas}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
              onHoverMarca={setHoverMarca}
              showInsights={false}
            />
          ) : (
            <TopProdutosLegacy
              produtos={topFiltrado}
              selectedMarca={selectedMarca}
              onSelectMarca={setSelectedMarca}
            />
          )}
          </ComercialDataViewport>
        </TabsContent>

        <TabsContent value="categoria" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport
            ariaLabel="Desempenho por categoria"
            className={cn('h-full max-h-full', !isLayoutPremium && 'commercial-table-frame')}
          >
          {isLayoutPremium ? (
            <PremiumCategoriasView
              porCategoria={porCategoria}
              selectedCategoria={selectedCategoria}
              onSelectCategoria={setSelectedCategoria}
              periodoLabel={[appliedFilters.anos?.join('/'), appliedFilters.meses?.join('/')].filter(Boolean).join(' • ')}
              showInsights={false}
              embedded
            />
          ) : (
            <CategoriasViewLegacy
              porCategoria={porCategoria}
              selectedCategoria={selectedCategoria}
              onSelectCategoria={setSelectedCategoria}
            />
          )}
          </ComercialDataViewport>
        </TabsContent>

        <TabsContent value="sem-giro" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport ariaLabel="Produtos sem giro" className="commercial-table-frame h-full max-h-full overflow-auto">
            <table aria-label="Produtos sem giro" className="w-full min-w-max border-collapse text-xs">
              <caption className="sr-only">Produtos sem giro no período</caption>
                    <thead className="sticky top-0 z-10 bg-muted">
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
            {produtosSemGiro.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">Todos os produtos movimentaram no período.</p>
            )}
          </ComercialDataViewport>
        </TabsContent>

        <TabsContent value="resumo" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport ariaLabel="Resumo de vendas por nota fiscal" className="commercial-table-frame h-full max-h-full overflow-auto">
                <table aria-label="Resumo de vendas por nota fiscal" className="w-full min-w-max border-collapse text-xs">
                  <caption className="sr-only">Resumo de vendas por nota fiscal</caption>
                  <thead className="sticky top-0 z-10 bg-muted">
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
                {resumoFiltrado.length === 0 && (
                  <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada no recorte atual.</p>
                )}
          </ComercialDataViewport>
        </TabsContent>
      </Tabs>}
    </ComercialCompactPage>
  );
}
