import { useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Calendar, Building2, Search, ArrowLeftRight, RotateCcw, User, Users, ChevronDown, ChevronUp, Filter, Award, X, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { VendedorFilter1004 } from './VendedorFilter1004';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { isContextoChevrolet10041 } from '@/utils/vendedores1004';

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};


const MESES = [
  { value: '01', label: 'janeiro' },
  { value: '02', label: 'fevereiro' },
  { value: '03', label: 'março' },
  { value: '04', label: 'abril' },
  { value: '05', label: 'maio' },
  { value: '06', label: 'junho' },
  { value: '07', label: 'julho' },
  { value: '08', label: 'agosto' },
  { value: '09', label: 'setembro' },
  { value: '10', label: 'outubro' },
  { value: '11', label: 'novembro' },
  { value: '12', label: 'dezembro' },
];

export const COMERCIAL_MESES = MESES;

function normalizeMesValue(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return String(n).padStart(2, '0');
}

export function normalizeMeses(values: unknown[] | undefined): string[] {
  return Array.from(new Set((values || []).map(normalizeMesValue).filter((v): v is string => !!v))).sort();
}

function safeParseISO(value: unknown): Date | null {
  if (!value) return null;
  const parsed = parseISO(String(value));
  return isValid(parsed) ? parsed : null;
}

export function safeFormatISO(value: unknown, pattern: string): string | null {
  const parsed = safeParseISO(value);
  if (!parsed) return null;
  return format(parsed, pattern, { locale: ptBR });
}

export function getMesLabel(value: unknown): string | null {
  const mes = normalizeMesValue(value);
  if (!mes) return null;
  const label = MESES.find((m) => m.value === mes)?.label;
  return label ? label.replace(/^./, (c) => c.toUpperCase()) : null;
}

