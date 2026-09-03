import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
} from '@/components/enterprise';
import { EstoqueAssistantTab } from '@/components/operacional/EstoqueAssistantTab';
import { GiroEstoqueTab } from '@/components/operacional/GiroEstoqueTab';
import { EstoqueCommandCenter } from '@/components/operacional/estoque/EstoqueCommandCenter';
import { PelegriniModuleHeader, PelegriniTabs } from '@/components/pelegrini';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEstoqueData } from '@/hooks/useEstoqueData';
import type { EstoqueRecord, GiroFiltersState, GiroStatus, ViewMode } from '@/types/estoque';
import { toast } from 'sonner';

function calcDiasSemVenda(dataUltimaVenda: string | null): number {
  if (!dataUltimaVenda) return 9999;
  return Math.floor((Date.now() - new Date(dataUltimaVenda).getTime()) / (1000 * 60 * 60 * 24));
}

function exportToExcel(data: EstoqueRecord[]) {
  const header = ['Código', 'Produto', 'Marca', 'Fabricante', 'Nr Fabricante', 'Grupo', 'Filial', 'Curva', 'Qtd Estoque', 'Valor em Estoque', 'Custo Médio', 'Última Venda', 'Dias sem Venda'];
  const rows = data.map(r => [
    String(r.cod_produto), r.produto, r.marca, r.cod_fabricante, r.nr_fabricante, r.grupo, r.empresa, r.classe_abc,
    String(r.quantidade_estoque),
    r.valor_estoque.toFixed(2).replace('.', ','),
    r.custo_medio.toFixed(2).replace('.', ','),
    r.data_ultima_venda ? new Date(r.data_ultima_venda).toLocaleDateString('pt-BR') : '—',
    String(calcDiasSemVenda(r.data_ultima_venda) === 9999 ? 'N/A' : calcDiasSemVenda(r.data_ultima_venda)),
  ]);
  const csvContent = [header, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estoque_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${data.length} itens exportados com sucesso!`);
}

const PERIODO_MESES_OPTIONS = [
  { value: 3, label: '3 meses' }, { value: 6, label: '6 meses' }, { value: 12, label: '12 meses' },
];
const STATUS_OPTIONS = [
  { key: 'atendendo' as GiroStatus, label: '🟢 Atendendo' },
  { key: 'alerta' as GiroStatus, label: '🟡 Alerta' },
  { key: 'faltando' as GiroStatus, label: '🔴 Faltando' },
  { key: 'excesso' as GiroStatus, label: '🔵 Excesso' },
];
const STATUS_CONFIG_LABELS: Record<GiroStatus, string> = {
  atendendo: 'Atendendo', alerta: 'Alerta', faltando: 'Faltando', excesso: 'Excesso',
};
const DEFAULT_GIRO_FILTERS: GiroFiltersState = {
  periodoMeses: 6, statusFilter: [], empresas: [], marcas: [], grupos: [], searchTerm: '',
};

export default function EstoquePage() {
  const { consolidadoData, detalhadoData, giroData, isLoading, empresa } = useEstoqueData();
  const { codEmpresaContexto, filialAtiva } = useFilialSelecionada();
  const [activeTab, setActiveTab] = useState('central');
  const [viewMode, setViewMode] = useState<ViewMode>('consolidado');
  const [giroFilters, setGiroFilters] = useState<GiroFiltersState>(DEFAULT_GIRO_FILTERS);
  const [pendingGiro, setPendingGiro] = useState<GiroFiltersState>(DEFAULT_GIRO_FILTERS);
  const [giroFiltersOpen, setGiroFiltersOpen] = useState(false);

  const estoqueData = useMemo(
    () => viewMode === 'consolidado' ? consolidadoData : detalhadoData,
    [consolidadoData, detalhadoData, viewMode],
  );
  const branchKey = `${codEmpresaContexto ?? empresa?.cod_empresa_bi ?? 'empresa'}:${filialAtiva ?? 'sem-filial'}`;

  const filterOptions = useMemo(() => ({
    empresas: [...new Set(estoqueData.map(r => r.empresa))].sort(),
    marcas: [...new Set(estoqueData.map(r => r.marca))].sort(),
    grupos: [...new Set(estoqueData.map(r => (r.grupo && String(r.grupo).trim()) || 'Sem grupo'))].sort(),
  }), [estoqueData]);

  const applyGiroFilters = () => setGiroFilters({ ...pendingGiro });

  const giroActiveCount = useMemo(() => {
    let count = 0;
    if (pendingGiro.periodoMeses !== 6) count++;
    if (pendingGiro.statusFilter.length > 0) count++;
    if (pendingGiro.empresas.length > 0) count++;
    if (pendingGiro.marcas.length > 0) count++;
    if (pendingGiro.grupos.length > 0) count++;
    return count;
  }, [pendingGiro]);

  const giroSummary = useMemo(() => {
    const parts: string[] = [`${pendingGiro.periodoMeses} meses`];
    if (pendingGiro.statusFilter.length > 0) parts.push(pendingGiro.statusFilter.map(s => STATUS_CONFIG_LABELS[s]).join(', '));
    if (pendingGiro.empresas.length > 0) parts.push(`${pendingGiro.empresas.length} filial(is)`);
    if (pendingGiro.marcas.length > 0) parts.push(`${pendingGiro.marcas.length} marca(s)`);
    return parts.join(' · ');
  }, [pendingGiro]);

  const clearGiroFilters = () => {
    setPendingGiro(DEFAULT_GIRO_FILTERS);
    setGiroFilters(DEFAULT_GIRO_FILTERS);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <PelegriniModuleHeader title="Gestao de Estoque" subtitle="Carregando dados..." moduleKey="operacional" compact className="ml-10 sm:ml-0" />
        <LoadingState />
      </div>
    );
  }

  if (!empresa?.modulo_operacional) {
    return (
      <div className="p-6">
        <EmptyState message="O módulo Operacional não está ativado para esta empresa." />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 md:p-4">
      <PelegriniModuleHeader
        title="Gestao de Estoque"
        subtitle={`${estoqueData.length.toLocaleString('pt-BR')} itens · ${giroData.length.toLocaleString('pt-BR')} movimentações`}
        moduleKey="operacional"
        compact
        className="ml-10 sm:ml-0"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <PelegriniTabs
          ariaLabel="Visões do estoque"
          className="estoque-tabs"
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: 'central', label: 'Central de Estoque' },
            { value: 'giro', label: 'Giro de Estoque' },
            { value: 'assistente', label: 'Assistente' },
          ]}
        />

        <TabsContent value="central">
          <EstoqueCommandCenter
            stockData={estoqueData}
            movementData={giroData}
            branchKey={branchKey}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onExport={exportToExcel}
          />
        </TabsContent>

        <TabsContent value="giro">
          <div className="mb-3 space-y-2">
            <EnterpriseFilterBar
              activeCount={giroActiveCount}
              applyLabel="Aplicar"
              isOpen={giroFiltersOpen}
              onApply={() => {
                applyGiroFilters();
                setGiroFiltersOpen(false);
              }}
              onClear={clearGiroFilters}
              onOpenChange={setGiroFiltersOpen}
              resultCount={estoqueData.length}
              resultLabel="itens"
              summary={(
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                  <EnterpriseSearchFilter
                    label="Buscar giro"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, searchTerm: value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyGiroFilters();
                    }}
                    placeholder="Buscar produto, fabricante, marca..."
                    value={pendingGiro.searchTerm}
                  />
                  {giroActiveCount > 0 && (
                    <span className="min-w-0 truncate pb-1 text-xs text-muted-foreground">
                      {giroSummary}
                    </span>
                  )}
                </div>
              )}
            >
              {giroFiltersOpen && (
                <>
                  <EnterpriseSelectFilter
                    label="Período"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, periodoMeses: Number(value ?? 6) }))}
                    options={PERIODO_MESES_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
                    value={String(pendingGiro.periodoMeses)}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todos"
                    label="Status"
                    onChange={(values) => setPendingGiro(filters => ({ ...filters, statusFilter: values as GiroStatus[] }))}
                    options={STATUS_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
                    searchable={false}
                    values={pendingGiro.statusFilter}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todas"
                    label="Filial"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, empresas: value }))}
                    options={filterOptions.empresas.map((value) => ({ value, label: value }))}
                    values={pendingGiro.empresas}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todas"
                    label="Marca"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, marcas: value }))}
                    options={filterOptions.marcas.map((value) => ({ value, label: value }))}
                    values={pendingGiro.marcas}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todos"
                    label="Grupo"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, grupos: value }))}
                    options={filterOptions.grupos.map((value) => ({ value, label: value }))}
                    values={pendingGiro.grupos}
                  />
                </>
              )}
            </EnterpriseFilterBar>
          </div>
          <GiroEstoqueTab giroData={giroData} estoqueData={estoqueData} filters={giroFilters} setFilters={setGiroFilters} />
        </TabsContent>

        <TabsContent value="assistente">
          <EstoqueAssistantTab giroData={giroData} estoqueData={estoqueData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
