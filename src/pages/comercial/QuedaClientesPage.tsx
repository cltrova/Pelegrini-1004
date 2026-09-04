import { useMemo, useState } from 'react';
import { useComercialData } from '@/hooks/useComercialData';
import { useAgrupadoCliente } from '@/hooks/useComercialAgrupado';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, Loader2 } from 'lucide-react';
import { QuedaKPIs } from '@/components/comercial/queda/QuedaKPIs';
import { QuedaGraficos } from '@/components/comercial/queda/QuedaGraficos';
import { QuedaBlocosAnaliticos } from '@/components/comercial/queda/QuedaBlocosAnaliticos';
import {
  agregarQuedaClientes,
  mapAgrupadoClientesToQueda,
  rotuloPeriodo,
  type Granularidade,
  type SituacaoCliente,
} from '@/utils/quedaClientes';
import type { ComercialFilters } from '@/types/comercial';

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseISO(s: string): Date { return new Date(s + 'T00:00:00'); }

const JANELA_DIAS: Record<Granularidade, number> = {
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
};

const JANELA_TEXTO: Record<Granularidade, string> = {
  semanal: '7 dias',
  quinzenal: '15 dias',
  mensal: '30 dias',
};

interface Props {
  /** Período aplicado na barra de filtros da tela de Clientes (botão Buscar). */
  periodo?: { inicio: string; fim: string };
}

export default function QuedaClientesPage({ periodo }: Props) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const isEmpresa1003 = String(codEmpresaAtiva ?? '').trim() === '1003';

  const [granularidade, setGranularidade] = useState<Granularidade>('mensal');
  const [clienteFoco, setClienteFoco] = useState<string | null>(null);
  const [situacaoFoco, setSituacaoFoco] = useState<SituacaoCliente | null>(null);

  // Referência: fim do período aplicado nos filtros (ou hoje).
  const dataRef = periodo?.fim ? parseISO(periodo.fim) : new Date();

  const dias = JANELA_DIAS[granularidade];
  const atualFim = new Date(dataRef);
  const atualInicio = new Date(dataRef);
  atualInicio.setDate(atualInicio.getDate() - (dias - 1));
  const anteriorFim = new Date(atualInicio);
  anteriorFim.setDate(anteriorFim.getDate() - 1);
  const anteriorInicio = new Date(anteriorFim);
  anteriorInicio.setDate(anteriorInicio.getDate() - (dias - 1));

  const isoAtual = { inicio: toISO(atualInicio), fim: toISO(atualFim) };
  const isoAnterior = { inicio: toISO(anteriorInicio), fim: toISO(anteriorFim) };
  const labelAtual = rotuloPeriodo(isoAtual.inicio, isoAtual.fim);
  const labelAnterior = rotuloPeriodo(isoAnterior.inicio, isoAnterior.fim);

  // 1003 (Ideal): usa os totalizadores de /comercial/agrupado?grupo=CLIENTE
  // nos dois períodos. Demais empresas: agregação local dos pedidos.
  const { data: rowsAtual, isLoading: loadingAtual } = useAgrupadoCliente(
    isoAtual,
    { enabled: isEmpresa1003 },
  );
  const { data: rowsAnterior, isLoading: loadingAnterior } = useAgrupadoCliente(
    isoAnterior,
    { enabled: isEmpresa1003 },
  );

  const filtros: ComercialFilters = useMemo(() => ({
    periodo: { inicio: isoAnterior.inicio, fim: isoAtual.fim },
    status: 'todos',
    tipo: 'todos',
  }), [isoAnterior.inicio, isoAtual.fim]);

  const { pedidos, isLoading: isLoadingLocal } = useComercialData(filtros, { enabled: !isEmpresa1003 });

  const clientes = useMemo(
    () => isEmpresa1003
      ? mapAgrupadoClientesToQueda(rowsAtual, rowsAnterior)
      : agregarQuedaClientes(
          pedidos,
          { inicio: atualInicio, fim: atualFim },
          { inicio: anteriorInicio, fim: anteriorFim },
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEmpresa1003, rowsAtual, rowsAnterior, pedidos, isoAtual.inicio, isoAtual.fim],
  );

  const isLoading = isEmpresa1003 ? (loadingAtual || loadingAnterior) : isLoadingLocal;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <Card className="shrink-0 border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Comparando o que cada cliente comprou nos últimos {JANELA_TEXTO[granularidade]} contra os {JANELA_TEXTO[granularidade]} anteriores.
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Agora:</span> {labelAtual}
                <span className="mx-2">·</span>
                <span className="font-medium text-foreground">Antes:</span> {labelAnterior}
              </p>
              <p className="text-[11px] text-muted-foreground">
                A data final segue o período escolhido nos filtros acima (aplicado ao clicar em Buscar).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Tabs value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
              <TabsList>
                <TabsTrigger value="semanal">Semanal</TabsTrigger>
                <TabsTrigger value="quinzenal">Quinzenal</TabsTrigger>
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
              </TabsList>
            </Tabs>
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Atualizando dados...
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        <QuedaKPIs clientes={clientes} isLoading={isLoading} />
        <QuedaGraficos
          clientes={clientes}
          labelAtual={labelAtual}
          labelAnterior={labelAnterior}
          isLoading={isLoading}
          clienteSelecionado={clienteFoco}
          onSelectCliente={setClienteFoco}
          situacaoSelecionada={situacaoFoco}
          onSelectSituacao={setSituacaoFoco}
        />
        <QuedaBlocosAnaliticos
          clientes={clientes}
          labelAtual={labelAtual}
          labelAnterior={labelAnterior}
          situacaoExterna={situacaoFoco}
          onSituacaoExterna={setSituacaoFoco}
          clienteFoco={clienteFoco}
          onLimparClienteFoco={() => setClienteFoco(null)}
        />
      </div>
    </div>
  );
}
