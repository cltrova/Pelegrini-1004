import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterDropdownChip, MultiSelectOptions, SingleSelectOptions } from '@/components/common/FilterDropdownChip';
import { LoadingState } from '@/components/common/LoadingState';
import { UnifiedFilterBar } from '@/components/common/UnifiedFilterBar';
import { EstoqueAssistantTab } from '@/components/operacional/EstoqueAssistantTab';
import { GiroEstoqueTab } from '@/components/operacional/GiroEstoqueTab';
import { EstoqueCommandCenter } from '@/components/operacional/estoque/EstoqueCommandCenter';
import { PelegriniModuleHeader, PelegriniTabs } from '@/components/pelegrini';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
      <div className="p-6">
        <PelegriniModuleHeader title="Gestao de Estoque" subtitle="Carregando dados..." moduleKey="operacional" />
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
    <div className="p-4 md:p-6 space-y-4">
      <PelegriniModuleHeader
        title="Gestao de Estoque"
        subtitle={`${estoqueData.length.toLocaleString('pt-BR')} itens · ${giroData.length.toLocaleString('pt-BR')} movimentações`}
        moduleKey="operacional"
      />

      {activeTab === 'giro' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto, fabricante, marca..."
                value={pendingGiro.searchTerm}
                onChange={(event) => setPendingGiro(filters => ({ ...filters, searchTerm: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyGiroFilters();
                }}
                className="pl-9 h-9"
              />
            </div>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {estoqueData.length.toLocaleString('pt-BR')} itens
            </Badge>
          </div>

          <UnifiedFilterBar activeCount={giroActiveCount} summary={giroSummary} onClear={clearGiroFilters} onApply={applyGiroFilters}>
            <FilterDropdownChip label="Período" displayValue={`${pendingGiro.periodoMeses} meses`} isActive={pendingGiro.periodoMeses !== 6} onClear={() => { setPendingGiro(filters => ({ ...filters, periodoMeses: 6 })); setGiroFilters(filters => ({ ...filters, periodoMeses: 6 })); }}>
              <SingleSelectOptions options={PERIODO_MESES_OPTIONS} selected={pendingGiro.periodoMeses} onChange={(value) => setPendingGiro(filters => ({ ...filters, periodoMeses: Number(value) }))} />
            </FilterDropdownChip>
            <FilterDropdownChip label="Status" displayValue={pendingGiro.statusFilter.length > 0 ? pendingGiro.statusFilter.map(status => STATUS_CONFIG_LABELS[status]).join(', ') : 'Todos'} isActive={pendingGiro.statusFilter.length > 0} onClear={() => { setPendingGiro(filters => ({ ...filters, statusFilter: [] })); setGiroFilters(filters => ({ ...filters, statusFilter: [] })); }}>
              <MultiSelectOptions
                options={STATUS_OPTIONS.map(option => option.label)}
                selected={pendingGiro.statusFilter.map(status => STATUS_OPTIONS.find(option => option.key === status)?.label || '')}
                onChange={(labels) => {
                  const statuses = labels.map(label => STATUS_OPTIONS.find(option => option.label === label)?.key).filter(Boolean) as GiroStatus[];
                  setPendingGiro(filters => ({ ...filters, statusFilter: statuses }));
                }}
                allLabel="Todos"
              />
            </FilterDropdownChip>
            <FilterDropdownChip label="Filial" displayValue={pendingGiro.empresas.length > 0 ? `${pendingGiro.empresas.length} selecionada(s)` : 'Todas'} isActive={pendingGiro.empresas.length > 0} onClear={() => { setPendingGiro(filters => ({ ...filters, empresas: [] })); setGiroFilters(filters => ({ ...filters, empresas: [] })); }}>
              <MultiSelectOptions options={filterOptions.empresas} selected={pendingGiro.empresas} onChange={(value) => setPendingGiro(filters => ({ ...filters, empresas: value }))} allLabel="Todas" />
            </FilterDropdownChip>
            <FilterDropdownChip label="Marca" displayValue={pendingGiro.marcas.length > 0 ? `${pendingGiro.marcas.length} selecionada(s)` : 'Todas'} isActive={pendingGiro.marcas.length > 0} onClear={() => { setPendingGiro(filters => ({ ...filters, marcas: [] })); setGiroFilters(filters => ({ ...filters, marcas: [] })); }}>
              <MultiSelectOptions options={filterOptions.marcas} selected={pendingGiro.marcas} onChange={(value) => setPendingGiro(filters => ({ ...filters, marcas: value }))} searchable allLabel="Todas" />
            </FilterDropdownChip>
            <FilterDropdownChip label="Grupo" displayValue={pendingGiro.grupos.length > 0 ? `${pendingGiro.grupos.length} selecionado(s)` : 'Todos'} isActive={pendingGiro.grupos.length > 0} onClear={() => { setPendingGiro(filters => ({ ...filters, grupos: [] })); setGiroFilters(filters => ({ ...filters, grupos: [] })); }}>
              <MultiSelectOptions options={filterOptions.grupos} selected={pendingGiro.grupos} onChange={(value) => setPendingGiro(filters => ({ ...filters, grupos: value }))} searchable allLabel="Todos" />
            </FilterDropdownChip>
          </UnifiedFilterBar>
        </>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <PelegriniTabs
          ariaLabel="Visões do estoque"
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
          <GiroEstoqueTab giroData={giroData} estoqueData={estoqueData} filters={giroFilters} setFilters={setGiroFilters} />
        </TabsContent>

        <TabsContent value="assistente">
          <EstoqueAssistantTab giroData={giroData} estoqueData={estoqueData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
