import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Calendar, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useVendedores } from '@/hooks/useVendedores';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MESES = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Fev' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Abr' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Ago' },
  { value: '09', label: 'Set' },
  { value: '10', label: 'Out' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dez' },
];

// Generate years from 2022 to current year + 1
const currentYear = new Date().getFullYear();
const ANOS = Array.from({ length: currentYear - 2021 }, (_, i) => (currentYear + 1 - i).toString());

export interface ReportFiltersState {
  anos: string[];
  meses: string[];
  vendedorId: string | null;
}

interface ReportFiltersProps {
  filters: ReportFiltersState;
  onFiltersChange: (filters: ReportFiltersState) => void;
  onSearch: () => void;
  onClear: () => void;
}

export function ReportFilters({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
}: ReportFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: vendedores = [] } = useVendedores();

  // Get current month/year for display
  const currentMonthLabel = useMemo(() => {
    const now = new Date();
    return format(now, "MMM yyyy", { locale: ptBR });
  }, []);

  // Update filter helper
  const updateFilter = <K extends keyof ReportFiltersState>(
    key: K,
    value: ReportFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Toggle year selection
  const toggleAno = (ano: string) => {
    const current = filters.anos || [];
    const updated = current.includes(ano)
      ? current.filter((a) => a !== ano)
      : [...current, ano];
    updateFilter('anos', updated);
  };

  // Toggle all years
  const toggleTodosAnos = () => {
    if (filters.anos.length === ANOS.length) {
      updateFilter('anos', []);
    } else {
      updateFilter('anos', [...ANOS]);
    }
  };

  // Toggle month selection
  const toggleMes = (mes: string) => {
    const current = filters.meses || [];
    const updated = current.includes(mes)
      ? current.filter((m) => m !== mes)
      : [...current, mes];
    updateFilter('meses', updated);
  };

  // Toggle all months
  const toggleTodosMeses = () => {
    if (filters.meses.length === MESES.length) {
      updateFilter('meses', []);
    } else {
      updateFilter('meses', MESES.map((m) => m.value));
    }
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.anos.length > 0 ||
    filters.meses.length > 0 ||
    !!filters.vendedorId;

  // Get selected year display
  const getAnosLabel = () => {
    if (filters.anos.length === 0) return 'Todos os anos';
    if (filters.anos.length === 1) return filters.anos[0];
    return `${filters.anos.length} anos`;
  };

  // Get selected month display
  const getMesesLabel = () => {
    if (filters.meses.length === 0) return 'Todos';
    if (filters.meses.length === 1) {
      return MESES.find((m) => m.value === filters.meses[0])?.label || 'Jan';
    }
    return `${filters.meses.length} meses`;
  };

  // Get vendedor display
  const getVendedorLabel = () => {
    if (!filters.vendedorId) return 'Todos os vendedores';
    const vendedor = vendedores.find((v) => v.id === filters.vendedorId);
    return vendedor?.nome || vendedor?.email || 'Vendedor';
  };

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
      {/* Header - sempre visível */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer hover:bg-muted/30 transition-colors gap-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Button
            variant={isExpanded ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              'gap-1.5 sm:gap-2 h-8 text-xs sm:text-sm px-2 sm:px-3',
              isExpanded && 'bg-primary text-primary-foreground'
            )}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="sm:w-4 sm:h-4"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span className="font-medium">Filtros</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </Button>
        </div>

        {/* Date indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border border-border bg-background text-xs sm:text-sm">
          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          <span className="capitalize">{currentMonthLabel}</span>
        </div>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-border/50 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {/* ANO */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                ANO
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-10 bg-background"
                  >
                    <span>{getAnosLabel()}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2 bg-popover z-50" align="start">
                  <div className="space-y-2">
                    {/* Toggle All */}
                    <div
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors'
                      )}
                      onClick={toggleTodosAnos}
                    >
                      <Checkbox
                        checked={filters.anos.length === ANOS.length}
                        className="pointer-events-none"
                      />
                      <span className="text-sm font-medium">Todos</span>
                    </div>
                    <div className="border-t border-border" />
                    {ANOS.map((ano) => {
                      const isSelected = filters.anos.includes(ano);
                      return (
                        <div
                          key={ano}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                            isSelected && 'bg-primary/10'
                          )}
                          onClick={() => toggleAno(ano)}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <span className="text-sm">{ano}</span>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* MÊS */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                MÊS
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-10 bg-background"
                  >
                    <span>{getMesesLabel()}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-3 bg-popover z-50" align="start">
                  <div className="space-y-3">
                    {/* Toggle All */}
                    <div
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors'
                      )}
                      onClick={toggleTodosMeses}
                    >
                      <Checkbox
                        checked={filters.meses.length === MESES.length}
                        className="pointer-events-none"
                      />
                      <span className="text-sm font-medium">Todos</span>
                    </div>
                    <div className="border-t border-border" />
                    {/* Month grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {MESES.map((mes) => {
                        const isSelected = filters.meses.includes(mes.value);
                        return (
                          <div
                            key={mes.value}
                            className={cn(
                              'flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors text-sm',
                              isSelected && 'bg-primary/10'
                            )}
                            onClick={() => toggleMes(mes.value)}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="pointer-events-none h-3.5 w-3.5"
                            />
                            <span>{mes.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* VENDEDOR */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                VENDEDOR
              </label>
              <Select
                value={filters.vendedorId || 'all'}
                onValueChange={(v) =>
                  updateFilter('vendedorId', v === 'all' ? null : v)
                }
              >
                <SelectTrigger className="w-full h-10 bg-background">
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {vendedores.map((vendedor) => (
                    <SelectItem key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome || vendedor.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
              onClick={onSearch}
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Buscar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
              onClick={onClear}
              disabled={!hasActiveFilters}
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export default initial state
export const defaultReportFilters: ReportFiltersState = {
  anos: [],
  meses: [],
  vendedorId: null,
};
