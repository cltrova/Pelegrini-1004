import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X, Users, UserCheck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EQUIPE_PRINCIPAL_1004, NAO_COMISSIONAVEIS_1004 } from './VendedorFilter1004';

interface VendedorOpt {
  codigo: string;
  nome: string;
}

interface Props {
  vendedores: VendedorOpt[];
  selecionados: string[];
  onChange: (codes: string[]) => void;
}

type Modo = 'todos' | 'equipe' | 'comissionaveis' | 'manual';

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

export function ComissaoVendedorFilter({ vendedores, selecionados, onChange }: Props) {
  const [search, setSearch] = useState('');

  const allCodes = useMemo(() => vendedores.map((v) => v.codigo), [vendedores]);
  const comissionaveis = useMemo(
    () => allCodes.filter((c) => !NAO_COMISSIONAVEIS_1004.includes(c)),
    [allCodes],
  );

  const modo: Modo = useMemo(() => {
    if (selecionados.length === 0) return 'todos';
    if (sameSet(selecionados, EQUIPE_PRINCIPAL_1004)) return 'equipe';
    if (sameSet(selecionados, comissionaveis)) return 'comissionaveis';
    return 'manual';
  }, [selecionados, comissionaveis]);

  const toggle = (codigo: string) => {
    const set = new Set(selecionados);
    if (set.has(codigo)) set.delete(codigo);
    else set.add(codigo);
    onChange(Array.from(set));
  };

  const label =
    modo === 'todos'
      ? vendedores.length === 0
        ? 'Todos os vendedores'
        : 'Todos os vendedores'
      : modo === 'equipe'
        ? 'Equipe principal (5)'
        : modo === 'comissionaveis'
          ? `Somente comissionáveis (${selecionados.length})`
          : selecionados.length === 1
            ? vendedores.find((v) => v.codigo === selecionados[0])?.nome || selecionados[0]
            : `${selecionados.length} selecionados`;

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendedores;
    return vendedores.filter(
      (v) => v.nome.toLowerCase().includes(q) || v.codigo.includes(q),
    );
  }, [vendedores, search]);

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 w-full justify-between bg-background font-normal">
            <span className="truncate">{label}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-2 bg-popover z-50" align="start">
          <div className="grid grid-cols-3 gap-1 p-0.5 mb-2 rounded-md bg-muted/50">
            {([
              ['todos', 'Todos', undefined],
              ['equipe', 'Equipe', Users],
              ['comissionaveis', 'Comiss.', UserCheck],
            ] as const).map(([m, txt, Icon]) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  onChange(m === 'todos' ? [] : m === 'equipe' ? [...EQUIPE_PRINCIPAL_1004] : comissionaveis)
                }
                className={cn(
                  'inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[10px] font-semibold transition-colors',
                  modo === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {Icon && <Icon className="h-3 w-3" />} {txt}
              </button>
            ))}
          </div>

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
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Limpar
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filtrados.map((v) => {
              const checked = selecionados.includes(v.codigo);
              return (
                <button
                  type="button"
                  key={v.codigo}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(v.codigo); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm text-left',
                    checked && 'bg-primary/10',
                  )}
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="truncate flex-1">{v.nome}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">#{v.codigo}</span>
                </button>
              );
            })}
            {filtrados.length === 0 && (
              <p className="px-2 py-4 text-xs text-center text-muted-foreground">Nenhum vendedor encontrado</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selecionados.length > 0 && selecionados.length <= 8 && (
        <div className="flex flex-wrap gap-1">
          {selecionados.map((code) => (
            <Badge key={code} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[10px]">
              {vendedores.find((v) => v.codigo === code)?.nome || code}
              <button type="button" onClick={() => toggle(code)} className="ml-0.5 rounded p-0.5 hover:bg-background/60">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
