import { useId, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface OperacaoFiscalOpcao {
  codigo: string;
  nome: string;
}

interface Props {
  operacoes: OperacaoFiscalOpcao[];
  // Null means the default range; an empty array means no operations selected.
  selecionados: string[] | null;
  onChange: (codigos: string[]) => void;
  isLoading?: boolean;
  error?: string;
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function ComissaoOperacaoFilter({ operacoes, selecionados, onChange, isLoading = false, error }: Props) {
  const id = useId();
  const [busca, setBusca] = useState('');
  const padrao = operacoes
    .filter(({ codigo }) => /^\d+$/.test(codigo) && Number(codigo) <= 62)
    .map(({ codigo }) => codigo);
  const selecionadosAtuais = selecionados ?? padrao;
  const selecionadosSet = new Set(selecionadosAtuais);
  const quantidade = operacoes.filter(({ codigo }) => selecionadosSet.has(codigo)).length;
  const termo = normalizar(busca);
  const filtradas = operacoes.filter(({ codigo, nome }) => normalizar(`${codigo} ${nome}`).includes(termo));
  const indisponivel = isLoading || !!error || operacoes.length === 0;
  const resumo = isLoading ? 'Carregando operações…'
    : error ? 'Operações indisponíveis'
      : operacoes.length === 0 ? 'Nenhuma operação disponível'
        : quantidade === 0 ? 'Nenhuma operação selecionada'
          : `${quantidade} selecionadas`;

  const alterar = (codigo: string, checked: boolean) => {
    const proxima = new Set(selecionadosAtuais);
    if (checked) proxima.add(codigo);
    else proxima.delete(codigo);
    onChange(operacoes.filter((op) => proxima.has(op.codigo)).map((op) => op.codigo));
  };

  return (
    <div className="min-w-0">
      <Popover onOpenChange={(open) => { if (!open) setBusca(''); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={indisponivel}
            aria-label={`Operações fiscais: ${resumo}`}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-10 w-full min-w-0 justify-between gap-2 bg-background font-normal"
          >
            <span className="truncate">{resumo}</span>
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Buscar operação por código ou descrição"
              placeholder="Código ou descrição"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              className="h-8 pl-8"
            />
          </div>
          <div className="my-2 flex flex-wrap gap-1 border-b pb-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange(operacoes.map((op) => op.codigo))}>
              Selecionar todas
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange([])}>
              Limpar seleção
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange(padrao)}>
              Padrão 0 a 62
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto" role="group" aria-label="Operações disponíveis">
            {filtradas.map(({ codigo, nome }) => (
              <label key={codigo} className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm transition-colors duration-150 hover:bg-muted focus-within:bg-muted motion-reduce:transition-none">
                <Checkbox
                  checked={selecionadosSet.has(codigo)}
                  onCheckedChange={(checked) => alterar(codigo, checked === true)}
                  aria-label={`${codigo} - ${nome}`}
                  className="shrink-0"
                />
                <span className="min-w-0 break-words">{codigo} - {nome}</span>
              </label>
            ))}
            {filtradas.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma operação encontrada</p>}
          </div>
        </PopoverContent>
      </Popover>
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