// Picker unificado: Mês (multi) / Dia único / Período customizado
function MesPeriodoPicker({
  filters,
  onFiltersChange,
  anosSelecionados,
  mesesSelecionados,
  updatePeriodo,
}: {
  filters: ComercialFiltersType;
  onFiltersChange: (f: ComercialFiltersType) => void;
  anosSelecionados: string[];
  mesesSelecionados: string[];
  updatePeriodo: (anos: string[], meses: string[]) => void;
}) {
  const inicioISO = filters.periodo?.inicio;
  const fimISO = filters.periodo?.fim;
  const mesesNormalizados = useMemo(() => normalizeMeses(mesesSelecionados), [mesesSelecionados]);
  const isSingleDay = !!inicioISO && inicioISO === fimISO;

  // Detecta se o período é exatamente 1 mês inteiro (comportamento "mês")
  const isMesInteiro = useMemo(() => {
    if (!inicioISO || !fimISO || mesesNormalizados.length !== 1 || anosSelecionados.length !== 1) return false;
    const ini = safeParseISO(inicioISO);
    const fim = safeParseISO(fimISO);
    if (!ini || !fim) return false;
    const primeiro = new Date(ini.getFullYear(), ini.getMonth(), 1);
    const ultimo = new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
    return toISO(ini) === toISO(primeiro) && toISO(fim) === toISO(ultimo);
  }, [inicioISO, fimISO, anosSelecionados, mesesNormalizados]);

  const defaultTab = isSingleDay ? 'dia' : (!isMesInteiro && mesesNormalizados.length <= 1 && inicioISO !== fimISO ? 'periodo' : 'mes');
  const [tab, setTab] = useState<string>(defaultTab);

  const applyPeriodo = (inicio: string, fim: string) => {
    const ini = safeParseISO(inicio);
    const end = safeParseISO(fim);
    if (!ini || !end || ini > end) return;
    const anos = new Set<string>();
    const meses = new Set<string>();
    const cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
    const stop = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= stop) {
      anos.add(String(cur.getFullYear()));
      meses.add(String(cur.getMonth() + 1).padStart(2, '0'));
      cur.setMonth(cur.getMonth() + 1);
    }
    onFiltersChange({
      ...filters,
      anos: Array.from(anos).sort(),
      meses: Array.from(meses).sort(),
      periodo: { inicio, fim },
    });
  };

  const label = (() => {
    if (isSingleDay && inicioISO) {
      return safeFormatISO(inicioISO, 'dd/MM/yyyy') || 'Selecione';
    }
    if (mesesNormalizados.length === 12) return 'Ano completo';
    if (isMesInteiro) {
      return getMesLabel(mesesNormalizados[0]) || 'Selecione';
    }
    if (inicioISO && fimISO && inicioISO !== fimISO) {
      const inicioLabel = safeFormatISO(inicioISO, 'dd/MM');
      const fimLabel = safeFormatISO(fimISO, 'dd/MM/yyyy');
      return inicioLabel && fimLabel ? `${inicioLabel} - ${fimLabel}` : 'Selecione';
    }
    if (mesesNormalizados.length === 1) {
      return getMesLabel(mesesNormalizados[0]) || 'Selecione';
    }
    if (mesesNormalizados.length > 1) return `${mesesNormalizados.length} meses`;
    return 'Selecione';
  })();

  const toggleMes = (mes: string) => {
    const set = new Set(mesesNormalizados);
    if (set.has(mes)) set.delete(mes); else set.add(mes);
    const arr = Array.from(set).sort();
    updatePeriodo(anosSelecionados.length ? anosSelecionados : [String(new Date().getFullYear())], arr);
  };

  const toggleAllMeses = () => {
    const all = mesesNormalizados.length === 12 ? [] : MESES.map(m => m.value);
    updatePeriodo(anosSelecionados.length ? anosSelecionados : [String(new Date().getFullYear())], all);
  };

  const diaSelected = isSingleDay && inicioISO ? safeParseISO(inicioISO) || undefined : undefined;
  const inicioRange = safeParseISO(inicioISO);
  const fimRange = safeParseISO(fimISO);
  const rangeSelected = inicioRange && fimRange
    ? { from: inicioRange, to: fimRange }
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 w-full justify-between bg-background font-normal">
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-popover z-50" align="start">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="periodo">Período</TabsTrigger>
          </TabsList>

          <TabsContent value="mes" className="w-[240px] mt-0">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); toggleAllMeses(); }}
              className="w-full text-left text-xs text-primary hover:underline px-2 py-1 mb-1 border-b border-border pb-2"
            >
              {mesesNormalizados.length === 12 ? 'Limpar todos' : 'Selecionar todos'}
            </button>
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {MESES.map((m) => {
                const checked = mesesNormalizados.includes(m.value);
                return (
                  <button
                    type="button"
                    key={m.value}
                    onClick={(e) => { e.preventDefault(); toggleMes(m.value); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm text-left',
                      checked && 'bg-primary/10'
                    )}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span>{m.label.charAt(0).toUpperCase() + m.label.slice(1)}</span>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="dia" className="mt-0">
            <CalendarUI
              mode="single"
              selected={diaSelected}
              onSelect={(d) => {
                if (!d) return;
                const iso = toISO(d);
                applyPeriodo(iso, iso);
              }}
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </TabsContent>

          <TabsContent value="periodo" className="mt-0">
            <CalendarUI
              mode="range"
              selected={rangeSelected}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  applyPeriodo(toISO(range.from), toISO(range.to));
                }
              }}
              numberOfMonths={2}
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}



