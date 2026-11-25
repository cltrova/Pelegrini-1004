import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const limiteDeOpcoes = 30;

function normalizarBusca(valor: string) {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function carregarMunicipios() {
  const { default: catalogo } = await import('./municipios-ibge.json');
  const municipios = catalogo.municipios.map(([nome, uf]) => ({
    rotulo: `${nome} - ${uf}`,
    nomeBusca: normalizarBusca(nome),
    uf: uf.toLowerCase(),
  }));
  return { municipios, ufs: new Set(municipios.map(({ uf }) => uf)) };
}

export function CidadeVisitaCampo() {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState('');
  const { data: catalogo, isPending, isError } = useQuery({
    queryKey: ['municipios-ibge-visitas'],
    queryFn: carregarMunicipios,
    enabled: aberto,
    staleTime: Infinity,
    retry: false,
  });

  const termos = normalizarBusca(busca).split(' ').filter(Boolean);
  const ultimoTermo = termos[termos.length - 1];
  const ufBuscada = catalogo?.ufs.has(ultimoTermo) ? termos.pop() : undefined;
  const opcoes = aberto && catalogo ? catalogo.municipios.filter(({ nomeBusca, uf }) =>
    (!ufBuscada || uf === ufBuscada) && termos.every((termo) => nomeBusca.includes(termo)),
  ) : [];
  const cidadeManual = !isPending && opcoes.length === 0 ? busca.trim() : '';

  function alterarAbertura(open: boolean) {
    setAberto(open);
    if (!open) setBusca('');
  }

  function selecionar(valor: string) {
    setCidade(valor);
    alterarAbertura(false);
  }

  return (
    <>
      <input type="hidden" name="cidade" value={cidade} />
      <Popover open={aberto} onOpenChange={alterarAbertura}>
        <PopoverTrigger asChild>
          <Button id="cidade" type="button" variant="outline" aria-describedby="cidade-valor"
            className="w-full justify-between px-3 font-normal">
            <span id="cidade-valor" className={cidade ? 'truncate' : 'truncate text-muted-foreground'}>
              {cidade || 'Selecionar cidade'}
            </span>
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} aria-label="Selecionar cidade"
          className="w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-content-available-width)] p-0">
          <Command label="Buscar cidade ou UF" shouldFilter={false}>
            <CommandInput placeholder="Buscar cidade ou UF" maxLength={200} value={busca} onValueChange={setBusca}
              className="text-base md:text-sm" />
            <CommandList className="max-h-[min(14rem,calc(var(--radix-popover-content-available-height)_-_4rem))]">
              <CommandGroup>
                {cidade && !busca && (
                  <CommandItem value="limpar-cidade" onSelect={() => selecionar('')} className="cursor-pointer">Limpar cidade</CommandItem>
                )}
                {opcoes.slice(0, limiteDeOpcoes).map(({ rotulo }) => (
                  <CommandItem key={rotulo} value={rotulo} onSelect={() => selecionar(rotulo)} className="cursor-pointer">
                    {rotulo}
                  </CommandItem>
                ))}
                {cidadeManual && (
                  <CommandItem value={`manual:${cidadeManual}`} onSelect={() => selecionar(cidadeManual)} className="cursor-pointer break-all">
                    Usar “{cidadeManual}”
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
            {isPending && <p role="status" className="px-3 py-2 text-xs text-muted-foreground">Carregando cidades…</p>}
            {isError && <p role="status" className="px-3 py-2 text-xs text-muted-foreground">Lista indisponível. Digite a cidade e a UF.</p>}
            {opcoes.length > limiteDeOpcoes && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">Digite mais para refinar a busca.</p>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
