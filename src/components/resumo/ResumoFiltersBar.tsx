import { ResumoFilters } from '@/types/resumo';
import { EnterpriseResumoFilters } from './EnterpriseResumoFilters';

interface Props {
  filters: ResumoFilters;
  onChange: (f: ResumoFilters) => void;
  empresas: string[];
  anos?: string[];
}

export function ResumoFiltersBar({ filters, onChange, empresas, anos = [] }: Props) {
  return <EnterpriseResumoFilters anos={anos} empresas={empresas} filters={filters} onChange={onChange} />;
}
