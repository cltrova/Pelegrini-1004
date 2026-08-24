import { EstoqueRecord, EstoqueFiltersState } from '@/types/estoque';
import { EstoqueKPICards } from './EstoqueKPICards';
import { EstoqueChartsPremium } from './EstoqueChartsPremium';
import { EstoqueInsights } from './EstoqueInsights';

interface Props {
  data: EstoqueRecord[];
  allData: EstoqueRecord[];
  filters: EstoqueFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<EstoqueFiltersState>>;
  filterOptions: {
    empresas: string[];
    marcas: string[];
    grupos: string[];
    curvasABC: string[];
  };
  onExport?: () => void;
}

export function EstoqueOverviewTab({ data, allData, filters, setFilters, filterOptions }: Props) {
  return (
    <div className="space-y-4">
      <EstoqueKPICards data={data} />
      <EstoqueInsights data={data} />
      <EstoqueChartsPremium data={data} allData={allData} filters={filters} setFilters={setFilters} />
    </div>
  );
}