interface ComercialFiltersProps {
  filters: ComercialFiltersType;
  onFiltersChange: (filters: ComercialFiltersType) => void;
  onBuscar?: () => void;
  hasChanges?: boolean;
  // Opções disponíveis
  anos: string[];
  empresas?: string[];
  vendedores?: { codigo: string | number; nome: string }[];
  clientes?: { codigo: string | number; nome: string }[];
  marcas?: string[];
  showVendedorFilter?: boolean;
  showMarcaFilter?: boolean;
  showClienteFilter?: boolean;
  vendedorFilterVariant1004?: 'default' | 'campanhas';
  vendedorFilterEquipe1004?: 'transmissao' | 'chevrolet';
  collapsible?: boolean;
  /** Substitui o campo "Período" por um seletor de "Mês" limitado ao último mês fechado. */
  monthOnly?: boolean;
  /** Campos adicionais renderizados dentro do grid de filtros. */
  extraFields?: React.ReactNode;
  /** Renderiza apenas os campos, para uso dentro de uma superfície visual externa. */
  embedded?: boolean;
  /** Oculta a linha interna de ações quando a superfície externa já fornece Aplicar/Limpar. */
  hideActions?: boolean;
}

// Helper: obter mês atual no formato "01", "02", etc.
export function getMesAtual(): string {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

// Helper: obter ano atual
export function getAnoAtual(): string {
  return String(new Date().getFullYear());
}

// Helper: formata Date em YYYY-MM-DD usando componentes LOCAIS (evita shift de UTC)
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: para (ano, mes), retorna o "fim" do período:
// - se ano/mês forem o corrente → hoje (mês em andamento)
// - se for mês passado → último dia do mês
// - se for mês futuro → último dia do mês (mantém coerência)
export function computeFimPeriodo(ano: number, mes: number): string {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  if (ano === anoAtual && mes === mesAtual) {
    return toLocalISO(hoje);
  }
  const ultimoDia = new Date(ano, mes, 0);
  return toLocalISO(ultimoDia);
}

// Helper: retorna (ano, mes 1-12) do último mês fechado em relação a hoje.
// Ex.: hoje = 13/07/2026 → { ano: 2026, mes: 6 } (junho/2026).
export function getUltimoMesFechado(hoje: Date = new Date()): { ano: number; mes: number } {
  const primeiroDoMesCorrente = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDiaMesAnterior = new Date(primeiroDoMesCorrente.getTime() - 24 * 60 * 60 * 1000);
  return { ano: ultimoDiaMesAnterior.getFullYear(), mes: ultimoDiaMesAnterior.getMonth() + 1 };
}

// Helper: filtros padrão.
// Sempre abre no MÊS ATUAL (padrão do sistema).
export function getDefaultFilters(_periodoDisponivel?: { ultimoAno: string; ultimoMes: string } | null): ComercialFiltersType {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;


  const primeiroDia = new Date(ano, mes - 1, 1);

  return {
    anos: [String(ano)],
    meses: [String(mes).padStart(2, '0')],
    periodo: {
      inicio: toLocalISO(primeiroDia),
      fim: computeFimPeriodo(ano, mes),
    },
    status: 'todos',
    tipo: 'todos',
  };
}

// Helper: filtros padrão por empresa. Todas as empresas abrem no MÊS ATUAL.
export function getDefaultFiltersForEmpresa(
  _codEmpresa: string | null | undefined,
  _periodoDisponivel?: { ultimoAno: string; ultimoMes: string } | null,
  hoje: Date = new Date(),
): ComercialFiltersType {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const primeiroDia = new Date(ano, mes - 1, 1);
  return {
    anos: [String(ano)],
    meses: [String(mes).padStart(2, '0')],
    periodo: {
      inicio: toLocalISO(primeiroDia),
      fim: computeFimPeriodo(ano, mes),
    },
    status: 'todos',
    tipo: 'todos',
  };
}




export function ComercialFilters({
  filters,
  onFiltersChange,
  onBuscar,
  hasChanges = false,
  anos,
  empresas = [],
  vendedores = [],
  clientes = [],
  marcas = [],
  showVendedorFilter = false,
  showMarcaFilter = false,
  showClienteFilter = false,
  vendedorFilterVariant1004 = 'default',
  vendedorFilterEquipe1004 = 'transmissao',
  collapsible = false,
  monthOnly = false,
  extraFields,
  embedded = false,
  hideActions = false,
}: ComercialFiltersProps) {
  const { isMaster } = useAuth();
  const { codEmpresaAtiva, empresa } = useEmpresaAtiva();
  const { filialAtiva, filialNome } = useFilialSelecionada();
  const empresaComFilial = filialNome
    ? { ...empresa, nome: `${empresa?.nome ?? ''} ${filialNome}` }
    : empresa;
  const isChevrolet10041 = isContextoChevrolet10041(codEmpresaAtiva, filialAtiva, empresaComFilial);
  const isEmpresaPelegrini = isChevrolet10041 || ['1004', '10041'].includes(String(codEmpresaAtiva ?? '').trim());
  const equipeVendedor1004 = isChevrolet10041 ? 'chevrolet' : vendedorFilterEquipe1004;
  const [isExpanded, setIsExpanded] = useState(!collapsible);
  const [clienteSearch, setClienteSearch] = useState('');
  const vendedoresSignature = useMemo(
    () => vendedores
      .map((v) => `${String(v.codigo)}:${String(v.nome)}`)
      .sort()
      .join('|'),
    [vendedores],
  );

  const anosSelecionados = Array.from(
    new Set((filters.anos || []).map(String).filter((ano) => /^\d{4}$/.test(ano)))
  );
  const mesesSelecionados = normalizeMeses(filters.meses || []);

  // Atualiza o período com base nos anos e meses selecionados
  const updatePeriodo = (anosArr: string[], mesesArr: string[]) => {
    const anosValidos = Array.from(
      new Set(
        (anosArr || [])
          .map(Number)
          .filter((ano) => Number.isInteger(ano) && ano >= 2000 && ano <= 2100)
      )
    ).sort((a, b) => a - b);
    const mesesValidos = normalizeMeses(mesesArr || []);

    if (anosValidos.length === 0 || mesesValidos.length === 0) {
      onFiltersChange({
        ...filters,
        anos: anosValidos.map(String),
        meses: mesesValidos,
        periodo: undefined,
      });
      return;
    }

    const menorAno = anosValidos[0];
    const maiorAno = anosValidos[anosValidos.length - 1];
    const mesesNumericos = mesesValidos.map(Number);
    const menorMes = Math.min(...mesesNumericos);
    const maiorMes = Math.max(...mesesNumericos);

    const primeiroDia = new Date(menorAno, menorMes - 1, 1);

    onFiltersChange({
      ...filters,
      anos: anosValidos.map(String),
      meses: mesesValidos,
      periodo: {
        inicio: toLocalISO(primeiroDia),
        fim: computeFimPeriodo(maiorAno, maiorMes),
      },
    });
  };

  const handleVendedorChange = (value: string) => {
    onFiltersChange({
      ...filters,
      vendedor: value === 'todos' ? undefined : value,
    });
  };

  // Resumo do período selecionado
  const periodoResumo = useMemo(() => {
    if (anosSelecionados.length === 0 || mesesSelecionados.length === 0) {
      return 'Nenhum período';
    }
    
    const anosStr = anosSelecionados.length === 1 
      ? anosSelecionados[0] 
      : `${anosSelecionados.length} anos`;
    
    const mesesStr = mesesSelecionados.length === 1
      ? MESES.find(m => m.value === mesesSelecionados[0])?.label || mesesSelecionados[0]
      : mesesSelecionados.length === 12
        ? 'Ano completo'
        : `${mesesSelecionados.length} meses`;
    
    return `${mesesStr} de ${anosStr}`;
  }, [anosSelecionados, mesesSelecionados]);

  const handleAnoChange = (value: string) => {
    updatePeriodo([value], mesesSelecionados.length ? mesesSelecionados : [getMesAtual()]);
  };

  const handleMesChange = (value: string) => {
    if (value === 'todos') {
      updatePeriodo(anosSelecionados, MESES.map((m) => m.value));
    } else {
      updatePeriodo(anosSelecionados, [value]);
    }
  };


  const handleLimpar = () => {
    // Volta para o último mês fechado (mesma regra do fallback inicial),
    // evitando cair no mês corrente vazio.
    const { ano, mes } = getUltimoMesFechado();
    const anoStr = String(ano);
    const mesStr = String(mes).padStart(2, '0');
    onFiltersChange({
      ...filters,
      anos: [anoStr],
      meses: [mesStr],
      vendedor: undefined,
      vendedores: undefined,
      cliente: undefined,
      tipo: 'todos',
      periodo: {
        inicio: toLocalISO(new Date(ano, mes - 1, 1)),
        fim: computeFimPeriodo(ano, mes),
      },
    });
  };

  // Label de cada filtro reutilizável
  const FieldLabel = ({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) => (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );

  const mesAtualValue = mesesSelecionados.length === 12
    ? 'todos'
    : mesesSelecionados.length === 1
      ? mesesSelecionados[0]
      : '';

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          embedded
            ? 'min-w-0 p-0'
            : 'rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-4 shadow-sm',
        )}
      >
        {/* Header com toggle */}
        <CollapsibleTrigger asChild>
          <div className={cn(
            "mb-3 flex items-center justify-between gap-3",
            collapsible && "cursor-pointer"
          )}>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Filter className="h-4 w-4 text-primary" />
                Filtros
              </span>
              {collapsible && (
                <span className="text-xs text-muted-foreground">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {periodoResumo}
            </span>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4">
          {/* Grid de filtros */}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* Ano — multi-select */}
            <div className="space-y-1.5">
              <FieldLabel icon={Calendar}>Ano</FieldLabel>
              {(() => {
                const sel = anosSelecionados;
                const toggle = (ano: string) => {
                  const set = new Set(sel);
                  if (set.has(ano)) set.delete(ano); else set.add(ano);
                  const arr = Array.from(set).sort();
                  updatePeriodo(arr, mesesSelecionados.length ? mesesSelecionados : [getMesAtual()]);
                };
                const label = sel.length === 0 ? 'Selecione' : sel.length === 1 ? sel[0] : `${sel.length} anos`;
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-10 w-full justify-between bg-background font-normal">
                        <span className="truncate">{label}</span>
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[180px] p-2 bg-popover z-50" align="start">
                      <div className="max-h-64 overflow-y-auto space-y-0.5">
                        {anos.map((ano) => {
                          const checked = sel.includes(ano);
                          return (
                            <button
                              type="button"
                              key={ano}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(ano); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm text-left',
                                checked && 'bg-primary/10'
                              )}
                            >
                              <Checkbox checked={checked} className="pointer-events-none" />
                              <span>{ano}</span>
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })()}
            </div>

            {/* Mês / Dia / Período */}
            <div className="space-y-1.5">
              <FieldLabel icon={Calendar}>{monthOnly ? 'Mês' : 'Período'}</FieldLabel>
              {monthOnly ? (() => {
                const anoSel = Number(anosSelecionados[0] ?? new Date().getFullYear());
                // Mês fechado: sempre do 1º ao último dia do mês selecionado
                const selecionarMes = (v: string) => {
                  const mesNum = Number(v);
                  onFiltersChange({
                    ...filters,
                    anos: [String(anoSel)],
                    meses: [v],
                    periodo: {
                      inicio: toLocalISO(new Date(anoSel, mesNum - 1, 1)),
                      fim: toLocalISO(new Date(anoSel, mesNum, 0)),
                    },
                  });
                };
                return (
                  <Select
                    value={mesesSelecionados.length === 1 ? mesesSelecionados[0] : ''}
                    onValueChange={selecionarMes}
                  >
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {MESES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label.replace(/^./, (c) => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })() : (
                <MesPeriodoPicker
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  anosSelecionados={anosSelecionados}
                  mesesSelecionados={mesesSelecionados}
                  updatePeriodo={updatePeriodo}
                />
              )}
            </div>

            {extraFields}




            {/* Empresa - apenas master */}
            {isMaster && empresas.length > 1 && (
              <div className="space-y-1.5">
                <FieldLabel icon={Building2}>Empresa</FieldLabel>
                <Select
                  value={filters.vendedor?.toString() || 'todos'}
                  onValueChange={handleVendedorChange}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as empresas</SelectItem>
                    {empresas.filter((e) => e && e.trim() !== '').map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Vendedor — multi-select (com grupos predefinidos na 1004) */}
            <div className="space-y-1.5">
              <FieldLabel icon={User}>Vendedor</FieldLabel>
              {isEmpresaPelegrini ? (
                <VendedorFilter1004
                  key={`${equipeVendedor1004}:${filters.periodo?.inicio ?? ''}:${filters.periodo?.fim ?? ''}:${vendedoresSignature}`}
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  vendedores={vendedores}
                  variant={vendedorFilterVariant1004}
                  equipePadrao={equipeVendedor1004}
                />
              ) : (() => {
                const vendSel = (filters.vendedores || []).map(String);
                const toggleVend = (codigo: string) => {
                  const set = new Set(vendSel);
                  if (set.has(codigo)) set.delete(codigo); else set.add(codigo);
                  const arr = Array.from(set);
                  onFiltersChange({
                    ...filters,
                    vendedores: arr.length ? arr : undefined,
                    vendedor: arr.length === 1 ? arr[0] : undefined,
                  });
                };
                const clearVend = () => onFiltersChange({ ...filters, vendedores: undefined, vendedor: undefined });
                const selectAll = () => {
                  const all = vendedores.filter(v => v?.codigo != null && String(v.codigo).trim() !== '').map(v => String(v.codigo));
                  onFiltersChange({ ...filters, vendedores: all, vendedor: undefined });
                };
                const label = vendSel.length === 0
                  ? (vendedores.length === 0 ? 'Carregando...' : 'Todos')
                  : vendSel.length === 1
                    ? (vendedores.find(v => String(v.codigo) === vendSel[0])?.nome || vendSel[0])
                    : `${vendSel.length} selecionados`;
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={vendedores.length === 0}
                        className="h-10 w-full justify-between bg-background font-normal"
                      >
                        <span className="truncate">{label}</span>
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-2 bg-popover z-50" align="start">
                      <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-2 border-b border-border">
                        <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">
                          Selecionar todos
                        </button>
                        <button type="button" onClick={clearVend} className="text-xs text-muted-foreground hover:text-foreground">
                          Limpar
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-0.5">
                        {vendedores.filter((v) => v?.codigo != null && String(v.codigo).trim() !== '').map((v) => {
                          const code = String(v.codigo);
                          const checked = vendSel.includes(code);
                          return (
                            <button
                              type="button"
                              key={code}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleVend(code);
                              }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm text-left',
                                checked && 'bg-primary/10'
                              )}
                            >
                              <Checkbox checked={checked} className="pointer-events-none" />
                              <span className="truncate">{v.nome}</span>
                            </button>
                          );
                        })}
                      </div>

                    </PopoverContent>
                  </Popover>
                );
              })()}
            </div>

            {/* Cliente — busca por nome ou código */}
            {showClienteFilter && (() => {
              const clienteSel = filters.cliente != null ? String(filters.cliente) : '';
              const clienteSelObj = clienteSel
                ? clientes.find(c => String(c.codigo) === clienteSel)
                : undefined;
              const q = clienteSearch.trim().toLowerCase();
              const clientesFiltrados = q
                ? clientes.filter(c =>
                    String(c.codigo).toLowerCase().includes(q) ||
                    (c.nome || '').toLowerCase().includes(q)
                  ).slice(0, 100)
                : clientes.slice(0, 100);
              const label = clienteSelObj
                ? `${clienteSelObj.codigo} — ${clienteSelObj.nome}`
                : (clientes.length === 0 ? 'Carregando...' : 'Todos');
              return (
                <div className="space-y-1.5">
                  <FieldLabel icon={Users}>Cliente</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={clientes.length === 0}
                        className="h-10 w-full justify-between bg-background font-normal"
                      >
                        <span className="truncate">{label}</span>
                        {clienteSel ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onFiltersChange({ ...filters, cliente: undefined });
                            }}
                            className="ml-1 rounded p-0.5 hover:bg-muted"
                            aria-label="Limpar cliente"
                          >
                            <X className="h-3.5 w-3.5 opacity-70" />
                          </span>
                        ) : (
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-2 bg-popover z-50" align="start">
                      <div className="mb-2 flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={clienteSearch}
                          onChange={(e) => setClienteSearch(e.target.value)}
                          placeholder="Nome ou código..."
                          className="h-8 text-sm"
                        />
                      </div>
                      {clienteSel && (
                        <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-border">
                          <span className="text-[11px] text-muted-foreground truncate">
                            Selecionado: {clienteSelObj?.nome || clienteSel}
                          </span>
                          <button
                            type="button"
                            onClick={() => onFiltersChange({ ...filters, cliente: undefined })}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Limpar
                          </button>
                        </div>
                      )}
                      <div className="max-h-64 overflow-y-auto space-y-0.5">
                        {clientesFiltrados.length === 0 ? (
                          <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                            Nenhum cliente encontrado
                          </div>
                        ) : clientesFiltrados.map((c) => {
                          const code = String(c.codigo);
                          const checked = clienteSel === code;
                          return (
                            <button
                              type="button"
                              key={code}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onFiltersChange({
                                  ...filters,
                                  cliente: checked ? undefined : c.codigo,
                                });
                              }}
                              className={cn(
                                'w-full flex flex-col items-start gap-0.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm text-left',
                                checked && 'bg-primary/10'
                              )}
                            >
                              <span className="truncate w-full">{c.nome}</span>
                              <span className="text-[10px] text-muted-foreground">#{code}</span>
                            </button>
                          );
                        })}
                      </div>
                      {clientes.length > clientesFiltrados.length && !q && (
                        <div className="mt-1 px-2 pt-1 border-t border-border text-[10px] text-muted-foreground">
                          Exibindo {clientesFiltrados.length} de {clientes.length}. Refine a busca.
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })()}

            {/* Marca — multi-select */}
            {showMarcaFilter && (
              <div className="space-y-1.5">
                <FieldLabel icon={Award}>Marca</FieldLabel>
                {(() => {
                  const marcaSel = (filters.marcas || []).map(String);
                  const toggleMarca = (m: string) => {
                    const set = new Set(marcaSel);
                    if (set.has(m)) set.delete(m); else set.add(m);
                    const arr = Array.from(set);
                    onFiltersChange({
                      ...filters,
                      marcas: arr.length ? arr : undefined,
                      marca: arr.length === 1 ? arr[0] : undefined,
                    });
                  };
                  const clearMarca = () => onFiltersChange({ ...filters, marcas: undefined, marca: undefined });
                  const selectAll = () => onFiltersChange({ ...filters, marcas: marcas.slice(), marca: undefined });
                  const label = marcaSel.length === 0
                    ? (marcas.length === 0 ? 'Carregando...' : 'Todas')
                    : marcaSel.length === 1
                      ? marcaSel[0]
                      : `${marcaSel.length} selecionadas`;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={marcas.length === 0}
                          className="h-10 w-full justify-between bg-background font-normal"
                        >
                          <span className="truncate">{label}</span>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[260px] p-2 bg-popover z-50" align="start">
                        <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-2 border-b border-border">
                          <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">
                            Selecionar todas
                          </button>
                          <button type="button" onClick={clearMarca} className="text-xs text-muted-foreground hover:text-foreground">
                            Limpar
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-0.5">
                          {marcas.map((m) => {
                            const checked = marcaSel.includes(m);
                            return (
                              <button
                                type="button"
                                key={m}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMarca(m); }}
                                className={cn(
                                  'w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm text-left',
                                  checked && 'bg-primary/10'
                                )}
                              >
                                <Checkbox checked={checked} className="pointer-events-none" />
                                <span className="truncate">{m}</span>
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
              </div>
            )}

            {/* Tipo */}
            <div className="space-y-1.5">
              <FieldLabel icon={ArrowLeftRight}>Tipo</FieldLabel>
              <Select
                value={filters.tipo || 'todos'}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    tipo: value as 'todos' | 'PEDIDO' | 'DEVOLUCAO',
                  })
                }
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Ambos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Pedidos e devoluções</SelectItem>
                  <SelectItem value="PEDIDO">Apenas pedidos</SelectItem>
                  <SelectItem value="DEVOLUCAO">Apenas devoluções</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ações */}
          {!hideActions && (
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/40 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLimpar}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            {onBuscar && (
              <Button
                onClick={onBuscar}
                size="sm"
                className={cn('shadow-sm', hasChanges && 'animate-pulse ring-2 ring-primary/30')}
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            )}
          </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Função helper para obter o resumo dos filtros para o CollapsibleFilterBar
export function getComercialFiltersSummary(
  filters: ComercialFiltersType,
  vendedores?: { codigo: string | number; nome: string }[],
  clientes?: { codigo: string | number; nome: string }[],
) {
  const summary: { label: string; value: string | number }[] = [];
  
  if (filters.anos && filters.anos.length > 0) {
    summary.push({
      label: 'Anos',
      value: filters.anos.length === 1 ? filters.anos[0] : `${filters.anos.length} anos`,
    });
  }
  
  if (filters.meses && filters.meses.length > 0) {
    const mesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    if (filters.meses.length === 1) {
      const mesIndex = parseInt(filters.meses[0]) - 1;
      summary.push({ label: 'Mês', value: mesNomes[mesIndex] });
    } else if (filters.meses.length === 12) {
      summary.push({ label: 'Meses', value: 'Ano completo' });
    } else {
      summary.push({ label: 'Meses', value: `${filters.meses.length} selecionados` });
    }
  }
  
  if (filters.vendedores && filters.vendedores.length > 0) {
    if (filters.vendedores.length === 1) {
      const v = vendedores?.find(x => String(x.codigo) === String(filters.vendedores![0]));
      summary.push({ label: 'Vendedor', value: v?.nome || String(filters.vendedores[0]) });
    } else {
      summary.push({ label: 'Vendedores', value: `${filters.vendedores.length} selecionados` });
    }
  } else if (filters.vendedor) {
    const v = vendedores?.find(x => String(x.codigo) === String(filters.vendedor));
    summary.push({ label: 'Vendedor', value: v?.nome || String(filters.vendedor) });
  }

  if (filters.marcas && filters.marcas.length > 0) {
    summary.push({
      label: filters.marcas.length === 1 ? 'Marca' : 'Marcas',
      value: filters.marcas.length === 1 ? filters.marcas[0] : `${filters.marcas.length} selecionadas`,
    });
  } else if (filters.marca) {
    summary.push({ label: 'Marca', value: filters.marca });
  }

  if (filters.cliente != null && String(filters.cliente).trim() !== '') {
    const c = clientes?.find(x => String(x.codigo) === String(filters.cliente));
    summary.push({ label: 'Cliente', value: c?.nome || String(filters.cliente) });
  }

  if (filters.tipo && filters.tipo !== 'todos') {
    summary.push({
      label: 'Tipo',
      value: filters.tipo === 'PEDIDO' ? 'Pedidos' : 'Devoluções',
    });
  }

  return summary;
}

// Conta filtros ativos (excluindo os padrões)
export function countActiveFilters(filters: ComercialFiltersType): number {
  let count = 0;
  
  if (filters.anos && filters.anos.length > 0) count++;
  if (filters.meses && filters.meses.length > 0) count++;
  if (filters.vendedor) count++;
  if (filters.vendedores && filters.vendedores.length > 0) count++;
  if (filters.cliente) count++;
  if (filters.uf) count++;
  if (filters.status && filters.status !== 'todos') count++;
  if (filters.tipo && filters.tipo !== 'todos') count++;
  if (filters.marca) count++;
  if (filters.marcas && filters.marcas.length > 0) count++;

  return count;
}
