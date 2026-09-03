import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSelectFilter,
  type EnterpriseOption,
} from '@/components/enterprise';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import {
  COMERCIAL_MESES,
  computeFimPeriodo,
  countActiveFilters,
  getComercialFiltersSummary,
  getMesAtual,
} from './ComercialFilters';

interface EnterpriseComercialFiltersProps {
  pendingFilters: ComercialFiltersType;
  appliedFilters: ComercialFiltersType;
  onPendingFiltersChange: (filters: ComercialFiltersType) => void;
  onApply: () => void;
  onClear: () => void;
  hasChanges: boolean;
  anos: string[];
  vendedores?: { codigo: string | number; nome: string }[];
  clientes?: { codigo: string | number; nome: string }[];
  marcas?: string[];
  resultCount?: number;
  showVendedorFilter?: boolean;
  showClienteFilter?: boolean;
  showMarcaFilter?: boolean;
}

const toOptions = (
  items: readonly { codigo: string | number; nome: string }[] = [],
): EnterpriseOption[] =>
  items.map((item) => ({
    value: String(item.codigo),
    label: item.nome,
    description: `#${item.codigo}`,
  }));

const monthOptions: EnterpriseOption[] = COMERCIAL_MESES.map((mes) => ({
  value: mes.value,
  label: mes.label.replace(/^./, (char) => char.toUpperCase()),
}));

const toPeriodo = (anos: string[] = [], meses: string[] = []): ComercialFiltersType['periodo'] => {
  const anosValidos = Array.from(
    new Set(
      anos
        .map(Number)
        .filter((ano) => Number.isInteger(ano) && ano >= 2000 && ano <= 2100),
    ),
  ).sort((a, b) => a - b);
  const mesesValidos = meses.map(Number).filter((mes) => Number.isInteger(mes) && mes >= 1 && mes <= 12);

  if (anosValidos.length === 0 || mesesValidos.length === 0) return undefined;

  const menorAno = anosValidos[0];
  const maiorAno = anosValidos[anosValidos.length - 1];
  const menorMes = Math.min(...mesesValidos);
  const maiorMes = Math.max(...mesesValidos);
  const inicio = new Date(menorAno, menorMes - 1, 1);
  const yyyy = inicio.getFullYear();
  const mm = String(inicio.getMonth() + 1).padStart(2, '0');
  const dd = String(inicio.getDate()).padStart(2, '0');

  return {
    inicio: `${yyyy}-${mm}-${dd}`,
    fim: computeFimPeriodo(maiorAno, maiorMes),
  };
};

export function EnterpriseComercialFilters({
  pendingFilters,
  appliedFilters,
  onPendingFiltersChange,
  onApply,
  onClear,
  hasChanges,
  anos,
  vendedores = [],
  clientes = [],
  marcas = [],
  resultCount,
  showVendedorFilter = false,
  showClienteFilter = false,
  showMarcaFilter = false,
}: EnterpriseComercialFiltersProps) {
  const summary = getComercialFiltersSummary(appliedFilters, vendedores, clientes)
    .map((item) => `${item.label}: ${item.value}`)
    .join(' | ');
  const activeCount = countActiveFilters(appliedFilters);
  const update = (patch: Partial<ComercialFiltersType>) =>
    onPendingFiltersChange({ ...pendingFilters, ...patch });
  const updatePeriodo = (nextAnos: string[], nextMeses: string[]) =>
    update({
      anos: nextAnos,
      meses: nextMeses,
      periodo: toPeriodo(nextAnos, nextMeses),
    });
  const pendingVendedores = (
    pendingFilters.vendedores || (pendingFilters.vendedor ? [pendingFilters.vendedor] : [])
  ).map(String);
  const pendingMarcas = (
    pendingFilters.marcas || (pendingFilters.marca ? [pendingFilters.marca] : [])
  ).map(String);

  return (
    <EnterpriseFilterBar
      activeCount={activeCount}
      applyLabel={hasChanges ? 'Aplicar alteracoes' : 'Aplicar filtros'}
      onApply={onApply}
      onClear={onClear}
      resultCount={resultCount}
      summary={summary}
    >
      <EnterpriseSelectFilter
        allLabel="Todos os anos"
        label="Ano"
        onChange={(value) =>
          updatePeriodo(value ? [value] : [], pendingFilters.meses?.length ? pendingFilters.meses.map(String) : [getMesAtual()])
        }
        options={anos.map((ano) => ({ value: ano, label: ano }))}
        value={pendingFilters.anos?.[0]}
      />
      <EnterpriseMultiSelectFilter
        allLabel="Todos os meses"
        label="Periodo"
        onChange={(values) => updatePeriodo((pendingFilters.anos || []).map(String), values)}
        options={monthOptions}
        values={(pendingFilters.meses || []).map(String)}
      />
      {showVendedorFilter && (
        <EnterpriseMultiSelectFilter
          allLabel="Todos os vendedores"
          label="Vendedor"
          onChange={(values) =>
            update({
              vendedores: values.length ? values : undefined,
              vendedor: values.length === 1 ? values[0] : undefined,
            })
          }
          options={toOptions(vendedores)}
          values={pendingVendedores}
        />
      )}
      {showClienteFilter && (
        <EnterpriseSelectFilter
          allLabel="Todos os clientes"
          label="Cliente"
          onChange={(value) => update({ cliente: value })}
          options={toOptions(clientes)}
          value={pendingFilters.cliente ? String(pendingFilters.cliente) : undefined}
        />
      )}
      {showMarcaFilter && (
        <EnterpriseMultiSelectFilter
          allLabel="Todas as marcas"
          label="Marca"
          onChange={(values) =>
            update({
              marcas: values.length ? values : undefined,
              marca: values.length === 1 ? values[0] : undefined,
            })
          }
          options={marcas.map((marca) => ({ value: marca, label: marca }))}
          values={pendingMarcas}
        />
      )}
      <EnterpriseSelectFilter
        allLabel="Pedidos e devolucoes"
        label="Tipo"
        onChange={(value) => update({ tipo: (value as ComercialFiltersType['tipo']) || 'todos' })}
        options={[
          { value: 'PEDIDO', label: 'Apenas pedidos' },
          { value: 'DEVOLUCAO', label: 'Apenas devolucoes' },
        ]}
        value={pendingFilters.tipo === 'todos' ? undefined : pendingFilters.tipo}
      />
    </EnterpriseFilterBar>
  );
}
