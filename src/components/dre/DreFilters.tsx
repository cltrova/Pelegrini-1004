import { useEffect, useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DreFilters as DreFiltersType } from '@/types/dre';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { formatDrePeriodoLabel, parseDreFilterDate, toDreFilterDate } from './dreFilterPeriod';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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

// Interface para código com descrição
interface CodigoInfo {
  codigo: string;
  descricao: string;
}

interface DreFiltersProps {
  filters: DreFiltersType;
  onFiltersChange: (filters: DreFiltersType) => void;
  onSearch?: () => void;
  empresas: string[];
  periodos: string[];
  anos: string[];
  grupos: string[];
  codigos: string[];
  // Novo: mapa de código para descrição
  codigoDescricaoMap?: Map<string, string>;
  // Vendedores (empresa 1001)
  vendedoresInternos?: string[];
  vendedoresExternos?: string[];
  empresasVendedorInterno?: string[];
  empresasVendedorExterno?: string[];
}

export function DreFilters({
  filters,
  onFiltersChange,
  onSearch,
  empresas,
  periodos,
  anos,
  grupos,
  codigos,
  codigoDescricaoMap,
  vendedoresInternos = [],
  vendedoresExternos = [],
  empresasVendedorInterno = [],
  empresasVendedorExterno = [],
}: DreFiltersProps) {
  const { isMaster } = useAuth();
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const is1002 = codEmpresaAtiva === '1002';
  const is1001 = codEmpresaAtiva === '1001';
  // 1002 (RPA) não usa filtros de vendedor no Financeiro.
  const mostrarVendedores = codEmpresaAtiva !== '1002';
  // Todos os filtros do Financeiro ficam sempre visíveis (mesmo sem opções retornadas)
  const mostrarSeletorEmpresa = true;
  const labelEmpresa = is1002 ? 'Filial' : 'Empresa';
  const labelTodas = is1002 ? 'Todas as filiais' : 'Todas as empresas';
  const codigosSelecionados = filters.codigos || [];
  const gruposSelecionados = filters.grupos || [];
  const vendInternosSelecionados = filters.vendedoresInternos || [];
  const vendExternosSelecionados = filters.vendedoresExternos || [];
  const empVendInternoSelecionados = filters.empresasVendedorInterno || [];
  const empVendExternoSelecionados = filters.empresasVendedorExterno || [];
  const [codigoSearch, setCodigoSearch] = useState('');
  const [expandedCodigos, setExpandedCodigos] = useState<Set<string>>(new Set());

  // Log técnico: informa quais campos de filtro vieram sem opções e a fonte usada
  useEffect(() => {
    const fontes: Record<string, { qtd: number; fonte: string }> = {
      Empresa: { qtd: empresas.length, fonte: 'DRE.empresa' },
      Periodo: { qtd: anos.length, fonte: 'DRE.ano_mes' },
      Grupos: { qtd: grupos.length, fonte: 'DRE.grupo' },
      'Nº Conta': { qtd: codigos.length, fonte: 'DRE.codigo/descricao' },
      'Vendedor Interno': { qtd: vendedoresInternos.length, fonte: 'DRE.Vendedor_Interno' },
      'Vendedor Externo': { qtd: vendedoresExternos.length, fonte: 'DRE.Vendedor_Externo' },
      'Empresa V. Interno': { qtd: empresasVendedorInterno.length, fonte: 'DRE.Empresa_Vendedor_Interno' },
      'Empresa V. Externo': { qtd: empresasVendedorExterno.length, fonte: 'DRE.Empresa_Vendedor_Externo' },
    };
    Object.entries(fontes)
      .filter(([, v]) => v.qtd === 0)
      .forEach(([campo, v]) =>
        console.warn(`[Financeiro/Filtros] Campo "${campo}" sem opções retornadas (fonte: ${v.fonte})`)
      );
  }, [empresas, anos, grupos, codigos, vendedoresInternos, vendedoresExternos, empresasVendedorInterno, empresasVendedorExterno]);

  // Combinar anos e meses selecionados para exibição
  const anosSelecionados = filters.anos || [];
  const mesesSelecionados = filters.meses || [];
  const [periodoTab, setPeriodoTab] = useState<string>(
    filters.dataInicio || filters.dataFim ? 'periodo' : 'ano'
  );

  const updateFilter = (key: keyof DreFiltersType, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (
    key: 'anos' | 'anoMes' | 'meses' | 'codigos' | 'grupos' | 'vendedoresInternos' | 'vendedoresExternos' | 'empresasVendedorInterno' | 'empresasVendedorExterno',
    value: string
  ) => {
    const current = (filters[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, updated.length > 0 ? updated : undefined);
  };

  // Toggle todos os anos
  const toggleTodosAnos = () => {
    if (anosSelecionados.length === anos.length) {
      updateFilter('anos', undefined);
    } else {
      updateFilter('anos', [...anos]);
    }
  };

  // Toggle todos os meses
  const toggleTodosMeses = () => {
    if (mesesSelecionados.length === MESES.length) {
      updateFilter('meses', undefined);
    } else {
      updateFilter('meses', MESES.map((m) => m.value));
    }
  };

  // Toggle todos os grupos
  const toggleTodosGrupos = () => {
    if (gruposSelecionados.length === grupos.length) {
      updateFilter('grupos', undefined);
    } else {
      updateFilter('grupos', [...grupos]);
    }
  };

  // Toggle todos os códigos
  const toggleTodosCodigos = () => {
    if (codigosSelecionados.length === codigos.length) {
      updateFilter('codigos', undefined);
    } else {
      updateFilter('codigos', [...codigos]);
    }
  };

  // Filtro de códigos - busca em código E descrição
  const codigosFiltrados = useMemo(() => {
    if (!codigoSearch.trim()) return codigos;
    const term = codigoSearch.toLowerCase();
    return codigos.filter((codigo) => {
      const descricao = codigoDescricaoMap?.get(codigo) || '';
      return codigo.toLowerCase().includes(term) || descricao.toLowerCase().includes(term);
    });
  }, [codigos, codigoSearch, codigoDescricaoMap]);

  // Toggle expandir/colapsar código
  const toggleExpandCodigo = (codigo: string) => {
    setExpandedCodigos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(codigo)) {
        newSet.delete(codigo);
      } else {
        newSet.add(codigo);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
    setCodigoSearch('');
  };

  // Construir label do período selecionado
  const getPeriodoLabel = () => {
    const anosCount = anosSelecionados.length;
    const mesesCount = mesesSelecionados.length;
    const { dataInicio, dataFim } = filters;
    const temPeriodo = Boolean(dataInicio || dataFim);
    
    if (anosCount === 0 && mesesCount === 0 && !temPeriodo) {
      return null;
    }
    
    const parts = [];
    if (anosCount > 0) {
      parts.push(`${anosCount} ano${anosCount > 1 ? 's' : ''}`);
    }
    if (mesesCount > 0) {
      parts.push(`${mesesCount} mês${mesesCount > 1 ? 'es' : ''}`);
    }
    if (temPeriodo) {
      const periodoFormatado = formatDrePeriodoLabel(dataInicio, dataFim);
      if (periodoFormatado) parts.push(periodoFormatado);
    }
    
    return parts.join(', ');
  };

  const periodoLabel = getPeriodoLabel();
  const selectedPeriodRange: DateRange | undefined = filters.dataInicio || filters.dataFim
    ? {
        from: parseDreFilterDate(filters.dataInicio),
        to: parseDreFilterDate(filters.dataFim),
      }
    : undefined;

  const handlePeriodoRangeChange = (range?: DateRange) => {
    onFiltersChange({
      ...filters,
      dataInicio: range?.from ? toDreFilterDate(range.from) : undefined,
      dataFim: range?.to ? toDreFilterDate(range.to) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {/* Período */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[280px] justify-between">
              {periodoLabel ? (
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    {anosSelecionados.length + mesesSelecionados.length + (filters.dataInicio || filters.dataFim ? 1 : 0)}
                  </Badge>
                  <span className="text-sm truncate">{periodoLabel}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Período</span>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto min-w-[240px] max-w-[calc(100vw-2rem)] p-2 bg-popover z-50" align="start">
            <div className="space-y-2">
              <Tabs value={periodoTab} onValueChange={setPeriodoTab} className="w-full">
                <TabsList className="grid grid-cols-3 w-full h-9 p-1 bg-muted/60">
                  <TabsTrigger value="ano" className="data-[state=active]:bg-background">Ano</TabsTrigger>
                  <TabsTrigger value="mes" className="data-[state=active]:bg-background">Mês</TabsTrigger>
                  <TabsTrigger value="periodo" className="data-[state=active]:bg-background">Período</TabsTrigger>
                </TabsList>

                <TabsContent value="ano" className="mt-2 w-[220px] px-1 pb-1">
                  <button
                    type="button"
                    onClick={toggleTodosAnos}
                    className="mb-2 px-1 text-left text-xs text-primary hover:underline"
                  >
                    {anos.length > 0 && anosSelecionados.length === anos.length
                      ? 'Limpar todos'
                      : 'Selecionar todos'}
                  </button>
                  <ScrollArea className="h-[220px] pr-1">
                    <div className="space-y-1 pr-3">
                      {anos.map((ano) => {
                        const isSelected = anosSelecionados.includes(ano);
                        return (
                          <button
                            key={ano}
                            type="button"
                            onClick={() => toggleArrayFilter('anos', ano)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-foreground'
                                : 'text-foreground hover:bg-muted/60'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary text-primary',
                                isSelected && 'bg-primary text-primary-foreground'
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </span>
                            <span>{ano}</span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="mes" className="mt-2 w-[220px] px-1 pb-1">
                  <button
                    type="button"
                    onClick={toggleTodosMeses}
                    className="mb-2 px-1 text-left text-xs text-primary hover:underline"
                  >
                    {mesesSelecionados.length === MESES.length ? 'Limpar todos' : 'Selecionar todos'}
                  </button>
                  <ScrollArea className="h-[220px] pr-1">
                    <div className="space-y-1 pr-3">
                      {MESES.map((mes) => {
                        const isSelected = mesesSelecionados.includes(mes.value);
                        return (
                          <button
                            key={mes.value}
                            type="button"
                            onClick={() => toggleArrayFilter('meses', mes.value)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-foreground'
                                : 'text-foreground hover:bg-muted/60'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary text-primary',
                                isSelected && 'bg-primary text-primary-foreground'
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </span>
                            <span>{mes.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="periodo" className="mt-0">
                  <CalendarUI
                    mode="range"
                    selected={selectedPeriodRange}
                    onSelect={handlePeriodoRangeChange}
                    numberOfMonths={2}
                    locale={ptBR}
                    defaultMonth={parseDreFilterDate(filters.dataInicio) || new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                  {(filters.dataInicio || filters.dataFim) && (
                    <div className="flex items-center justify-end border-t border-border/60 px-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onFiltersChange({ ...filters, dataInicio: undefined, dataFim: undefined })}
                        className="h-8 px-2 text-xs"
                      >
                        Limpar período
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </PopoverContent>
        </Popover>

        {/* Empresa / Filial */}
        {mostrarSeletorEmpresa && (
          <Select
            value={filters.empresa || 'all'}
            onValueChange={(v) => updateFilter('empresa', v === 'all' ? undefined : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={labelEmpresa} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labelTodas}</SelectItem>
              {empresas.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  Sem opções retornadas
                </SelectItem>
              ) : (
                empresas.map((empresa) => (
                  <SelectItem key={empresa} value={empresa}>
                    {empresa}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        {/* Grupos (Múltiplos) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-between">
              {gruposSelecionados.length > 0 ? (
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    {gruposSelecionados.length}
                  </Badge>
                  <span className="text-sm truncate">grupo(s)</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Grupos</span>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2" align="start">
            <div className="space-y-2">
              {/* Botão Todos/Limpar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTodosGrupos}
                className="w-full h-7 text-xs justify-start"
              >
                {gruposSelecionados.length === grupos.length ? 'Limpar seleção' : 'Selecionar todos'}
              </Button>
              <div className="border-t border-border" />
              <ScrollArea className="h-[200px]">
                <div className="space-y-1 pr-2">
                  {grupos.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem opções retornadas</p>
                  )}
                  {grupos.map((grupo) => {
                    const isSelected = gruposSelecionados.includes(grupo);
                    return (
                      <div
                        key={grupo}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                          isSelected && 'bg-primary/10'
                        )}
                        onClick={() => toggleArrayFilter('grupos', grupo)}
                      >
                        <Checkbox checked={isSelected} />
                        <span className="text-sm truncate">{grupo}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {/* Vendedor Interno / Externo (Múltiplos) - somente empresa 1001 */}
        {mostrarVendedores && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[210px] justify-between">
                {vendInternosSelecionados.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                      {vendInternosSelecionados.length}
                    </Badge>
                    <span className="text-sm truncate">vend. interno(s)</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Vendedor Interno</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-2" align="start">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateFilter(
                      'vendedoresInternos',
                      vendInternosSelecionados.length === vendedoresInternos.length ? undefined : [...vendedoresInternos]
                    )
                  }
                  className="w-full h-7 text-xs justify-start"
                >
                  {vendInternosSelecionados.length === vendedoresInternos.length ? 'Limpar seleção' : 'Selecionar todos'}
                </Button>
                <div className="border-t border-border" />
                <ScrollArea className="h-[240px]">
                  <div className="space-y-1 pr-2">
                    {vendedoresInternos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Sem opções retornadas</p>
                    )}
                    {vendedoresInternos.map((v) => {
                      const isSelected = vendInternosSelecionados.includes(v);
                      const label = v === '__SEM__' ? '(sem vendedor)' : v;
                      return (
                        <div
                          key={v}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                            isSelected && 'bg-primary/10'
                          )}
                          onClick={() => toggleArrayFilter('vendedoresInternos', v)}
                        >
                          <Checkbox checked={isSelected} />
                          <span className="text-sm truncate">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {mostrarVendedores && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[210px] justify-between">
                {vendExternosSelecionados.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                      {vendExternosSelecionados.length}
                    </Badge>
                    <span className="text-sm truncate">vend. externo(s)</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Vendedor Externo</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-2" align="start">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateFilter(
                      'vendedoresExternos',
                      vendExternosSelecionados.length === vendedoresExternos.length ? undefined : [...vendedoresExternos]
                    )
                  }
                  className="w-full h-7 text-xs justify-start"
                >
                  {vendExternosSelecionados.length === vendedoresExternos.length ? 'Limpar seleção' : 'Selecionar todos'}
                </Button>
                <div className="border-t border-border" />
                <ScrollArea className="h-[240px]">
                  <div className="space-y-1 pr-2">
                    {vendedoresExternos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Sem opções retornadas</p>
                    )}
                    {vendedoresExternos.map((v) => {
                      const isSelected = vendExternosSelecionados.includes(v);
                      const label = v === '__SEM__' ? '(sem vendedor)' : v;
                      return (
                        <div
                          key={v}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                            isSelected && 'bg-primary/10'
                          )}
                          onClick={() => toggleArrayFilter('vendedoresExternos', v)}
                        >
                          <Checkbox checked={isSelected} />
                          <span className="text-sm truncate">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Empresa Vend. Interno (Múltiplos) - somente 1001 */}
        {mostrarVendedores && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[220px] justify-between">
                {empVendInternoSelecionados.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                      {empVendInternoSelecionados.length}
                    </Badge>
                    <span className="text-sm truncate">emp. v. interno</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Empresa V. Interno</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-2" align="start">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateFilter(
                      'empresasVendedorInterno',
                      empVendInternoSelecionados.length === empresasVendedorInterno.length ? undefined : [...empresasVendedorInterno]
                    )
                  }
                  className="w-full h-7 text-xs justify-start"
                >
                  {empVendInternoSelecionados.length === empresasVendedorInterno.length ? 'Limpar seleção' : 'Selecionar todos'}
                </Button>
                <div className="border-t border-border" />
                <ScrollArea className="h-[240px]">
                  <div className="space-y-1 pr-2">
                    {empresasVendedorInterno.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Sem opções retornadas</p>
                    )}
                    {empresasVendedorInterno.map((v) => {
                      const isSelected = empVendInternoSelecionados.includes(v);
                      const label = v === '__SEM__' ? '(sem empresa)' : v;
                      return (
                        <div
                          key={v}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                            isSelected && 'bg-primary/10'
                          )}
                          onClick={() => toggleArrayFilter('empresasVendedorInterno', v)}
                        >
                          <Checkbox checked={isSelected} />
                          <span className="text-sm truncate">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Empresa Vend. Externo (Múltiplos) - somente 1001 */}
        {mostrarVendedores && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[220px] justify-between">
                {empVendExternoSelecionados.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                      {empVendExternoSelecionados.length}
                    </Badge>
                    <span className="text-sm truncate">emp. v. externo</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Empresa V. Externo</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-2" align="start">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateFilter(
                      'empresasVendedorExterno',
                      empVendExternoSelecionados.length === empresasVendedorExterno.length ? undefined : [...empresasVendedorExterno]
                    )
                  }
                  className="w-full h-7 text-xs justify-start"
                >
                  {empVendExternoSelecionados.length === empresasVendedorExterno.length ? 'Limpar seleção' : 'Selecionar todos'}
                </Button>
                <div className="border-t border-border" />
                <ScrollArea className="h-[240px]">
                  <div className="space-y-1 pr-2">
                    {empresasVendedorExterno.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Sem opções retornadas</p>
                    )}
                    {empresasVendedorExterno.map((v) => {
                      const isSelected = empVendExternoSelecionados.includes(v);
                      const label = v === '__SEM__' ? '(sem empresa)' : v;
                      return (
                        <div
                          key={v}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                            isSelected && 'bg-primary/10'
                          )}
                          onClick={() => toggleArrayFilter('empresasVendedorExterno', v)}
                        >
                          <Checkbox checked={isSelected} />
                          <span className="text-sm truncate">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        )}


        {/* Número de Conta (Múltiplos com pesquisa) - Descrição primeiro */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between">
              {codigosSelecionados.length > 0 ? (
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    {codigosSelecionados.length}
                  </Badge>
                  <span className="text-sm truncate">conta(s)</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Nº Conta</span>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-2" align="start">
            <div className="space-y-2">
              {/* Campo de pesquisa - busca código E descrição */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por descrição ou número..."
                  value={codigoSearch}
                  onChange={(e) => setCodigoSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              
              {/* Botão Todos/Limpar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTodosCodigos}
                className="w-full h-7 text-xs justify-start"
              >
                {codigosSelecionados.length === codigos.length ? 'Limpar seleção' : 'Selecionar todos'}
              </Button>
              <div className="border-t border-border" />
              
              {/* Lista de códigos - descrição primeiro, código expansível */}
              <ScrollArea className="h-[280px]">
                <div className="space-y-0.5 pr-2">
                  {codigosFiltrados.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma conta encontrada
                    </p>
                  ) : (
                    codigosFiltrados.map((codigo) => {
                      const isSelected = codigosSelecionados.includes(codigo);
                      const descricao = codigoDescricaoMap?.get(codigo) || codigo;
                      const isExpanded = expandedCodigos.has(codigo);
                      
                      return (
                        <div key={codigo} className="space-y-0">
                          {/* Linha principal - Descrição */}
                          <div
                            className={cn(
                              'flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-muted transition-colors',
                              isSelected && 'bg-primary/10'
                            )}
                          >
                            {/* Botão expandir */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandCodigo(codigo);
                              }}
                              className="flex-shrink-0 p-0.5 hover:bg-muted rounded"
                            >
                              <ChevronRight 
                                className={cn(
                                  'h-3 w-3 text-muted-foreground transition-transform',
                                  isExpanded && 'rotate-90'
                                )} 
                              />
                            </button>
                            
                            {/* Checkbox e Descrição */}
                            <div 
                              className="flex items-center gap-2 flex-1 min-w-0"
                              onClick={() => toggleArrayFilter('codigos', codigo)}
                            >
                              <Checkbox checked={isSelected} className="flex-shrink-0" />
                              <span className="text-sm truncate">{descricao}</span>
                            </div>
                          </div>
                          
                          {/* Linha expandida - Número da conta */}
                          {isExpanded && (
                            <div className="pl-10 pr-2 pb-1">
                              <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                {codigo}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {/* Limpar filtros */}
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Limpar filtros
        </Button>

        {/* Botão Buscar */}
        {onSearch && (
          <Button onClick={onSearch} className="ml-auto">
            Buscar
          </Button>
        )}
      </div>
    </div>
  );
}
