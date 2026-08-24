import { useEffect, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X, Users, UserCheck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import {
  EQUIPE_PRINCIPAL_1004_CODES,
  type EquipePadraoFiltro1004,
  getEquipePadraoFiltro1004,
  NAO_COMISSIONAVEIS_1004_CODES,
  VENDEDORES_EXTRAS_CAMPANHA_1004,
  montarVendedoresElegiveisFiltro1004,
} from '@/utils/vendedores1004';

// Códigos dos vendedores da Equipe Principal (Casa da Transmissão / Pelegrini 1004)
export const EQUIPE_PRINCIPAL_1004 = EQUIPE_PRINCIPAL_1004_CODES;

// Códigos excluídos do grupo "Somente comissionáveis"
export const NAO_COMISSIONAVEIS_1004 = NAO_COMISSIONAVEIS_1004_CODES;

interface Vendedor {
  codigo: string | number;
  nome: string;
}

interface Props {
  filters: ComercialFiltersType;
  onFiltersChange: (f: ComercialFiltersType) => void;
  vendedores: Vendedor[];
  variant?: 'default' | 'campanhas';
  equipePadrao?: EquipePadraoFiltro1004;
}

type Modo = 'todos' | 'equipe' | 'comissionaveis' | 'manual';

export function getSelecaoVisualVendedorFilter1004(modo: Modo, selecionados: string[], allCodes: string[]): string[] {
  return modo === 'todos' ? allCodes : selecionados;
}

export function toggleSelecaoVisualVendedorFilter1004(
  modo: Modo,
  selecionados: string[],
  allCodes: string[],
  codigo: string,
): string[] {
  const set = new Set(getSelecaoVisualVendedorFilter1004(modo, selecionados, allCodes));
  if (set.has(codigo)) set.delete(codigo);
  else set.add(codigo);
  return Array.from(set);
}

export function shouldShowVendedorGroupTabs1004(equipePadrao: EquipePadraoFiltro1004): boolean {
  return equipePadrao !== 'chevrolet';
}

function arraysEqualAsSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

export function VendedorFilter1004({ filters, onFiltersChange, vendedores, variant = 'default', equipePadrao = 'transmissao' }: Props) {
  const [search, setSearch] = useState('');
  const isCampanhas = variant === 'campanhas';
  const equipeConfig = useMemo(() => getEquipePadraoFiltro1004(equipePadrao), [equipePadrao]);
  const equipeCodes = equipeConfig.codes;
  const showGroupTabs = shouldShowVendedorGroupTabs1004(equipePadrao);

  const vendedoresElegiveis = useMemo(() => {
    if (equipePadrao === 'chevrolet') {
      return vendedores
        .filter((v) => v?.codigo != null && String(v.codigo).trim() !== '')
        .map((v) => ({ codigo: String(v.codigo), nome: String(v.nome || v.codigo) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    const base = montarVendedoresElegiveisFiltro1004(vendedores);
    if (!isCampanhas) return base;

    const byCode = new Map(base.map((v) => [String(v.codigo), v]));
    const equipe = EQUIPE_PRINCIPAL_1004_CODES.map((codigo) => {
      const found = byCode.get(codigo);
      return found ?? { codigo, nome: codigo };
    });

    const extras = VENDEDORES_EXTRAS_CAMPANHA_1004.map((extra) => ({
      codigo: extra.codigo,
      nome: extra.nome,
    }));

    return [...equipe, ...extras];
  }, [equipeConfig, equipePadrao, isCampanhas, vendedores]);

  const allCodes = useMemo(
    () => vendedoresElegiveis
      .filter(v => v?.codigo != null && String(v.codigo).trim() !== '')
      .map(v => String(v.codigo)),
    [vendedoresElegiveis],
  );

  const comissionaveisCodes = useMemo(
    () => allCodes.filter(c => !NAO_COMISSIONAVEIS_1004.includes(c)),
    [allCodes],
  );

  const selecionadosPersistidos = useMemo(
    () => (filters.vendedores || []).map(String),
    [filters.vendedores],
  );

  const selecionados = useMemo(() => {
    const deveUsarEquipePadrao = isCampanhas && selecionadosPersistidos.length === 0;
    return deveUsarEquipePadrao ? equipeCodes : selecionadosPersistidos;
  }, [equipeCodes, equipePadrao, isCampanhas, selecionadosPersistidos]);

  useEffect(() => {
    if (!filters.vendedores?.length || allCodes.length === 0) return;
    const permitidos = new Set(allCodes);
    const selecionadosValidos = selecionados.filter((codigo) => permitidos.has(codigo));
    if (selecionadosValidos.length === selecionados.length) return;

    const fallbackPadrao: string[] = [];
    const proximaSelecao = selecionadosValidos.length > 0 ? selecionadosValidos : fallbackPadrao;

    onFiltersChange({
      ...filters,
      vendedores: proximaSelecao.length ? proximaSelecao : undefined,
      vendedor: proximaSelecao.length === 1 ? proximaSelecao[0] : undefined,
    });
  }, [allCodes, equipeCodes, equipePadrao, filters, onFiltersChange, selecionados]);

  const modo: Modo = useMemo(() => {
    if (selecionados.length === 0) return 'todos';
    if (arraysEqualAsSet(selecionados, equipeCodes)) return 'equipe';
    if (allCodes.length > 0 && arraysEqualAsSet(selecionados, comissionaveisCodes)) return 'comissionaveis';
    return 'manual';
  }, [selecionados, equipeCodes, allCodes, comissionaveisCodes]);
  const selecionadosVisuais = useMemo(
    () => getSelecaoVisualVendedorFilter1004(modo, selecionados, allCodes),
    [modo, selecionados, allCodes],
  );

  const setSelecao = (codes: string[]) => {
    const normalized = isCampanhas && arraysEqualAsSet(codes, equipeCodes)
      ? equipeCodes
      : codes;
    onFiltersChange({
      ...filters,
      vendedores: normalized.length ? normalized : undefined,
      vendedor: normalized.length === 1 ? normalized[0] : undefined,
    });
  };

  const aplicarModo = (m: Modo) => {
    if (m === 'todos') setSelecao(isCampanhas ? allCodes : []);
    else if (m === 'equipe') setSelecao(equipeCodes);
    else if (m === 'comissionaveis') setSelecao(comissionaveisCodes);
    // 'manual' abre o popover sem alterar
  };

  const toggle = (codigo: string) => {
    setSelecao(toggleSelecaoVisualVendedorFilter1004(modo, selecionados, allCodes, codigo));
  };

  const label =
    modo === 'todos' ? (vendedoresElegiveis.length === 0 ? 'Carregando...' : 'Todos os vendedores')
    : modo === 'equipe' ? equipeConfig.label
    : modo === 'comissionaveis' ? `Somente comissionáveis (${selecionados.length})`
    : selecionados.length === 1
      ? (vendedoresElegiveis.find(v => String(v.codigo) === selecionados[0])?.nome || selecionados[0])
      : `${selecionados.length} selecionados`;

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendedoresElegiveis;
    return vendedoresElegiveis.filter(v =>
      String(v.nome).toLowerCase().includes(q) || String(v.codigo).includes(q)
    );
  }, [vendedoresElegiveis, search]);

  const ChipBtn = ({ active, onClick, children, icon: Icon }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
        active
          ? 'bg-primary/15 text-primary border-primary/40'
          : 'bg-background text-muted-foreground border-border hover:bg-muted',
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </button>
  );

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={vendedoresElegiveis.length === 0}
            className="h-10 w-full justify-between bg-background font-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-2 bg-popover z-50" align="start">
          {showGroupTabs && (
            <div className="grid grid-cols-3 gap-1 p-0.5 mb-2 rounded-md bg-muted/50">
              <button
                type="button"
                onClick={() => aplicarModo('todos')}
                className={cn(
                  'px-1.5 py-1 rounded text-[10px] font-semibold transition-colors',
                  modo === 'todos' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => aplicarModo('equipe')}
                className={cn(
                  'inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[10px] font-semibold transition-colors',
                  modo === 'equipe' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Users className="h-3 w-3" /> Equipe
              </button>
              <button
                type="button"
                onClick={() => aplicarModo('comissionaveis')}
                className={cn(
                  'inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[10px] font-semibold transition-colors',
                  modo === 'comissionaveis' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <UserCheck className="h-3 w-3" /> Comiss.
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 px-1 pb-2 mb-2 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelecao(isCampanhas ? equipeCodes : [])}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Limpar
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filtrados.filter(v => v?.codigo != null && String(v.codigo).trim() !== '').map(v => {
              const code = String(v.codigo);
              const checked = selecionadosVisuais.includes(code);
              return (
                <button
                  type="button"
                  key={code}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(code); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm text-left',
                    checked && 'bg-primary/10',
                  )}
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="truncate flex-1">{v.nome}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">#{code}</span>
                </button>
              );
            })}
            {filtrados.length === 0 && (
              <p className="px-2 py-4 text-xs text-center text-muted-foreground">Nenhum vendedor encontrado</p>
            )}
          </div>
        </PopoverContent>
      </Popover>


      {modo !== 'todos' && selecionados.length > 0 && selecionados.length <= 8 && (
        <div className="flex flex-wrap gap-1">
          {selecionados.map(code => {
            const v = vendedoresElegiveis.find(x => String(x.codigo) === code);
            return (
              <Badge key={code} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[10px]">
                {v?.nome || code}
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  className="ml-0.5 rounded p-0.5 hover:bg-background/60"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
