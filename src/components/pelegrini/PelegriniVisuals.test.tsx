import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark } from './PelegriniBrandMark';
import { PelegriniBranchBadge } from './PelegriniBranchBadge';
import { PelegriniBranchPanel } from './PelegriniBranchPanel';
import { PelegriniBranchVisual } from './PelegriniBranchVisual';
import { PelegriniChartFrame } from './PelegriniChartFrame';
import { PelegriniDataPanel } from './PelegriniDataPanel';
import { PelegriniKpiCard } from './PelegriniKpiCard';
import { PelegriniModuleHeader } from './PelegriniModuleHeader';
import { PelegriniPageSurface } from './PelegriniPageSurface';
import { PelegriniOperationalCard } from './PelegriniOperationalCard';
import { PelegriniBranchSwitcher } from './PelegriniBranchSwitcher';
import { PelegriniResponsiveValue } from './PelegriniResponsiveValue';
import { PelegriniFilterBar } from './PelegriniFilterBar';
import { PelegriniTabs } from './PelegriniTabs';
import { LoadingState } from '@/components/common/LoadingState';
import { PelegriniModuleShell } from './PelegriniModuleShell';

const setFilialAtivaForEmpresa = vi.fn();

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({
    filialAtiva: 'transmissao',
    codEmpresaContexto: '1004',
    setFilialAtivaForEmpresa,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isMaster: true, profile: null }),
}));

