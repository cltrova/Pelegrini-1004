import { useEffect, useMemo, useState } from 'react';
import { Wallet, Calendar, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { SaldoAVencerTab, type SaldoAVencerFiltros } from '@/components/financeiro/SaldoAVencerTab';
import { SaldoAVencerExtraFields } from '@/components/financeiro/SaldoAVencerFiltros';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';


const TODOS = '__todos__';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function SaldoAVencerPage() {
  const hoje = new Date();
  const ANO_ATUAL = String(hoje.getFullYear());

  // Rascunho: alterado pelos campos, sem disparar busca
  const [ano, setAno] = useState<string>(TODOS);
  const [meses, setMeses] = useState<number[]>([]);
  const [extra, setExtra] = useState<SaldoAVencerFiltros>({});
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const draftFiltros: SaldoAVencerFiltros = {
    ...extra,
    ano,
    mes: meses.length > 0 ? meses.join(',') : TODOS,
  };

  // Aplicado: única fonte usada por cards, tabela e exportação
  const [appliedFiltros, setAppliedFiltros] = useState<SaldoAVencerFiltros>({
    ano: TODOS,
    mes: TODOS,
  });

  const { hasSearched, markSearched } = useFinanceiroSearch();

  // Nesta tela os dados já vêm carregados (sem exigir clique em "Buscar")
  useEffect(() => {
    if (!hasSearched) markSearched();
  }, [hasSearched, markSearched]);

  const anos = useMemo(() => {
    const atual = hoje.getFullYear();
    return [atual + 1, atual, atual - 1, atual - 2].map(String);
  }, [hoje]);

  const rotuloMeses = useMemo(() => {
    if (meses.length === 0) return 'Todos';
    if (meses.length === 1) return MESES[meses[0] - 1];
    if (meses.length === 12) return 'Todos';
    return `${meses.length} meses selecionados`;
  }, [meses]);

  const aplicar = () => {
    setAppliedFiltros(draftFiltros);
    markSearched();
  };



  return (
    <div className="enterprise-page-shell max-w-[1600px] animate-fade-in">
      <header className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saldo a Vencer</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos com valor pendente de pagamento, a partir de /comercial/pedidos.
          </p>

        </div>
      </header>

      <Card className="border-border/60">
        <button
          type="button"
          onClick={() => setFiltrosAbertos((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Filtros
          </span>
          <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`} />
        </button>
        {filtrosAbertos && (
        <CardContent className="grid gap-4 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Ano
            </div>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Mês
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between bg-background font-normal">
                  <span className="truncate">{rotuloMeses}</span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[240px] p-2 bg-popover z-50">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Selecione os meses</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setMeses([])}>
                    Todos
                  </Button>
                </div>
                <div className="max-h-[260px] overflow-y-auto space-y-0.5">
                  {MESES.map((m, i) => {
                    const num = i + 1;
                    const checked = meses.includes(num);
                    return (
                      <label
                        key={m}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMeses((prev) =>
                              prev.includes(num) ? prev.filter((p) => p !== num) : [...prev, num].sort((a, b) => a - b),
                            )
                          }
                        />
                        {m}
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>


          <SaldoAVencerExtraFields
            value={draftFiltros}
            onChange={({ ano: _a, mes: _m, ...rest }) => setExtra(rest)}
          />

          <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-5">
            <Button variant="outline" className="h-10" onClick={() => { setAno(TODOS); setMeses([]); setExtra({}); }}>
              Limpar
            </Button>
            <Button className="h-10" onClick={aplicar}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
        )}
      </Card>

      <SaldoAVencerTab filtros={appliedFiltros} />

    </div>
  );
}
