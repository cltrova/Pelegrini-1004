import type { ReactNode } from 'react';

import { EnterpriseFilterBar } from '@/components/enterprise';
import type { DreFilters as DreFiltersType } from '@/types/dre';
import { DreFilters } from './DreFilters';

interface EnterpriseDreFiltersProps {
  filters: DreFiltersType;
  onFiltersChange: (filters: DreFiltersType) => void;
  onSearch?: () => void;
  onClear?: () => void;
  empresas: string[];
  periodos: string[];
  anos: string[];
  grupos: string[];
  codigos: string[];
  codigoDescricaoMap?: Map<string, string>;
  vendedoresInternos?: string[];
  vendedoresExternos?: string[];
  empresasVendedorInterno?: string[];
  empresasVendedorExterno?: string[];
  activeFiltersCount?: number;
  summary?: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EnterpriseDreFilters({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  empresas,
  periodos,
  anos,
  grupos,
  codigos,
  codigoDescricaoMap,
  vendedoresInternos,
  vendedoresExternos,
  empresasVendedorInterno,
  empresasVendedorExterno,
  activeFiltersCount = 0,
  summary,
  isOpen,
  onOpenChange,
}: EnterpriseDreFiltersProps) {
  return (
    <EnterpriseFilterBar
      activeCount={activeFiltersCount}
      applyLabel="Buscar"
      isOpen={isOpen}
      onApply={onSearch}
      onClear={onClear}
      onOpenChange={onOpenChange}
      summary={summary}
    >
      <DreFilters
        anos={anos}
        codigos={codigos}
        codigoDescricaoMap={codigoDescricaoMap}
        empresas={empresas}
        empresasVendedorExterno={empresasVendedorExterno}
        empresasVendedorInterno={empresasVendedorInterno}
        filters={filters}
        grupos={grupos}
        onFiltersChange={onFiltersChange}
        periodos={periodos}
        vendedoresExternos={vendedoresExternos}
        vendedoresInternos={vendedoresInternos}
      />
    </EnterpriseFilterBar>
  );
}
