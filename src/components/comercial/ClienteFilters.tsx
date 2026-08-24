import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  X,
  Calendar,
  Users,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComercialFilters } from '@/types/comercial';

interface ClienteFiltersProps {
  filters: ComercialFilters;
  onFiltersChange: (filters: ComercialFilters) => void;
  anos: string[];
  vendedores: { codigo: string | number; nome: string }[];
  onSearch: () => void;
  onClear: () => void;
}

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function ClienteFilters({
  filters,
  onFiltersChange,
  anos,
  vendedores,
  onSearch,
  onClear,
}: ClienteFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchVendedor, setSearchVendedor] = useState('');

  const selectedAnosCount = filters.anos?.length || 0;
  const selectedMesesCount = filters.meses?.length || 0;
  const selectedVendedoresCount = filters.vendedores?.length || 0;

  const hasActiveFilters = selectedAnosCount > 0 || selectedMesesCount > 0 || selectedVendedoresCount > 0;

  const vendedoresFiltrados = useMemo(() => {
    if (!searchVendedor) return vendedores;
    return vendedores.filter(v => 
      v.nome.toLowerCase().includes(searchVendedor.toLowerCase())
    );
  }, [vendedores, searchVendedor]);

  const toggleAno = (ano: string) => {
    const current = filters.anos || [];
    const updated = current.includes(ano)
      ? current.filter(a => a !== ano)
      : [...current, ano];
    onFiltersChange({ ...filters, anos: updated });
  };

  const toggleMes = (mes: string) => {
    const current = filters.meses || [];
    const updated = current.includes(mes)
      ? current.filter(m => m !== mes)
      : [...current, mes];
    onFiltersChange({ ...filters, meses: updated });
  };

  const toggleVendedor = (codigo: string | number) => {
    const current = filters.vendedores || [];
    const updated = current.includes(codigo)
      ? current.filter(v => v !== codigo)
      : [...current, codigo];
    onFiltersChange({ ...filters, vendedores: updated });
  };

  const toggleTodosAnos = () => {
    if (selectedAnosCount === anos.length) {
      onFiltersChange({ ...filters, anos: [] });
    } else {
      onFiltersChange({ ...filters, anos: [...anos] });
    }
  };

  const toggleTodosMeses = () => {
    if (selectedMesesCount === 12) {
      onFiltersChange({ ...filters, meses: [] });
    } else {
      onFiltersChange({ ...filters, meses: MESES.map(m => m.value) });
    }
  };

  const toggleTodosVendedores = () => {
    if (selectedVendedoresCount === vendedores.length) {
      onFiltersChange({ ...filters, vendedores: [] });
    } else {
      onFiltersChange({ ...filters, vendedores: vendedores.map(v => v.codigo) });
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="bg-card border rounded-lg p-4 space-y-4">
        {/* Header com toggle */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Filtros</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  {selectedAnosCount + selectedMesesCount + selectedVendedoresCount} ativos
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro de Anos */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Anos</span>
                  </div>
                  {selectedAnosCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedAnosCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Anos</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleTodosAnos}
                      className="h-7 text-xs"
                    >
                      {selectedAnosCount === anos.length ? 'Limpar' : 'Todos'}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {anos.map(ano => (
                      <div
                        key={ano}
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-2 rounded-md px-1 py-1 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleAno(ano)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleAno(ano);
                          }
                        }}
                      >
                        <Checkbox
                          id={`ano-${ano}`}
                          checked={filters.anos?.includes(ano)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleAno(ano)}
                        />
                        <Label className="text-sm cursor-pointer select-none">
                          {ano}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Filtro de Meses */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Meses</span>
                  </div>
                  {selectedMesesCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedMesesCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Meses</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleTodosMeses}
                      className="h-7 text-xs"
                    >
                      {selectedMesesCount === 12 ? 'Limpar' : 'Todos'}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {MESES.map(mes => (
                      <div
                        key={mes.value}
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-2 rounded-md px-1 py-1 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleMes(mes.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleMes(mes.value);
                          }
                        }}
                      >
                        <Checkbox
                          id={`mes-${mes.value}`}
                          checked={filters.meses?.includes(mes.value)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleMes(mes.value)}
                        />
                        <Label className="text-sm cursor-pointer select-none">
                          {mes.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Filtro de Vendedores */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Vendedores</span>
                  </div>
                  {selectedVendedoresCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedVendedoresCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Vendedores</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleTodosVendedores}
                      className="h-7 text-xs"
                    >
                      {selectedVendedoresCount === vendedores.length ? 'Limpar' : 'Todos'}
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchVendedor}
                      onChange={(e) => setSearchVendedor(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {vendedoresFiltrados.map(v => (
                      <div
                        key={String(v.codigo)}
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-2 rounded-md px-1 py-1 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleVendedor(v.codigo)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleVendedor(v.codigo);
                          }
                        }}
                      >
                        <Checkbox
                          id={`vendedor-${v.codigo}`}
                          checked={filters.vendedores?.includes(v.codigo)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleVendedor(v.codigo)}
                        />
                        <Label className="text-sm cursor-pointer truncate select-none">
                          {v.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Ordenação */}
            <div className="flex gap-2">
              <Select
                value={filters.ordenacao || 'faturamento'}
                onValueChange={(value) => onFiltersChange({ 
                  ...filters, 
                  ordenacao: value as ComercialFilters['ordenacao'] 
                })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="faturamento">Faturamento</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="ultima_compra">Última Compra</SelectItem>
                  <SelectItem value="dias_sem_compra">Dias sem Compra</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onFiltersChange({
                  ...filters,
                  ordem: filters.ordem === 'asc' ? 'desc' : 'asc'
                })}
              >
                {filters.ordem === 'asc' ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClear} disabled={!hasActiveFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button onClick={onSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
