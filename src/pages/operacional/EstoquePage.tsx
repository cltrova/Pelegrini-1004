import { useState, useMemo } from 'react';
import { BarChart3, Table2, RefreshCw, Bot, Search, Download, ToggleLeft, ToggleRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEstoqueData } from '@/hooks/useEstoqueData';
import { EstoqueFiltersState, GiroFiltersState, EstoqueRecord, GiroStatus } from '@/types/estoque';
import { EstoqueOverviewTab } from '@/components/operacional/EstoqueOverviewTab';
import { EstoqueDetalhesTab } from '@/components/operacional/EstoqueDetalhesTab';
import { GiroEstoqueTab } from '@/components/operacional/GiroEstoqueTab';
import { EstoqueAssistantTab } from '@/components/operacional/EstoqueAssistantTab';
import { PelegriniModuleHeader } from '@/components/pelegrini';

import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { UnifiedFilterBar } from '@/components/common/UnifiedFilterBar';
import { FilterDropdownChip, MultiSelectOptions, SingleSelectOptions } from '@/components/common/FilterDropdownChip';
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

const CURVA_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'N'];
const DIAS_SEM_VENDA_OPTIONS = [
  { value: 'todos', label: 'Todos' }, { value: '0', label: '0 dias' },
  { value: '7+', label: '7+' }, { value: '15+', label: '15+' },
  { value: '30+', label: '30+' }, { value: '60+', label: '60+' }, { value: '90+', label: '90+' },
  { value: '180+', label: '180+' }, { value: '360+', label: '360+' },
];
const PERIODO_OPTIONS = [
  { value: 'todos', label: 'Todos' }, { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];
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

export default function EstoquePage() {
  const { consolidadoData, detalhadoData, giroData, isLoading, isError, empresa } = useEstoqueData();
  const isEmpresa1004 = String(empresa?.cod_empresa_bi) === '1004' || String(empresa?.cod_empresa_bi) === '10041';
  const diasSemVendaOptions = useMemo(() => (
    isEmpresa1004
      ? [...DIAS_SEM_VENDA_OPTIONS, { value: 'custom', label: 'Personalizado' }]
      : DIAS_SEM_VENDA_OPTIONS
  ), [isEmpresa1004]);
  const [activeTab, setActiveTab] = useState('visao-geral');

  const defaultEstoqueFilters: EstoqueFiltersState = {
    viewMode: 'consolidado', empresas: [], marcas: [], grupos: [], curvasABC: [],
    searchTerm: '', diasSemVenda: 'todos', periodo: 'todos',
    ocultarChegadaRecente: isEmpresa1004, janelaChegadaRecenteDias: 30,
  };


  const defaultGiroFilters: GiroFiltersState = {
    periodoMeses: 6, statusFilter: [], empresas: [], marcas: [], grupos: [], searchTerm: '',
  };

  // Applied filters (used for actual data filtering)
  const [estoqueFilters, setEstoqueFilters] = useState<EstoqueFiltersState>(defaultEstoqueFilters);
  const [giroFilters, setGiroFilters] = useState<GiroFiltersState>(defaultGiroFilters);

  // Pending filters (user selections before clicking Pesquisar)
  const [pendingEstoque, setPendingEstoque] = useState<EstoqueFiltersState>(defaultEstoqueFilters);
  const [pendingGiro, setPendingGiro] = useState<GiroFiltersState>(defaultGiroFilters);

  const applyEstoqueFilters = () => setEstoqueFilters({ ...pendingEstoque });
  const applyGiroFilters = () => setGiroFilters({ ...pendingGiro });

  const estoqueData = useMemo(() => {
    return estoqueFilters.viewMode === 'consolidado' ? consolidadoData : detalhadoData;
  }, [estoqueFilters.viewMode, consolidadoData, detalhadoData]);

  const filteredEstoque = useMemo(() => {
    let data = estoqueData;
    const f = estoqueFilters;
    if (f.empresas.length > 0) data = data.filter(r => f.empresas.includes(r.empresa));
    if (f.marcas.length > 0) data = data.filter(r => f.marcas.includes(r.marca));
    if (f.grupos.length > 0) data = data.filter(r => f.grupos.includes((r.grupo && String(r.grupo).trim()) || 'Sem grupo'));
    if (f.curvasABC.length > 0) data = data.filter(r => f.curvasABC.includes(r.classe_abc));
    if (f.searchTerm) {
      const term = f.searchTerm.toLowerCase();
      data = data.filter(r =>
        (r.produto || '').toLowerCase().includes(term) ||
        (r.cod_fabricante || '').toLowerCase().includes(term) ||
        (r.marca || '').toLowerCase().includes(term)
      );
    }
    if (f.diasSemVenda !== 'todos') {
      data = data.filter(r => {
        const dias = calcDiasSemVenda(r.data_ultima_venda);
         switch (f.diasSemVenda) {
          case '0': return dias === 0;
          case '7+': return dias >= 7;
          case '15+': return dias >= 15;
          case '30+': return dias >= 30;
          case '60+': return dias >= 60;
          case '90+': return dias >= 90;
          case '180+': return dias >= 180;
          case '360+': return dias >= 360;
          case 'custom': {
            const n = Number(f.diasSemVendaCustom);
            if (!Number.isFinite(n) || n <= 0) return true;
            return dias >= n;
          }
          default: return true;
        }
      });
    }
    if (f.periodo !== 'todos') {
      const now = new Date();
      data = data.filter(r => {
        if (!r.data_ultima_venda) return false;
        const d = new Date(r.data_ultima_venda);
        switch (f.periodo) {
          case 'hoje': return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
          case '7d': { const s = new Date(now); s.setDate(s.getDate() - 7); return d >= s; }
          case '30d': { const s = new Date(now); s.setDate(s.getDate() - 30); return d >= s; }
          case 'custom': {
            const ini = f.periodoInicio ? new Date(f.periodoInicio) : null;
            const fim = f.periodoFim ? new Date(f.periodoFim) : null;
            if (ini && d < ini) return false;
            if (fim && d > fim) return false;
            return true;
          }
          default: return true;
        }
      });
    }
    if (f.ocultarChegadaRecente && isEmpresa1004) {
      const janela = Math.max(1, Number(f.janelaChegadaRecenteDias) || 30);
      const now = Date.now();
      data = data.filter(r => {
        const ultimaEntrada = [r.data_ultima_compra, r.data_ultima_transferencia]
          .map(d => (d ? new Date(d).getTime() : 0))
          .reduce((a, b) => Math.max(a, b), 0);
        if (!ultimaEntrada) return true;
        const diasDesdeEntrada = Math.floor((now - ultimaEntrada) / (1000 * 60 * 60 * 24));
        return diasDesdeEntrada > janela;
      });
    }
    return data;
  }, [estoqueData, estoqueFilters, isEmpresa1004]);

  const filterOptions = useMemo(() => ({
    empresas: [...new Set(estoqueData.map(r => r.empresa))].sort(),
    marcas: [...new Set(estoqueData.map(r => r.marca))].sort(),
    grupos: [...new Set(estoqueData.map(r => (r.grupo && String(r.grupo).trim()) || 'Sem grupo'))].sort(),
    curvasABC: [...new Set(estoqueData.map(r => r.classe_abc))].sort(),
  }), [estoqueData]);

  // --- Estoque filter helpers ---
  // --- Estoque filter helpers (use pending for UI) ---
  const estoqueActiveCount = useMemo(() => {
    let c = 0;
    if (pendingEstoque.empresas.length > 0) c++;
    if (pendingEstoque.marcas.length > 0) c++;
    if (pendingEstoque.grupos.length > 0) c++;
    if (pendingEstoque.curvasABC.length > 0) c++;
    if (pendingEstoque.diasSemVenda !== 'todos') c++;
    if (pendingEstoque.periodo !== 'todos') c++;
    return c;
  }, [pendingEstoque]);

  const estoqueSummary = useMemo(() => {
    const p: string[] = [];
    if (pendingEstoque.empresas.length > 0) p.push(`${pendingEstoque.empresas.length} filial(is)`);
    if (pendingEstoque.marcas.length > 0) p.push(`${pendingEstoque.marcas.length} marca(s)`);
    if (pendingEstoque.grupos.length > 0) p.push(`${pendingEstoque.grupos.length} grupo(s)`);
    if (pendingEstoque.curvasABC.length > 0) p.push(`Curva ${pendingEstoque.curvasABC.join(', ')}`);
    if (pendingEstoque.diasSemVenda !== 'todos') {
      const lbl = pendingEstoque.diasSemVenda === 'custom'
        ? `${pendingEstoque.diasSemVendaCustom || 0}+ dias`
        : DIAS_SEM_VENDA_OPTIONS.find(o => o.value === pendingEstoque.diasSemVenda)?.label;
      p.push(`${lbl} s/ venda`);
    }
    if (pendingEstoque.periodo !== 'todos') p.push(PERIODO_OPTIONS.find(o => o.value === pendingEstoque.periodo)?.label || '');
    return p.join(' · ');
  }, [pendingEstoque]);

  const clearEstoqueFilters = () => {
    const cleared = { ...defaultEstoqueFilters, viewMode: pendingEstoque.viewMode };
    setPendingEstoque(cleared);
    setEstoqueFilters(cleared);
  };

  // --- Giro filter helpers (use pending for UI) ---
  const giroActiveCount = useMemo(() => {
    let c = 0;
    if (pendingGiro.periodoMeses !== 6) c++;
    if (pendingGiro.statusFilter.length > 0) c++;
    if (pendingGiro.empresas.length > 0) c++;
    if (pendingGiro.marcas.length > 0) c++;
    if (pendingGiro.grupos.length > 0) c++;
    return c;
  }, [pendingGiro]);

  const giroSummary = useMemo(() => {
    const p: string[] = [];
    p.push(`${pendingGiro.periodoMeses} meses`);
    if (pendingGiro.statusFilter.length > 0) p.push(pendingGiro.statusFilter.map(s => STATUS_CONFIG_LABELS[s]).join(', '));
    if (pendingGiro.empresas.length > 0) p.push(`${pendingGiro.empresas.length} filial(is)`);
    if (pendingGiro.marcas.length > 0) p.push(`${pendingGiro.marcas.length} marca(s)`);
    return p.join(' · ');
  }, [pendingGiro]);

  const clearGiroFilters = () => {
    setPendingGiro(defaultGiroFilters);
    setGiroFilters(defaultGiroFilters);
  };

  const isEstoqueTab = activeTab === 'visao-geral' || activeTab === 'detalhes';
  const isGiroTab = activeTab === 'giro';

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
        subtitle={`${empresa?.nome || 'Pelegrini'} - ${filteredEstoque.length.toLocaleString('pt-BR')} itens - ${giroData.length.toLocaleString('pt-BR')} movimentacoes`}
        moduleKey="operacional"
      />


      {/* Search bar + actions — always visible */}
      {(isEstoqueTab || isGiroTab) && (
        <div className="flex items-center gap-3 flex-wrap">
          {isEstoqueTab && (
            <button
              onClick={() => {
                const newMode = pendingEstoque.viewMode === 'consolidado' ? 'detalhado' : 'consolidado';
                setPendingEstoque(f => ({ ...f, viewMode: newMode }));
                setEstoqueFilters(f => ({ ...f, viewMode: newMode }));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
            >
              {pendingEstoque.viewMode === 'consolidado' ? (
                <ToggleLeft className="h-5 w-5 text-amber-500" />
              ) : (
                <ToggleRight className="h-5 w-5 text-blue-500" />
              )}
              <span className="text-sm font-medium">
                {pendingEstoque.viewMode === 'consolidado' ? 'Filial Consolidada' : 'Filial Separada'}
              </span>
            </button>
          )}

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, fabricante, marca..."
              value={isEstoqueTab ? pendingEstoque.searchTerm : pendingGiro.searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                if (isEstoqueTab) setPendingEstoque(f => ({ ...f, searchTerm: val }));
                else setPendingGiro(f => ({ ...f, searchTerm: val }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isEstoqueTab) applyEstoqueFilters();
                  else applyGiroFilters();
                }
              }}
              className="pl-9 h-9"
            />
          </div>

          <Badge variant="secondary" className="text-xs tabular-nums">
            {filteredEstoque.length.toLocaleString('pt-BR')} itens
          </Badge>

          {isEstoqueTab && activeTab === 'detalhes' && (
            <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => exportToExcel(filteredEstoque)}>
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          )}
        </div>
      )}

      {/* Page-level unified filter bar — Estoque tabs */}
      {isEstoqueTab && (
        <UnifiedFilterBar activeCount={estoqueActiveCount} summary={estoqueSummary} onClear={clearEstoqueFilters} onApply={applyEstoqueFilters}>
          <FilterDropdownChip label="Filial" displayValue={pendingEstoque.empresas.length > 0 ? `${pendingEstoque.empresas.length} selecionada(s)` : 'Todas'} isActive={pendingEstoque.empresas.length > 0} onClear={() => { setPendingEstoque(f => ({ ...f, empresas: [] })); setEstoqueFilters(f => ({ ...f, empresas: [] })); }}>
            <MultiSelectOptions options={filterOptions.empresas} selected={pendingEstoque.empresas} onChange={(v) => setPendingEstoque(f => ({ ...f, empresas: v }))} allLabel="Todas" />
          </FilterDropdownChip>
          <FilterDropdownChip label="Marca" displayValue={pendingEstoque.marcas.length > 0 ? `${pendingEstoque.marcas.length} selecionada(s)` : 'Todas'} isActive={pendingEstoque.marcas.length > 0} onClear={() => { setPendingEstoque(f => ({ ...f, marcas: [] })); setEstoqueFilters(f => ({ ...f, marcas: [] })); }}>
            <MultiSelectOptions options={filterOptions.marcas} selected={pendingEstoque.marcas} onChange={(v) => setPendingEstoque(f => ({ ...f, marcas: v }))} searchable allLabel="Todas" />
          </FilterDropdownChip>
          <FilterDropdownChip label="Grupo" displayValue={pendingEstoque.grupos.length > 0 ? `${pendingEstoque.grupos.length} selecionado(s)` : 'Todos os grupos'} isActive={pendingEstoque.grupos.length > 0} onClear={() => { setPendingEstoque(f => ({ ...f, grupos: [] })); setEstoqueFilters(f => ({ ...f, grupos: [] })); }}>
            <MultiSelectOptions options={filterOptions.grupos} selected={pendingEstoque.grupos} onChange={(v) => setPendingEstoque(f => ({ ...f, grupos: v }))} searchable allLabel="Todos os grupos" />
          </FilterDropdownChip>
          <FilterDropdownChip label="Curva" displayValue={pendingEstoque.curvasABC.length > 0 ? pendingEstoque.curvasABC.join(', ') : 'Todas'} isActive={pendingEstoque.curvasABC.length > 0} onClear={() => { setPendingEstoque(f => ({ ...f, curvasABC: [] })); setEstoqueFilters(f => ({ ...f, curvasABC: [] })); }}>
            <MultiSelectOptions options={CURVA_OPTIONS} selected={pendingEstoque.curvasABC} onChange={(v) => setPendingEstoque(f => ({ ...f, curvasABC: v }))} allLabel="Todas" />
          </FilterDropdownChip>
          <FilterDropdownChip label="Dias s/ Venda" displayValue={pendingEstoque.diasSemVenda === 'custom' ? `${pendingEstoque.diasSemVendaCustom || 0}+ dias` : (diasSemVendaOptions.find(o => o.value === pendingEstoque.diasSemVenda)?.label || 'Todos')} isActive={pendingEstoque.diasSemVenda !== 'todos'} onClear={() => { setPendingEstoque(f => ({ ...f, diasSemVenda: 'todos', diasSemVendaCustom: undefined })); setEstoqueFilters(f => ({ ...f, diasSemVenda: 'todos', diasSemVendaCustom: undefined })); }}>
            <div className="space-y-2">
              <SingleSelectOptions options={diasSemVendaOptions} selected={pendingEstoque.diasSemVenda} onChange={(v) => setPendingEstoque(f => ({ ...f, diasSemVenda: v }))} />
              {isEmpresa1004 && pendingEstoque.diasSemVenda === 'custom' && (
                <div className="pt-2 border-t border-border space-y-1">
                  <label className="text-[11px] text-muted-foreground">Quantidade de dias sem venda (considera apenas venda fiscal, exclui transferências)</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ex: 120"
                    value={pendingEstoque.diasSemVendaCustom ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPendingEstoque(f => ({ ...f, diasSemVendaCustom: v === '' ? undefined : Math.max(1, Number(v)) }));
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>
          </FilterDropdownChip>
          <FilterDropdownChip label="Período" displayValue={PERIODO_OPTIONS.find(o => o.value === pendingEstoque.periodo)?.label || 'Todos'} isActive={pendingEstoque.periodo !== 'todos'} onClear={() => { setPendingEstoque(f => ({ ...f, periodo: 'todos', periodoInicio: undefined, periodoFim: undefined })); setEstoqueFilters(f => ({ ...f, periodo: 'todos', periodoInicio: undefined, periodoFim: undefined })); }}>
            <div className="space-y-2">
              <SingleSelectOptions options={PERIODO_OPTIONS} selected={pendingEstoque.periodo} onChange={(v) => setPendingEstoque(f => ({ ...f, periodo: v }))} />
              {pendingEstoque.periodo === 'custom' && (
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                        <CalendarIcon className="h-3 w-3" />
                        {pendingEstoque.periodoInicio ? format(new Date(pendingEstoque.periodoInicio), 'dd/MM/yy', { locale: ptBR }) : 'Início'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[60]" align="start">
                      <Calendar mode="single" selected={pendingEstoque.periodoInicio ? new Date(pendingEstoque.periodoInicio) : undefined} onSelect={(d) => setPendingEstoque(f => ({ ...f, periodoInicio: d?.toISOString() }))} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <span className="text-[10px] text-muted-foreground">até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                        <CalendarIcon className="h-3 w-3" />
                        {pendingEstoque.periodoFim ? format(new Date(pendingEstoque.periodoFim), 'dd/MM/yy', { locale: ptBR }) : 'Fim'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[60]" align="start">
                      <Calendar mode="single" selected={pendingEstoque.periodoFim ? new Date(pendingEstoque.periodoFim) : undefined} onSelect={(d) => setPendingEstoque(f => ({ ...f, periodoFim: d?.toISOString() }))} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </FilterDropdownChip>
          {isEmpresa1004 && (
            <FilterDropdownChip
              label="Chegada Recente"
              displayValue={pendingEstoque.ocultarChegadaRecente ? `Ocultar ≤ ${pendingEstoque.janelaChegadaRecenteDias || 30}d` : 'Incluir'}
              isActive={!!pendingEstoque.ocultarChegadaRecente}
              onClear={() => { setPendingEstoque(f => ({ ...f, ocultarChegadaRecente: false })); setEstoqueFilters(f => ({ ...f, ocultarChegadaRecente: false })); }}
            >
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!pendingEstoque.ocultarChegadaRecente}
                    onChange={(e) => setPendingEstoque(f => ({ ...f, ocultarChegadaRecente: e.target.checked }))}
                  />
                  <span>Ocultar itens com chegada recente</span>
                </label>
                <div className="pt-2 border-t border-border space-y-1">
                  <label className="text-[11px] text-muted-foreground">Janela (dias desde última compra/transferência)</label>
                  <SingleSelectOptions
                    options={[
                      { value: 15, label: '15 dias' },
                      { value: 30, label: '30 dias' },
                      { value: 45, label: '45 dias' },
                      { value: 60, label: '60 dias' },
                    ]}
                    selected={pendingEstoque.janelaChegadaRecenteDias || 30}
                    onChange={(v) => setPendingEstoque(f => ({ ...f, janelaChegadaRecenteDias: Number(v) }))}
                  />
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Diferencia item realmente parado (sem giro) de item que estava em ruptura e acabou de chegar.
                  </p>
                </div>
              </div>
            </FilterDropdownChip>
          )}
        </UnifiedFilterBar>
      )}

      {/* Page-level unified filter bar — Giro tab */}
      {isGiroTab && (
        <UnifiedFilterBar activeCount={giroActiveCount} summary={giroSummary} onClear={clearGiroFilters} onApply={applyGiroFilters}>
          <FilterDropdownChip label="Período" displayValue={`${pendingGiro.periodoMeses} meses`} isActive={pendingGiro.periodoMeses !== 6} onClear={() => { setPendingGiro(f => ({ ...f, periodoMeses: 6 })); setGiroFilters(f => ({ ...f, periodoMeses: 6 })); }}>
            <SingleSelectOptions options={PERIODO_MESES_OPTIONS.map(o => ({ value: o.value, label: o.label }))} selected={pendingGiro.periodoMeses} onChange={(v) => setPendingGiro(f => ({ ...f, periodoMeses: v }))} />
          </FilterDropdownChip>
          <FilterDropdownChip label="Status" displayValue={pendingGiro.statusFilter.length > 0 ? pendingGiro.statusFilter.map(s => STATUS_CONFIG_LABELS[s]).join(', ') : 'Todos'} isActive={pendingGiro.statusFilter.length > 0} onClear={() => { setPendingGiro(f => ({ ...f, statusFilter: [] })); setGiroFilters(f => ({ ...f, statusFilter: [] })); }}>
            <MultiSelectOptions
              options={STATUS_OPTIONS.map(o => o.label)}
              selected={pendingGiro.statusFilter.map(s => STATUS_OPTIONS.find(o => o.key === s)?.label || '')}
              onChange={(labels) => {
                const keys = labels.map(l => STATUS_OPTIONS.find(o => o.label === l)?.key).filter(Boolean) as GiroStatus[];
                setPendingGiro(f => ({ ...f, statusFilter: keys }));
              }}
              allLabel="Todos"
            />
          </FilterDropdownChip>
          <FilterDropdownChip label="Filial" displayValue={pendingGiro.empresas.length > 0 ? `${pendingGiro.empresas.length} selecionada(s)` : 'Todas'} isActive={pendingGiro.empresas.length > 0} onClear={() => { setPendingGiro(f => ({ ...f, empresas: [] })); setGiroFilters(f => ({ ...f, empresas: [] })); }}>
            <MultiSelectOptions options={filterOptions.empresas} selected={pendingGiro.empresas} onChange={(v) => setPendingGiro(f => ({ ...f, empresas: v }))} allLabel="Todas" />
          </FilterDropdownChip>
          <FilterDropdownChip label="Marca" displayValue={pendingGiro.marcas.length > 0 ? `${pendingGiro.marcas.length} selecionada(s)` : 'Todas'} isActive={pendingGiro.marcas.length > 0} onClear={() => { setPendingGiro(f => ({ ...f, marcas: [] })); setGiroFilters(f => ({ ...f, marcas: [] })); }}>
            <MultiSelectOptions options={filterOptions.marcas} selected={pendingGiro.marcas} onChange={(v) => setPendingGiro(f => ({ ...f, marcas: v }))} searchable allLabel="Todas" />
          </FilterDropdownChip>
          <FilterDropdownChip label="Grupo" displayValue={pendingGiro.grupos.length > 0 ? `${pendingGiro.grupos.length} selecionado(s)` : 'Todos'} isActive={pendingGiro.grupos.length > 0} onClear={() => { setPendingGiro(f => ({ ...f, grupos: [] })); setGiroFilters(f => ({ ...f, grupos: [] })); }}>
            <MultiSelectOptions options={filterOptions.grupos} selected={pendingGiro.grupos} onChange={(v) => setPendingGiro(f => ({ ...f, grupos: v }))} searchable allLabel="Todos" />
          </FilterDropdownChip>
        </UnifiedFilterBar>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 border border-border p-1">
          <TabsTrigger value="visao-geral" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="detalhes" className="gap-2">
            <Table2 className="h-4 w-4" />
            <span className="hidden sm:inline">Detalhes do Produto</span>
          </TabsTrigger>
          <TabsTrigger value="giro" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Giro de Estoque</span>
          </TabsTrigger>
          <TabsTrigger value="assistente" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Assistente</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <EstoqueOverviewTab data={filteredEstoque} allData={estoqueData} filters={estoqueFilters} setFilters={setEstoqueFilters} filterOptions={filterOptions} />
        </TabsContent>

        <TabsContent value="detalhes">
          <EstoqueDetalhesTab data={filteredEstoque} filters={estoqueFilters} setFilters={setEstoqueFilters} filterOptions={filterOptions} onExport={() => exportToExcel(filteredEstoque)} />
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