describe('Pelegrini visual components', () => {
  it('renders a branch brand mark with logo and name', () => {
    const theme = resolvePelegriniTheme('transmissao');

    render(<PelegriniBrandMark theme={theme} />);

    expect(screen.getByAltText('Logo Casa da Transmissão')).toBeInTheDocument();
    expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
  });

  it('keeps the sidebar brand compact without a clipped tagline', () => {
    const theme = resolvePelegriniTheme('transmissao');

    render(<PelegriniBrandMark theme={theme} tone="sidebar" />);

    expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
    expect(screen.queryByText(theme.tagline)).not.toBeInTheDocument();
  });

  it('renders branch trust signals', () => {
    const theme = resolvePelegriniTheme('chevrolet');

    render(<PelegriniBranchBadge theme={theme} active />);

    expect(screen.getByText('Casa do Chevrolet')).toBeInTheDocument();
    expect(screen.getByText('Desde 1992')).toBeInTheDocument();
  });

  it('renders a mechanical branch panel with filial indicators', () => {
    render(
      <PelegriniBranchPanel
        theme={resolvePelegriniTheme('transmissao')}
        active
        indicators={['Cambio', 'Diferencial', 'ZF']}
        description="Painel com foco em pecas tecnicas."
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
    expect(screen.getByText('Cambio')).toBeInTheDocument();
    const panel = screen.getByRole('button', {
      name: /Casa da Transmissão.*Painel com foco em pecas tecnicas.*Cambio.*Diferencial.*ZF/i,
    });

    expect(panel).toHaveClass('pelegrini-branch-panel');
    expect(panel).toHaveAccessibleName(/Casa da Transmissão.*Painel com foco em pecas tecnicas.*Cambio.*Diferencial.*ZF/i);
  });

  it('renders an operational card without template effects', () => {
    render(
      <PelegriniOperationalCard
        title="Comercial"
        label="Pedidos e carteira"
        description="Clientes, produtos, cotacoes e vendas."
        tags={['Clientes', 'Produtos']}
        accent="comercial"
        onClick={() => undefined}
      />,
    );

    expect(screen.getByText('Pedidos e carteira')).toBeInTheDocument();
    const card = screen.getByRole('button', {
      name: /Comercial.*Pedidos e carteira.*Clientes, produtos, cotacoes e vendas.*Clientes.*Produtos/i,
    });

    expect(card).toHaveClass('pelegrini-operational-card');
    expect(card).toHaveAttribute('data-accent', 'comercial');
    expect(card).toHaveAccessibleName(/Comercial.*Pedidos e carteira.*Clientes, produtos, cotacoes e vendas.*Clientes.*Produtos/i);
  });

  it('renders a disabled operational card with its availability status', () => {
    render(
      <PelegriniOperationalCard
        title="Operacional"
        label="Estoque e giro"
        description="Acompanhamento da execucao da oficina."
        tags={['Estoque', 'Giro']}
        accent="operacional"
        status="Em breve"
        disabled
      />,
    );

    const card = screen.getByRole('button', { name: /Operacional.*Estoque e giro.*Em breve/i });

    expect(card).toBeDisabled();
    expect(card).toHaveAttribute('data-status', 'coming-soon');
    expect(screen.getByText('Em breve')).toBeInTheDocument();
  });

  it('renders module header with operational language', () => {
    render(<PelegriniModuleHeader title="Produtos" subtitle="Carteira de pecas" moduleKey="comercial" />);

    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText(/Pedidos e carteira/i)).toBeInTheDocument();
  });

  it('renders branch visual primitives with CT mechanical identity', () => {
    render(
      <PelegriniPageSurface moduleKey="operacional">
        <PelegriniBranchVisual theme={resolvePelegriniTheme('transmissao')} />
        <PelegriniKpiCard label="Estoque critico" value="18" helper="Cambio e diferencial" />
        <PelegriniDataPanel title="Mesa tecnica" eyebrow="ZF / Eaton">
          <span>Aplicacoes pesadas</span>
        </PelegriniDataPanel>
      </PelegriniPageSurface>,
    );

    expect(screen.getByText('Cambio e diferencial')).toBeInTheDocument();
    expect(screen.getByText('Mesa tecnica')).toBeInTheDocument();
    expect(screen.getByText('Aplicacoes pesadas')).toBeInTheDocument();
    expect(screen.getByTestId('pelegrini-page-surface')).toHaveAttribute('data-module', 'operacional');
    expect(screen.getByTestId('pelegrini-branch-visual')).toHaveAttribute('data-motif', 'gearbox-blueprint');
  });

  it('keeps KPI values responsive inside tight cards', () => {
    const { container } = render(
      <PelegriniKpiCard
        label="Faturamento"
        value="R$ 12.345.678,90"
        helper="Valor auditado"
      />,
    );

    const value = screen.getByText('R$ 12.345.678,90');

    expect(container.firstElementChild).toHaveClass('min-w-0');
    expect(value).toHaveClass('kpi-fluid-value', 'break-words');
  });

  it('switches the active branch without changing the current route', () => {
    render(<PelegriniBranchSwitcher variant="sidebar" />);

    expect(screen.getByRole('radiogroup', { name: /Filial ativa/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Casa da Transmissão/i })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: /Casa do Chevrolet/i }));

    expect(setFilialAtivaForEmpresa).toHaveBeenCalledWith('1004', 'chevrolet');
  });

  it('renders long financial values without truncation', () => {
    render(<PelegriniResponsiveValue>R$ 123.456.789,90</PelegriniResponsiveValue>);

    expect(screen.getByText('R$ 123.456.789,90')).toHaveClass('pelegrini-responsive-value');
    expect(screen.getByText('R$ 123.456.789,90')).not.toHaveClass('truncate');
  });

  it('reserves only the compact sidebar rail in the module shell', () => {
    render(
      <PelegriniModuleShell sidebar={<aside>Menu</aside>}>
        <span>Conteudo</span>
      </PelegriniModuleShell>,
    );

    expect(screen.getByRole('main')).toHaveClass('md:ml-[72px]');
    expect(screen.getByRole('main')).not.toHaveClass('md:ml-[232px]');
  });

  it('keeps filter controls in a collapsible responsive region', () => {
    render(
      <PelegriniFilterBar activeCount={2} summary="Agosto e 5 vendedores">
        <button type="button">Aplicar filtros</button>
      </PelegriniFilterBar>,
    );

    expect(screen.getByRole('button', { name: /Filtros.*2 ativos/i })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Filtros.*2 ativos/i }));
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeVisible();
  });

  it('gives long tab sets their own horizontal scroll region', () => {
    render(
      <PelegriniTabs
        ariaLabel="Visões comerciais"
        items={[
          { value: 'geral', label: 'Visão Geral' },
          { value: 'detalhes', label: 'Detalhes' },
          { value: 'comparativos', label: 'Comparativos' },
        ]}
        value="geral"
        onValueChange={() => undefined}
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Visões comerciais' })).toHaveClass('pelegrini-tabs-list');
    expect(screen.getByRole('tab', { name: 'Visão Geral' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders chart frame with CCH catalog identity', () => {
    render(
      <PelegriniChartFrame
        title="Pedidos originais"
        helper="Curva Chevrolet"
        themeKey="chevrolet"
      >
        <span>Grafico</span>
      </PelegriniChartFrame>,
    );

    expect(screen.getByText('Pedidos originais')).toBeInTheDocument();
    expect(screen.getByText('Curva Chevrolet')).toBeInTheDocument();
    expect(screen.getByTestId('pelegrini-chart-frame')).toHaveAttribute('data-theme', 'chevrolet');
  });

  it('stops the loading spinner when reduced motion is requested', () => {
    const { container } = render(<LoadingState />);

    expect(container.querySelector('svg')).toHaveClass('motion-reduce:animate-none');
  });
});
