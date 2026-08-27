import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ComponentType, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CotacoesFilters, type CotacoesFilterOption } from '@/components/comercial/cotacoes/CotacoesFilters';
import { CotacaoDetailDrawer } from '@/components/comercial/cotacoes/CotacaoDetailDrawer';
import { CotacoesGestorPanel } from '@/components/comercial/cotacoes/CotacoesGestorPanel';
import { CotacoesKpis } from '@/components/comercial/cotacoes/CotacoesKpis';
import { CotacoesTable } from '@/components/comercial/cotacoes/CotacoesTable';
import { MotivoPerdaDialog } from '@/components/comercial/cotacoes/MotivoPerdaDialog';
import { useCotacoesAbertas, useVendasPerdidas } from '@/hooks/useCotacoesComerciais';
import {
  useMotivosPerda10041,
  useSalvarMotivoPerda10041,
  type MotivoPerda,
  type MotivoPerdaRegistro,
} from '@/hooks/useMotivosPerda';
import type { CotacaoComercial, CotacoesFiltros } from '@/types/cotacoesComerciais';
import { exportCotacoesExcel } from '@/utils/cotacoesExcel';

vi.mock('@/hooks/useCotacoesComerciais', () => ({
  useCotacoesAbertas: vi.fn(),
  useVendasPerdidas: vi.fn(),
}));

vi.mock('@/hooks/useMotivosPerda', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useMotivosPerda')>();
  return {
    ...original,
    useMotivosPerda10041: vi.fn(),
    useSalvarMotivoPerda10041: vi.fn(),
  };
});

vi.mock('@/utils/cotacoesExcel', () => ({
  exportCotacoesExcel: vi.fn(),
}));

const emptyFilters: CotacoesFiltros = {
  busca: '',
  vendedores: [],
  clientes: [],
  status: [],
  motivos: [],
  diasMin: null,
  diasMax: null,
};

const vendedores: CotacoesFilterOption[] = [{ value: '59', label: 'ERLAN C.CH' }];
const clientes: CotacoesFilterOption[] = [{ value: '88', label: 'OFICINA CENTRAL' }];
const motivos: CotacoesFilterOption<MotivoPerda>[] = [{ value: 'preco', label: 'Preço' }];

const rows: CotacaoComercial[] = [
  {
    idCotacao: '9012',
    numeroCotacao: '9012',
    dataCotacao: '2026-08-01',
    dataValidade: '2026-08-15',
    codCliente: '88',
    nomeCliente: 'OFICINA CENTRAL',
    codVendedor: '59',
    nomeVendedor: 'ERLAN C.CH',
    valor: 12_345.67,
    status: 'aberta',
    motivoErp: null,
    diasEmAberto: 19,
    raw: { segredo: 'nao mostrar' },
  },
  {
    idCotacao: '9013',
    numeroCotacao: '9013',
    dataCotacao: '2026-08-02',
    dataValidade: null,
    codCliente: '89',
    nomeCliente: 'MECANICA NORTE',
    codVendedor: '60',
    nomeVendedor: 'ANA SILVA',
    valor: 3_000,
    status: 'recusada',
    motivoErp: 'Preco',
    diasEmAberto: 18,
    raw: { segredo: 'tambem nao mostrar' },
  },
];

const savedReason: MotivoPerdaRegistro = {
  id: 'reason-9013',
  cod_empresa_bi: '10041',
  id_cotacao: '9013',
  motivo: 'concorrencia',
  observacao: 'Fechou com concorrente local.',
  created_by: 'user-1',
  created_at: '2026-08-20T10:00:00Z',
  updated_at: '2026-08-20T10:00:00Z',
};

function mockSaveReason(overrides: Record<string, unknown> = {}) {
  vi.mocked(useSalvarMotivoPerda10041).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(savedReason),
    isPending: false,
    ...overrides,
  } as never);
}

describe('lost quote reason dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveReason();
  });

  it('offers the fixed reason set and saves the selected reason for the canonical quote id', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(savedReason);
    const onOpenChange = vi.fn();
    mockSaveReason({ mutateAsync });

    render(<MotivoPerdaDialog open onOpenChange={onOpenChange} cotacao={rows[1]} registro={null} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Motivo da perda' }));
    expect(screen.getByText(/Cotação 9013/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Preço' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Prazo de entrega' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Condição de pagamento' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Concorrência' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Indisponibilidade de produto' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cliente desistiu' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cotação vencida' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Preço' }));
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: '  Cliente escolheu menor preço.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar motivo' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      idCotacao: '9013',
      motivo: 'preco',
      observacao: '  Cliente escolheu menor preço.  ',
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('preloads an existing reason for editing', () => {
    render(<MotivoPerdaDialog open onOpenChange={vi.fn()} cotacao={rows[1]} registro={savedReason} />);

    expect(screen.getByRole('combobox', { name: 'Motivo da perda' })).toHaveTextContent('Concorrência');
    expect(screen.getByLabelText('Observação')).toHaveValue('Fechou com concorrente local.');
  });

  it('requires an observation for Outro without calling the mutation', () => {
    const mutateAsync = vi.fn();
    mockSaveReason({ mutateAsync });
    render(<MotivoPerdaDialog open onOpenChange={vi.fn()} cotacao={rows[1]} registro={null} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Motivo da perda' }));
    fireEvent.click(screen.getByRole('option', { name: 'Outro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar motivo' }));

    expect(screen.getByText('Informe a observação para o motivo Outro.')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('keeps the dialog and user input after a save error and surfaces it inline', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Permissão negada.'));
    const onOpenChange = vi.fn();
    mockSaveReason({ mutateAsync });
    render(<MotivoPerdaDialog open onOpenChange={onOpenChange} cotacao={rows[1]} registro={null} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Motivo da perda' }));
    fireEvent.click(screen.getByRole('option', { name: 'Outro' }));
    fireEvent.change(screen.getByLabelText('Observação'), { target: { value: 'Cliente encerrou o projeto.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar motivo' }));

    expect(await screen.findByText('Permissão negada.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Motivo da perda' })).toHaveTextContent('Outro');
    expect(screen.getByLabelText('Observação')).toHaveValue('Cliente encerrou o projeto.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables dialog controls while a save is pending', () => {
    mockSaveReason({ isPending: true });
    render(<MotivoPerdaDialog open onOpenChange={vi.fn()} cotacao={rows[1]} registro={null} />);

    expect(screen.getByRole('combobox', { name: 'Motivo da perda' })).toBeDisabled();
    expect(screen.getByLabelText('Observação')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvando motivo' })).toBeDisabled();
  });
});

function FiltersHarness({
  mode,
  onApply,
}: {
  mode: 'abertas' | 'perdidas';
  onApply: (filters: CotacoesFiltros) => void;
}) {
  const [pendingFilters, setPendingFilters] = useState(emptyFilters);

  return (
    <CotacoesFilters
      mode={mode}
      pendingFilters={pendingFilters}
      onPendingFiltersChange={setPendingFilters}
      vendedores={vendedores}
      clientes={clientes}
      motivos={motivos}
      onApply={onApply}
      onClear={vi.fn()}
    />
  );
}

describe('shared commercial quote components', () => {
  it('renders dense quote columns and canonical customer data without exposing raw records', () => {
    render(<CotacoesTable mode="abertas" rows={rows} motivos={new Map()} />);

    expect(screen.getByRole('columnheader', { name: 'Cotacao' })).toBeInTheDocument();
    expect(screen.getAllByText('OFICINA CENTRAL')).toHaveLength(2);
    expect(screen.queryByText(/raw/i)).not.toBeInTheDocument();
    expect(screen.queryByText('nao mostrar')).not.toBeInTheDocument();
  });

  it('includes validity in each mobile open-quote card', () => {
    render(<CotacoesTable mode="abertas" rows={rows.slice(0, 1)} motivos={new Map()} />);

    const mobileCard = screen.getByRole('article');
    expect(within(mobileCard).getByText('Validade')).toBeInTheDocument();
    expect(within(mobileCard).getByText('15/08/2026')).toBeInTheDocument();
  });

  it('offers an accessible action to register a lost quote reason', () => {
    const onEditMotivo = vi.fn();

    render(<CotacoesTable mode="perdidas" rows={rows.slice(1)} motivos={new Map()} onEditMotivo={onEditMotivo} />);

    fireEvent.click(screen.getAllByRole('button', { name: /registrar motivo/i })[0]);

    expect(onEditMotivo).toHaveBeenCalledWith(rows[1]);
  });

  it('keeps pending filter changes local until the operator applies them', () => {
    const onApply = vi.fn();

    render(<FiltersHarness mode="abertas" onApply={onApply} />);

    fireEvent.change(screen.getByLabelText('Buscar cotacoes'), { target: { value: 'oficina' } });
    fireEvent.change(screen.getByLabelText('Dias minimos em aberto'), { target: { value: '-4' } });

    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ busca: 'oficina', diasMin: 0 }));
  });

  it('renders only controls that apply to the selected quote mode', () => {
    const { rerender } = render(<FiltersHarness mode="abertas" onApply={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Vendedores' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dias minimos em aberto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Motivos' })).not.toBeInTheDocument();

    rerender(<FiltersHarness mode="perdidas" onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Motivos' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Dias minimos em aberto')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getByRole('checkbox', { name: 'Cancelada' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Aberta' })).not.toBeInTheDocument();
  });

  it('keeps four stable KPI cells for the current quote mode', () => {
    render(
      <CotacoesKpis
        mode="abertas"
        kpis={{
          quantidade: 2,
          valorTotal: 15_345.67,
          ticketMedio: 7_672.835,
          tempoMedioEmAberto: 18.5,
          cotacoesVencidas: 1,
        }}
      />,
    );

    expect(screen.getByText('Cotacoes abertas')).toBeInTheDocument();
    expect(screen.getByText('Valor em aberto')).toBeInTheDocument();
    expect(screen.getByText('Tempo medio em aberto')).toBeInTheDocument();
    expect(screen.getByText('Cotacoes vencidas')).toBeInTheDocument();
  });

  it('renders the compact manager radar and suggested actions without replacing the table', () => {
    render(<CotacoesGestorPanel mode="abertas" rows={openRows} motivos={new Map()} onSelectCotacao={vi.fn()} />);

    expect(screen.getByLabelText('Radar do gestor')).toBeInTheDocument();
    expect(screen.getByText('Dinheiro parado')).toBeInTheDocument();
    expect(screen.getByText('O que fazer hoje')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Priorizar OFICINA CENTRAL/i })).toBeInTheDocument();
    expect(screen.getByText('15+ dias')).toBeInTheDocument();
  });

  it('opens a focused side drawer with score, quote summary and reason context', () => {
    render(
      <CotacaoDetailDrawer
        open
        onOpenChange={vi.fn()}
        mode="perdidas"
        cotacao={lostRows[0]}
        motivos={new Map([['9201', lostReasons[0]]])}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cotação 9201' })).toBeInTheDocument();
    expect(screen.getByText('Score gestor')).toBeInTheDocument();
    expect(screen.getByText('Motivo consolidado')).toBeInTheDocument();
    expect(screen.getByText('Preço')).toBeInTheDocument();
    expect(screen.getByText('Concorrente ofereceu desconto.')).toBeInTheDocument();
  });
});

const openRows: CotacaoComercial[] = [
  {
    idCotacao: '9101',
    numeroCotacao: '9101',
    dataCotacao: '2026-08-01',
    dataValidade: '2026-08-15',
    codCliente: '88',
    nomeCliente: 'OFICINA CENTRAL',
    codVendedor: '59',
    nomeVendedor: 'ERLAN C.CH',
    valor: 12_345.67,
    status: 'aberta',
    motivoErp: null,
    diasEmAberto: 19,
    raw: {},
  },
  {
    idCotacao: '9102',
    numeroCotacao: '9102',
    dataCotacao: '2026-08-13',
    dataValidade: '2026-08-30',
    codCliente: '89',
    nomeCliente: 'MECANICA NORTE',
    codVendedor: '60',
    nomeVendedor: 'ANA SILVA',
    valor: 3_000,
    status: 'aberta',
    motivoErp: null,
    diasEmAberto: 7,
    raw: {},
  },
  {
    idCotacao: '9103',
    numeroCotacao: '9103',
    dataCotacao: '2026-08-03',
    dataValidade: '2026-08-25',
    codCliente: '90',
    nomeCliente: 'AUTO PECAS SUL',
    codVendedor: '61',
    nomeVendedor: 'CARLA LIMA',
    valor: 2_500,
    status: 'aberta',
    motivoErp: null,
    diasEmAberto: 19,
    raw: {},
  },
];

type CotacoesAbertasPageModule = { default: ComponentType };

async function renderCotacoesAbertasPage(applyInitialSearch = true) {
  const pageModule = await import(/* @vite-ignore */ './CotacoesAbertasPage') as CotacoesAbertasPageModule;
  const result = render(<pageModule.default />);
  if (applyInitialSearch) fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
  return result;
}

function mockOpenQuotesQuery(overrides: Record<string, unknown> = {}) {
  vi.mocked(useCotacoesAbertas).mockReturnValue({
    data: openRows,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as never);
}

describe('open quotes page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 25));
    vi.clearAllMocks();
    mockOpenQuotesQuery();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows current-month defaults without querying until Apply and Clear restores pre-search', async () => {
    await renderCotacoesAbertasPage(false);

    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-08-25');
    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('heading', { name: 'Consulta ainda não realizada' })).toBeInTheDocument();
    expect(screen.getByLabelText('Radar do gestor')).toBeInTheDocument();
    expect(screen.getByText('O que fazer hoje')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma cotacao aberta encontrada.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });
    expect(screen.queryByRole('heading', { name: 'Consulta ainda não realizada' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('heading', { name: 'Consulta ainda não realizada' })).toBeInTheDocument();
  });

  it('loads the current month, displays quote KPIs, and keeps local search and aging out of the ERP query', async () => {
    await renderCotacoesAbertasPage();

    expect(screen.getByRole('heading', { name: /cotacoes abertas/i })).toBeInTheDocument();
    expect(screen.getByText('Valor em aberto')).toBeInTheDocument();
    expect(screen.getByText('Cotacoes vencidas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar/i })).toBeEnabled();
    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });

    fireEvent.change(screen.getByLabelText('Buscar cotacoes'), { target: { value: 'oficina' } });
    fireEvent.change(screen.getByLabelText('Dias minimos em aberto'), { target: { value: '18' } });

    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));

    expect(exportCotacoesExcel).toHaveBeenCalledWith({
      mode: 'abertas',
      rows: [openRows[0]],
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
    });
  });

  it('waits for Apply before sending period, seller, and customer controls to the ERP hook', async () => {
    await renderCotacoesAbertasPage();

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-08-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vendedores' }));
    fireEvent.click(screen.getByLabelText('ERLAN C.CH'));
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    fireEvent.click(screen.getByLabelText('OFICINA CENTRAL'));

    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-10',
      dataFim: '2026-08-20',
      codVendedor: '59',
      codCliente: '88',
    });
  });

  it('keeps multi-selected sellers local while omitting the single-value ERP dimension', async () => {
    await renderCotacoesAbertasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Vendedores' }));
    fireEvent.click(screen.getByLabelText('ERLAN C.CH'));
    fireEvent.click(screen.getByLabelText('ANA SILVA'));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });
    expect(screen.getByRole('table')).toHaveTextContent('9101');
    expect(screen.getByRole('table')).toHaveTextContent('9102');
    expect(screen.getByRole('table')).not.toHaveTextContent('9103');
  });

  it('clears pending and applied filters and returns to pre-search', async () => {
    await renderCotacoesAbertasPage();

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Buscar cotacoes'), { target: { value: 'oficina' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('table')).not.toHaveTextContent('9103');

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Buscar cotacoes')).toHaveValue('');
    expect(vi.mocked(useCotacoesAbertas)).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('heading', { name: 'Consulta ainda não realizada' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('sorts filtered quotes by open days descending and then oldest quote date without mutating hook rows', async () => {
    await renderCotacoesAbertasPage();

    const quoteNumbers = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);

    expect(quoteNumbers).toEqual(['9101', '9103', '9102']);
    expect(openRows.map((row) => row.numeroCotacao)).toEqual(['9101', '9102', '9103']);
  });

  it('disables export and explains when the applied filters have no matches', async () => {
    mockOpenQuotesQuery({ data: [] });

    await renderCotacoesAbertasPage();

    expect(screen.getAllByText('Nenhuma cotacao aberta encontrada.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /exportar/i })).toBeDisabled();
  });

  it('shows a loading skeleton while the initial query is pending', async () => {
    mockOpenQuotesQuery({ data: [], isLoading: true });

    await renderCotacoesAbertasPage();

    expect(screen.getByLabelText('Carregando cotacoes abertas')).toBeInTheDocument();
  });

  it('surfaces endpoint failures with a retry instead of rendering the empty success state', async () => {
    const refetch = vi.fn();
    mockOpenQuotesQuery({ data: [], isError: true, error: new Error('ERP indisponivel'), refetch });

    await renderCotacoesAbertasPage();

    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma cotacao aberta encontrada.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('identifies a missing 10041 integration configuration and keeps retry available', async () => {
    const refetch = vi.fn();
    mockOpenQuotesQuery({
      data: undefined,
      isError: true,
      error: Object.assign(new Error('Configure o endpoint ou a rota VPS para cotacoes.'), { kind: 'configuration' }),
      refetch,
    });

    await renderCotacoesAbertasPage();

    expect(screen.getByRole('heading', { name: 'Configuracao da integracao necessaria' })).toBeInTheDocument();
    expect(screen.getByText(/configure o endpoint ou a rota vps/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

const lostRows: CotacaoComercial[] = [
  {
    idCotacao: '9201',
    numeroCotacao: '9201',
    dataCotacao: '2026-08-02',
    dataValidade: '2026-08-16',
    codCliente: '88',
    nomeCliente: 'OFICINA CENTRAL',
    codVendedor: '59',
    nomeVendedor: 'ERLAN C.CH',
    valor: 12_000,
    status: 'recusada',
    motivoErp: null,
    diasEmAberto: 23,
    raw: {},
  },
  {
    idCotacao: '9202',
    numeroCotacao: '9202',
    dataCotacao: '2026-08-08',
    dataValidade: '2026-08-18',
    codCliente: '89',
    nomeCliente: 'MECANICA NORTE',
    codVendedor: '60',
    nomeVendedor: 'ANA SILVA',
    valor: 3_000,
    status: 'cancelada',
    motivoErp: 'Prazo de entrega',
    diasEmAberto: 17,
    raw: {},
  },
  {
    idCotacao: '9203',
    numeroCotacao: '9203',
    dataCotacao: '2026-08-15',
    dataValidade: '2026-08-20',
    codCliente: '90',
    nomeCliente: 'AUTO PECAS SUL',
    codVendedor: '61',
    nomeVendedor: 'CARLA LIMA',
    valor: 5_000,
    status: 'vencida',
    motivoErp: 'Prazo de entrega',
    diasEmAberto: 10,
    raw: {},
  },
];

const lostReasons: MotivoPerdaRegistro[] = [
  {
    ...savedReason,
    id: 'reason-9201',
    id_cotacao: ' 9201 ',
    motivo: 'preco',
    observacao: 'Concorrente ofereceu desconto.',
  },
  {
    ...savedReason,
    id: 'reason-9202',
    id_cotacao: '9202',
    motivo: 'concorrencia',
    observacao: 'Contrato mantido com fornecedor atual.',
  },
  {
    ...savedReason,
    id: 'reason-unrelated',
    id_cotacao: '9999',
    motivo: 'outro',
    observacao: 'Nao pertence ao resultado atual.',
  },
];

type VendasPerdidasPageModule = { default: ComponentType };

async function renderVendasPerdidasPage(applyInitialSearch = true) {
  const pageModule = await import(/* @vite-ignore */ './VendasPerdidasPage') as VendasPerdidasPageModule;
  const result = render(<pageModule.default />);
  if (applyInitialSearch) fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
  return result;
}

function mockLostQuotesQuery(overrides: Record<string, unknown> = {}) {
  vi.mocked(useVendasPerdidas).mockReturnValue({
    data: lostRows,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as never);
}

function mockLostReasonsQuery(overrides: Record<string, unknown> = {}) {
  vi.mocked(useMotivosPerda10041).mockReturnValue({
    data: lostReasons,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as never);
}

describe('lost sales page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 25));
    vi.clearAllMocks();
    mockLostQuotesQuery();
    mockLostReasonsQuery();
    mockSaveReason();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows current-month defaults without querying until Apply and Clear restores pre-search', async () => {
    await renderVendasPerdidasPage(false);

    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-08-25');
    expect(vi.mocked(useVendasPerdidas)).toHaveBeenLastCalledWith(null);
    expect(vi.mocked(useMotivosPerda10041)).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('heading', { name: 'Consulta ainda não realizada' })).toBeInTheDocument();
    expect(screen.getByLabelText('Radar do gestor')).toBeInTheDocument();
    expect(screen.getByText('O que fazer hoje')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma venda perdida encontrada.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(vi.mocked(useVendasPerdidas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });
    expect(vi.mocked(useMotivosPerda10041)).toHaveBeenLastCalledWith(['9201', '9202', '9203']);

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(vi.mocked(useVendasPerdidas)).toHaveBeenLastCalledWith(null);
    expect(vi.mocked(useMotivosPerda10041)).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('heading', { name: 'Consulta ainda não realizada' })).toBeInTheDocument();
  });

  it('loads the current month and joins registered reasons by canonical id for table, KPI, and Excel', async () => {
    await renderVendasPerdidasPage();

    expect(screen.getByRole('heading', { name: /vendas perdidas/i })).toBeInTheDocument();
    expect(vi.mocked(useVendasPerdidas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });
    expect(vi.mocked(useMotivosPerda10041)).toHaveBeenLastCalledWith(['9201', '9202', '9203']);
    expect(screen.getByText('Análise das perdas e registro dos motivos no período selecionado.')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Indicadores de cotacoes')).getByText('Preço')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Preço')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));

    const exportInput = vi.mocked(exportCotacoesExcel).mock.calls.at(-1)?.[0];
    expect(exportInput).toMatchObject({
      mode: 'perdidas',
      rows: lostRows,
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
    });
    expect(Array.from(exportInput?.motivos?.keys() ?? [])).toEqual(['9201', '9202']);
  });

  it('applies status and joined-reason filters only after Apply and exports that same filtered view', async () => {
    await renderVendasPerdidasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    fireEvent.click(screen.getByLabelText('Recusada'));
    fireEvent.click(screen.getByRole('button', { name: 'Motivos' }));
    fireEvent.click(screen.getByLabelText('Preço'));

    expect(within(screen.getByRole('table')).getByText('9202')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(within(screen.getByRole('table')).getByText('9201')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('9202')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Indicadores de cotacoes')).getByText('Preço')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    const exportInput = vi.mocked(exportCotacoesExcel).mock.calls.at(-1)?.[0];
    expect(exportInput?.rows).toEqual([lostRows[0]]);
    expect(Array.from(exportInput?.motivos?.keys() ?? [])).toEqual(['9201']);
  }, 15_000);

  it('uses the ERP reason when no persisted reason exists across table, filter, KPI, and export', async () => {
    await renderVendasPerdidasPage();

    expect(within(screen.getByRole('table')).getByText('Prazo de entrega')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Motivos' }));
    fireEvent.click(screen.getByLabelText('Prazo de entrega'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(within(screen.getByRole('table')).getByText('9203')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('9202')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Indicadores de cotacoes')).getByText('Prazo de entrega')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    const exportInput = vi.mocked(exportCotacoesExcel).mock.calls.at(-1)?.[0];
    expect(exportInput?.rows).toEqual([lostRows[2]]);
    expect(Array.from(exportInput?.motivos?.keys() ?? [])).toEqual([]);
  });

  it('sends one seller and customer to ERP, but keeps multiple selections broad and filters locally', async () => {
    const firstRender = await renderVendasPerdidasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Vendedores' }));
    fireEvent.click(screen.getByLabelText('ERLAN C.CH'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    fireEvent.click(screen.getByLabelText('OFICINA CENTRAL'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(vi.mocked(useVendasPerdidas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: '59',
      codCliente: '88',
    });

    firstRender.unmount();
    await renderVendasPerdidasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Vendedores' }));
    fireEvent.click(screen.getByLabelText('ERLAN C.CH'));
    fireEvent.click(screen.getByLabelText('ANA SILVA'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    fireEvent.click(screen.getByLabelText('OFICINA CENTRAL'));
    fireEvent.click(screen.getByLabelText('MECANICA NORTE'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(vi.mocked(useVendasPerdidas)).toHaveBeenLastCalledWith({
      dataIni: '2026-08-01',
      dataFim: '2026-08-25',
      codVendedor: null,
      codCliente: null,
    });
    expect(within(screen.getByRole('table')).getByText('9201')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('9202')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('9203')).not.toBeInTheDocument();
  }, 15_000);

  it('clears pending and applied filters and returns to pre-search', async () => {
    await renderVendasPerdidasPage();

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Buscar cotacoes'), { target: { value: 'oficina' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(within(screen.getByRole('table')).queryByText('9203')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Buscar cotacoes')).toHaveValue('');
    expect(vi.mocked(useVendasPerdidas)).toHaveBeenLastCalledWith(null);
    expect(vi.mocked(useMotivosPerda10041)).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('heading', { name: 'Consulta ainda não realizada' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('surfaces ERP configuration failures and retries ERP plus reasons', async () => {
    const refetchErp = vi.fn();
    const refetchReasons = vi.fn();
    mockLostQuotesQuery({
      data: undefined,
      isError: true,
      error: Object.assign(new Error('Configure o endpoint ou a rota VPS para cotações.'), { kind: 'configuration' }),
      refetch: refetchErp,
    });
    mockLostReasonsQuery({ data: undefined, refetch: refetchReasons });

    await renderVendasPerdidasPage();

    expect(screen.getByRole('heading', { name: 'Configuração da integração necessária' })).toBeInTheDocument();
    expect(screen.getByText('Configure o endpoint ou a rota VPS para cotações.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma venda perdida encontrada.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetchErp).toHaveBeenCalledTimes(1);
    expect(refetchReasons).toHaveBeenCalledTimes(1);
  });

  it('does not render failed reason data as valid rows and retries ERP plus Supabase', async () => {
    const refetchErp = vi.fn();
    const refetchReasons = vi.fn();
    mockLostQuotesQuery({ refetch: refetchErp });
    mockLostReasonsQuery({
      data: undefined,
      isError: true,
      error: new Error('Supabase indisponível.'),
      refetch: refetchReasons,
    });

    await renderVendasPerdidasPage();

    expect(screen.getByRole('heading', { name: 'Erro ao carregar motivos das perdas' })).toBeInTheDocument();
    expect(screen.getByText('Supabase indisponível.')).toBeInTheDocument();
    expect(screen.queryByText('Não registrado')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhuma venda perdida encontrada.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetchErp).toHaveBeenCalledTimes(1);
    expect(refetchReasons).toHaveBeenCalledTimes(1);
  });

  it('preloads an existing reason from the joined row when editing', async () => {
    await renderVendasPerdidasPage();

    fireEvent.click(within(screen.getByRole('table')).getAllByRole('button', { name: 'Editar motivo da perda' })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Motivo da perda' })).toHaveTextContent('Preço');
    expect(screen.getByLabelText('Observação')).toHaveValue('Concorrente ofereceu desconto.');
  });
});
