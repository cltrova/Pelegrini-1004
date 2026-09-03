# Reestruturacao Visual Empresarial Onda 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a camada visual empresarial reutilizavel e aplica-la nas telas piloto Comercial Dashboard, Comercial Vendedores, Comercial Clientes, Operacional Estoque, Financeiro Resumo e Financeiro DRE.

**Architecture:** A nova camada fica em `src/components/enterprise/` e encapsula headers, filtros, metric cards, paineis, tabelas, badges e indicadores de variacao. As telas piloto preservam hooks, filtros pendentes/aplicados, calculos e rotas atuais, trocando apenas composicao visual e classes por componentes compartilhados. A migracao acontece rota a rota para manter revisoes pequenas e permitir validar densidade, responsividade e ausencia de regressao funcional.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/Radix, Recharts, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-03-reestruturacao-visual-empresarial-onda-1-design.md`

## Global Constraints

- Nao alterar hooks de dados, contratos das APIs, payloads, migrations, permissoes, rotas protegidas, calculos comerciais, financeiros ou operacionais, integracoes Supabase, VPS, WhatsApp ou exportacoes.
- Componentes `Enterprise*` devem ser usados nas telas piloto.
- Filtros das telas piloto devem seguir um padrao unico.
- Indicadores principais devem trazer contexto quando os dados ja existem.
- Densidade visual deve melhorar sem deixar a interface apertada.
- Auditoria visual das larguras 390, 768, 1024 e 1440 px nao pode encontrar overflow horizontal.
- Areas migradas nao devem usar gradientes decorativos, excesso de sombras ou cards aninhados.
- Preservar alteracoes locais existentes, incluindo arquivos nao rastreados de comissao.

---

## File Structure

Create:

- `src/components/enterprise/EnterprisePageHeader.tsx`: topo compacto das paginas piloto.
- `src/components/enterprise/EnterpriseFilterBar.tsx`: estrutura compartilhada da barra de filtros.
- `src/components/enterprise/EnterpriseFilters.tsx`: campos padronizados de busca, select, multi-select, vendedor, cliente, marca, categoria, produto, filial, status e periodo simples.
- `src/components/enterprise/EnterpriseMetricCard.tsx`: indicador compacto com valor, contexto, variacao, meta e detalhe.
- `src/components/enterprise/EnterpriseDataPanel.tsx`: painel neutro para graficos, listas e blocos analiticos.
- `src/components/enterprise/EnterpriseDataTable.tsx`: primitives de tabela densa e classes auxiliares.
- `src/components/enterprise/EnterpriseBadge.tsx`: status, badges e `VarianceIndicator`.
- `src/components/enterprise/index.ts`: exports publicos.
- `src/components/enterprise/EnterpriseFoundation.test.tsx`: contratos visuais e interativos da fundacao.
- `src/components/comercial/EnterpriseComercialFilters.tsx`: adaptador dos filtros comerciais atuais para `EnterpriseFilterBar`.
- `src/components/dre/EnterpriseDreFilters.tsx`: adaptador dos filtros DRE atuais para `EnterpriseFilterBar`.
- `src/components/resumo/EnterpriseResumoFilters.tsx`: adaptador dos filtros de resumo financeiro para `EnterpriseFilterBar`.
- `src/components/operacional/estoque/EnterpriseEstoqueFilters.tsx`: adaptador dos filtros de estoque para `EnterpriseFilterBar`.

Modify:

- `src/index.css`: tokens `--enterprise-*`, classes de densidade e refinamentos de tabela/grafico.
- `src/components/comercial/ComercialFilters.tsx`: extrair helpers reutilizaveis sem quebrar a API atual.
- `src/components/comercial/DashboardKPICardsLegacy.tsx`: trocar implementation visual por `EnterpriseMetricCard`.
- `src/components/comercial/DashboardKPICardsPremium.tsx`: alinhar visual ao mesmo contrato quando usado por empresa 1003.
- `src/components/comercial/DashboardChartsLegacy.tsx`: envolver graficos em `EnterpriseDataPanel` e reduzir decoracao.
- `src/components/comercial/DashboardChartsPremium.tsx`: alinhar visual ao mesmo contrato quando usado por empresa 1003.
- `src/pages/comercial/MetasVendedoresPage.tsx`: aplicar header, filtros e espacamento do dashboard comercial.
- `src/pages/comercial/VendedoresPage.tsx`: aplicar primitives empresariais e remover cards/gradientes locais.
- `src/pages/comercial/ClientesAnalysePage.tsx`: apontar para a experiencia migrada em `ClientesPage`.
- `src/pages/comercial/ClientesPage.tsx`: aplicar primitives empresariais e remover componentes visuais locais duplicados.
- `src/pages/operacional/EstoquePage.tsx`: substituir `UnifiedFilterBar` no giro por filtros empresariais.
- `src/components/operacional/estoque/EstoqueCommandCenter.tsx`: usar filtros empresariais para central de estoque.
- `src/components/operacional/estoque/EstoqueSummaryCards.tsx`: trocar cards por `EnterpriseMetricCard`.
- `src/components/operacional/estoque/EstoqueProductsTable.tsx`: alinhar tabela ao padrao empresarial.
- `src/pages/financeiro/ResumoPage.tsx`: aplicar header e composicao compacta.
- `src/components/resumo/ResumoFiltersBar.tsx`: substituir por wrapper empresarial ou delegar para `EnterpriseResumoFilters`.
- `src/components/resumo/ResumoVitalsKPIs.tsx`: trocar cards por `EnterpriseMetricCard`.
- `src/pages/financeiro/DrePage.tsx`: aplicar header e filtros empresariais desktop/mobile.
- `src/components/dre/DreIndicators.tsx`: trocar indicadores por `EnterpriseMetricCard`.
- `src/components/dre/DreDashboard.tsx`: trocar paineis locais por `EnterpriseDataPanel`.
- `src/components/dre/DreGroupedTable.tsx`: alinhar tabela DRE ao padrao empresarial.

Test:

- `src/components/enterprise/EnterpriseFoundation.test.tsx`
- `src/pages/comercial/CotacoesComerciaisPages.test.tsx`
- `src/pages/operacional/EstoquePage.test.tsx`
- `src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`
- `src/components/operacional/estoque/EstoqueProductsTable.test.tsx`
- `src/components/resumo/ResumoResponsive.test.tsx`
- `src/components/dre/dreFilterPeriod.test.ts`
- testes existentes de hooks e formatadores afetados por imports.

### Task 1: Enterprise Foundation Components

**Files:**
- Create: `src/components/enterprise/EnterprisePageHeader.tsx`
- Create: `src/components/enterprise/EnterpriseMetricCard.tsx`
- Create: `src/components/enterprise/EnterpriseDataPanel.tsx`
- Create: `src/components/enterprise/EnterpriseBadge.tsx`
- Create: `src/components/enterprise/EnterpriseDataTable.tsx`
- Create: `src/components/enterprise/index.ts`
- Create: `src/components/enterprise/EnterpriseFoundation.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `cn` from `src/lib/utils.ts`, shadcn `Button`, existing Tailwind tokens and `lucide-react`.
- Produces:

```ts
export interface EnterprisePageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export interface EnterpriseMetricCardProps {
  label: string;
  value: React.ReactNode;
  context?: React.ReactNode;
  comparison?: React.ReactNode;
  target?: React.ReactNode;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
  onClick?: () => void;
  className?: string;
}

export interface EnterpriseDataPanelProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  density?: 'compact' | 'normal';
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
}

export type EnterpriseTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
```

- [ ] **Step 1: Write the foundation tests**

Add `src/components/enterprise/EnterpriseFoundation.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EnterpriseBadge,
  EnterpriseDataPanel,
  EnterpriseMetricCard,
  EnterprisePageHeader,
  EnterpriseTable,
  EnterpriseTbody,
  EnterpriseTd,
  EnterpriseTh,
  EnterpriseThead,
  EnterpriseTr,
  VarianceIndicator,
} from './index';

describe('enterprise visual foundation', () => {
  it('renders a compact page header with metadata and actions', () => {
    render(
      <EnterprisePageHeader
        title="Resumo Financeiro"
        subtitle="Liquidez e contas a receber"
        metadata={<span>Set/2026</span>}
        actions={<button type="button">Atualizar</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Resumo Financeiro' })).toBeInTheDocument();
    expect(screen.getByText('Liquidez e contas a receber')).toBeInTheDocument();
    expect(screen.getByText('Set/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
  });

  it('keeps metric cards dense and contextual', () => {
    render(
      <EnterpriseMetricCard
        label="Faturamento"
        value="R$ 428.540"
        context="Faturamento no periodo"
        comparison={<VarianceIndicator value={8.4} label="vs periodo anterior" />}
        target="82% da meta mensal"
      />,
    );

    const card = screen.getByTestId('enterprise-metric-card');
    expect(card).toHaveClass('rounded-lg', 'border');
    expect(card).not.toHaveClass('rounded-2xl');
    expect(screen.getByText('82% da meta mensal')).toBeInTheDocument();
  });

  it('renders neutral panels without nested decorative card classes', () => {
    render(<EnterpriseDataPanel title="Evolucao"><div>Grafico</div></EnterpriseDataPanel>);

    const panel = screen.getByTestId('enterprise-data-panel');
    expect(panel).toHaveClass('min-w-0', 'rounded-lg', 'border');
    expect(panel).not.toHaveClass('premium-card');
    expect(screen.getByText('Grafico')).toBeInTheDocument();
  });

  it('exposes dense numeric table primitives', () => {
    render(
      <EnterpriseTable>
        <EnterpriseThead>
          <EnterpriseTr>
            <EnterpriseTh>Cliente</EnterpriseTh>
            <EnterpriseTh numeric>Valor</EnterpriseTh>
          </EnterpriseTr>
        </EnterpriseThead>
        <EnterpriseTbody>
          <EnterpriseTr>
            <EnterpriseTd>Cliente A</EnterpriseTd>
            <EnterpriseTd numeric>R$ 1.200,00</EnterpriseTd>
          </EnterpriseTr>
        </EnterpriseTbody>
      </EnterpriseTable>,
    );

    expect(screen.getByText('Valor')).toHaveClass('text-right', 'tabular-nums');
    expect(screen.getByText('R$ 1.200,00')).toHaveClass('text-right', 'tabular-nums');
  });

  it('renders restrained badges and variance indicators', () => {
    render(
      <>
        <EnterpriseBadge tone="warning">A vencer</EnterpriseBadge>
        <VarianceIndicator value={-3.2} label="vs meta" />
      </>,
    );

    expect(screen.getByText('A vencer')).toHaveClass('rounded-md');
    expect(screen.getByText('-3,2%')).toBeInTheDocument();
    expect(screen.getByText('vs meta')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the foundation tests and verify failure**

Run: `npm test -- --run src/components/enterprise/EnterpriseFoundation.test.tsx`

Expected: FAIL because `src/components/enterprise` does not exist.

- [ ] **Step 3: Add enterprise CSS tokens and density utilities**

Append to `src/index.css` inside existing `@layer base` and `@layer components` sections:

```css
:root {
  --enterprise-surface: 0 0% 100%;
  --enterprise-surface-subtle: 214 31% 96%;
  --enterprise-border: 214 25% 84%;
  --enterprise-border-strong: 214 20% 72%;
  --enterprise-text-muted: 213 13% 42%;
  --enterprise-positive: 142 65% 36%;
  --enterprise-negative: 0 68% 46%;
  --enterprise-warning: 38 88% 42%;
  --enterprise-info: 207 86% 34%;
  --enterprise-row-hover: 214 35% 96%;
}

.dark {
  --enterprise-surface: 222 43% 9%;
  --enterprise-surface-subtle: 222 32% 13%;
  --enterprise-border: 222 28% 18%;
  --enterprise-border-strong: 222 22% 28%;
  --enterprise-text-muted: 215 18% 62%;
  --enterprise-positive: 142 62% 48%;
  --enterprise-negative: 0 70% 56%;
  --enterprise-warning: 38 90% 55%;
  --enterprise-info: 199 89% 58%;
  --enterprise-row-hover: 222 32% 13%;
}

.enterprise-page {
  @apply min-w-0 max-w-full space-y-3 overflow-x-clip p-3 md:p-4;
}

.enterprise-grid-metrics {
  @apply grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6;
}

.enterprise-chart-grid {
  @apply grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-12;
}
```

- [ ] **Step 4: Implement `EnterprisePageHeader`**

Create `src/components/enterprise/EnterprisePageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnterprisePageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  metadata?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EnterprisePageHeader({
  title,
  subtitle,
  eyebrow,
  metadata,
  actions,
  className,
}: EnterprisePageHeaderProps) {
  return (
    <header className={cn('flex min-w-0 flex-col gap-2 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-semibold uppercase text-muted-foreground">{eyebrow}</p>}
        <h1 className="truncate text-xl font-semibold leading-tight text-foreground md:text-2xl">{title}</h1>
        {(subtitle || metadata) && (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
            {subtitle && metadata && <span aria-hidden="true">|</span>}
            {metadata && <span className="min-w-0">{metadata}</span>}
          </div>
        )}
      </div>
      {actions && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 5: Implement `EnterpriseBadge` and `VarianceIndicator`**

Create `src/components/enterprise/EnterpriseBadge.tsx`:

```tsx
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EnterpriseTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

const toneClasses: Record<EnterpriseTone, string> = {
  neutral: 'border-border bg-muted/40 text-muted-foreground',
  positive: 'border-[hsl(var(--enterprise-positive)/0.28)] bg-[hsl(var(--enterprise-positive)/0.09)] text-[hsl(var(--enterprise-positive))]',
  negative: 'border-[hsl(var(--enterprise-negative)/0.28)] bg-[hsl(var(--enterprise-negative)/0.09)] text-[hsl(var(--enterprise-negative))]',
  warning: 'border-[hsl(var(--enterprise-warning)/0.28)] bg-[hsl(var(--enterprise-warning)/0.09)] text-[hsl(var(--enterprise-warning))]',
  info: 'border-[hsl(var(--enterprise-info)/0.28)] bg-[hsl(var(--enterprise-info)/0.09)] text-[hsl(var(--enterprise-info))]',
};

export function EnterpriseBadge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: EnterpriseTone; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4', toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function VarianceIndicator({ value, label, className }: { value: number; label?: string; className?: string }) {
  const tone: EnterpriseTone = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight;
  const formatted = `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 text-xs', className)}>
      <EnterpriseBadge tone={tone}>
        <Icon aria-hidden="true" className="h-3 w-3" />
        <span className="tabular-nums">{formatted}</span>
      </EnterpriseBadge>
      {label && <span className="truncate text-muted-foreground">{label}</span>}
    </span>
  );
}
```

- [ ] **Step 6: Implement `EnterpriseMetricCard`**

Create `src/components/enterprise/EnterpriseMetricCard.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { EnterpriseTone } from './EnterpriseBadge';

const toneRail: Record<EnterpriseTone, string> = {
  neutral: 'bg-border',
  positive: 'bg-[hsl(var(--enterprise-positive))]',
  negative: 'bg-[hsl(var(--enterprise-negative))]',
  warning: 'bg-[hsl(var(--enterprise-warning))]',
  info: 'bg-[hsl(var(--enterprise-info))]',
};

export interface EnterpriseMetricCardProps {
  label: string;
  value: ReactNode;
  context?: ReactNode;
  comparison?: ReactNode;
  target?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: EnterpriseTone;
  onClick?: () => void;
  className?: string;
}

export function EnterpriseMetricCard({
  label,
  value,
  context,
  comparison,
  target,
  detail,
  icon,
  tone = 'neutral',
  onClick,
  className,
}: EnterpriseMetricCardProps) {
  const Component = onClick ? 'button' : 'article';

  return (
    <Component
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-3 text-left',
        'transition-colors hover:border-[hsl(var(--enterprise-border-strong))]',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      data-testid="enterprise-metric-card"
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-0.5', toneRail[tone])} />
      <div className="flex min-w-0 items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
          <div className="mt-1 min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-foreground">{value}</div>
        </div>
        {icon && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground">{icon}</div>}
      </div>
      {(context || comparison || target || detail) && (
        <div className="mt-2 min-w-0 space-y-1 pl-1 text-xs text-muted-foreground">
          {context && <div className="min-w-0 truncate">{context}</div>}
          {comparison && <div className="min-w-0">{comparison}</div>}
          {target && <div className="min-w-0 truncate">{target}</div>}
          {detail && <div className="min-w-0 truncate">{detail}</div>}
        </div>
      )}
    </Component>
  );
}
```

- [ ] **Step 7: Implement `EnterpriseDataPanel`**

Create `src/components/enterprise/EnterpriseDataPanel.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnterpriseDataPanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  density?: 'compact' | 'normal';
  noPadding?: boolean;
  children: ReactNode;
  className?: string;
}

export function EnterpriseDataPanel({ title, description, actions, density = 'normal', noPadding = false, children, className }: EnterpriseDataPanelProps) {
  const hasHeader = title || description || actions;

  return (
    <section className={cn('min-w-0 overflow-hidden rounded-lg border border-border bg-card', className)} data-testid="enterprise-data-panel">
      {hasHeader && (
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 px-3 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0', !noPadding && (density === 'compact' ? 'p-3' : 'p-4'))}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 8: Implement table primitives and exports**

Create `src/components/enterprise/EnterpriseDataTable.tsx`:

```tsx
import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function EnterpriseTable({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('min-w-0 overflow-x-auto rounded-lg border border-border', className)} {...props}>
      <table className="w-full min-w-max border-collapse text-xs">{children}</table>
    </div>
  );
}

export function EnterpriseThead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-10 bg-muted/80 text-muted-foreground', className)} {...props} />;
}

export function EnterpriseTbody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border/60', className)} {...props} />;
}

export function EnterpriseTr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-[hsl(var(--enterprise-row-hover))]', className)} {...props} />;
}

export function EnterpriseTh({ numeric = false, className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th className={cn('px-2.5 py-2 text-left text-[11px] font-semibold uppercase', numeric && 'text-right tabular-nums', className)} {...props} />;
}

export function EnterpriseTd({ numeric = false, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn('px-2.5 py-2 align-middle', numeric && 'text-right tabular-nums', className)} {...props} />;
}
```

Create `src/components/enterprise/index.ts`:

```ts
export * from './EnterpriseBadge';
export * from './EnterpriseDataPanel';
export * from './EnterpriseDataTable';
export * from './EnterpriseMetricCard';
export * from './EnterprisePageHeader';
```

- [ ] **Step 9: Run foundation tests and commit**

Run: `npm test -- --run src/components/enterprise/EnterpriseFoundation.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/components/enterprise src/index.css
git commit -m "feat: add enterprise visual foundation"
```

### Task 2: Enterprise Filter System

**Files:**
- Create: `src/components/enterprise/EnterpriseFilterBar.tsx`
- Create: `src/components/enterprise/EnterpriseFilters.tsx`
- Modify: `src/components/enterprise/index.ts`
- Modify: `src/components/enterprise/EnterpriseFoundation.test.tsx`

**Interfaces:**
- Consumes: `Popover`, `Button`, `Input`, `Checkbox`, `Select` and `Calendar` primitives already present in the project.
- Produces:

```ts
export interface EnterpriseFilterBarProps {
  children: React.ReactNode;
  activeCount?: number;
  summary?: React.ReactNode;
  resultCount?: number;
  resultLabel?: string;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClear?: () => void;
  onApply?: () => void;
  applyLabel?: string;
  className?: string;
}

export interface EnterpriseOption {
  value: string;
  label: string;
  description?: string;
  avatarUrl?: string;
}
```

- [ ] **Step 1: Add filter contract tests**

Append to `EnterpriseFoundation.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react';
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
} from './index';

it('renders a compact filter bar with active count, results, clear and apply', () => {
  const onClear = vi.fn();
  const onApply = vi.fn();
  render(
    <EnterpriseFilterBar activeCount={2} resultCount={128} onClear={onClear} onApply={onApply} summary="Junho | 2 vendedores">
      <EnterpriseSearchFilter label="Busca" value="abc" onChange={() => undefined} />
    </EnterpriseFilterBar>,
  );

  expect(screen.getByText('2 ativos')).toBeInTheDocument();
  expect(screen.getByText('128 resultados')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));
  fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }));
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(onApply).toHaveBeenCalledTimes(1);
});

it('renders standard select and multi-select filters with counts', () => {
  render(
    <div>
      <EnterpriseSelectFilter
        label="Status"
        value="aberto"
        options={[{ value: 'aberto', label: 'Aberto' }, { value: 'fechado', label: 'Fechado' }]}
        onChange={() => undefined}
      />
      <EnterpriseMultiSelectFilter
        label="Marca"
        values={['gm', 'bosch']}
        options={[{ value: 'gm', label: 'GM' }, { value: 'bosch', label: 'Bosch' }]}
        onChange={() => undefined}
      />
    </div>,
  );

  expect(screen.getByLabelText('Status')).toBeInTheDocument();
  expect(screen.getByText('2 selecionados')).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- --run src/components/enterprise/EnterpriseFoundation.test.tsx`

Expected: FAIL because filter components are missing.

- [ ] **Step 3: Implement `EnterpriseFilterBar`**

Create `src/components/enterprise/EnterpriseFilterBar.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EnterpriseBadge } from './EnterpriseBadge';

export interface EnterpriseFilterBarProps {
  children: ReactNode;
  activeCount?: number;
  summary?: ReactNode;
  resultCount?: number;
  resultLabel?: string;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClear?: () => void;
  onApply?: () => void;
  applyLabel?: string;
  className?: string;
}

export function EnterpriseFilterBar({
  children,
  activeCount = 0,
  summary,
  resultCount,
  resultLabel = 'resultados',
  isOpen,
  defaultOpen = true,
  onOpenChange,
  onClear,
  onApply,
  applyLabel = 'Aplicar filtros',
  className,
}: EnterpriseFilterBarProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <section className={cn('min-w-0 rounded-lg border border-border bg-card px-3 py-2', className)} data-testid="enterprise-filter-bar">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-xs font-semibold text-foreground hover:bg-muted"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          Filtros
          {activeCount > 0 && <EnterpriseBadge tone="info">{activeCount} ativos</EnterpriseBadge>}
        </button>
        {summary && <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{summary}</div>}
        {typeof resultCount === 'number' && (
          <EnterpriseBadge className="tabular-nums">{resultCount.toLocaleString('pt-BR')} {resultLabel}</EnterpriseBadge>
        )}
        {activeCount > 0 && onClear && (
          <Button aria-label="Limpar filtros" className="h-8 gap-1.5 px-2 text-xs" onClick={onClear} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
        {onApply && (
          <Button aria-label={applyLabel} className="h-8 gap-1.5 px-2.5 text-xs" onClick={onApply} size="sm" type="button">
            <Search aria-hidden="true" className="h-3.5 w-3.5" />
            {applyLabel}
          </Button>
        )}
      </div>
      <div className={cn('mt-2 flex min-w-0 flex-wrap items-end gap-2', !open && 'hidden lg:flex')}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: Implement filter field components**

Create `src/components/enterprise/EnterpriseFilters.tsx` with these exported components:

```tsx
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface EnterpriseOption {
  value: string;
  label: string;
  description?: string;
  avatarUrl?: string;
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-[9rem] max-w-full flex-1 space-y-1 sm:flex-none">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function EnterpriseSearchFilter({ label, value, onChange, placeholder = 'Buscar...' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <FieldShell label={label}>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={label} className="h-8 min-w-0 pl-8 text-xs" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} />
      </div>
    </FieldShell>
  );
}

export function EnterpriseSelectFilter({ label, value, options, onChange, allLabel = 'Todos' }: { label: string; value?: string; options: EnterpriseOption[]; onChange: (value: string | undefined) => void; allLabel?: string }) {
  return (
    <FieldShell label={label}>
      <Select value={value ?? '__all'} onValueChange={(next) => onChange(next === '__all' ? undefined : next)}>
        <SelectTrigger aria-label={label} className="h-8 min-w-[9rem] bg-background text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{allLabel}</SelectItem>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

export function EnterpriseMultiSelectFilter({ label, values, options, onChange, searchable = true, allLabel = 'Todos' }: { label: string; values: string[]; options: EnterpriseOption[]; onChange: (values: string[]) => void; searchable?: boolean; allLabel?: string }) {
  const [search, setSearch] = useState('');
  const selected = new Set(values);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query)) : options;
  }, [options, search]);
  const display = values.length === 0 ? allLabel : values.length === 1 ? options.find((option) => option.value === values[0])?.label ?? values[0] : `${values.length} selecionados`;

  return (
    <div className="min-w-[9rem] max-w-full flex-1 space-y-1 sm:flex-none">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button aria-label={label} className="h-8 min-w-[9rem] max-w-[15rem] justify-between bg-background px-2 text-xs font-normal" type="button" variant="outline">
            <span className="truncate">{display}</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[18rem] p-2">
          {searchable && (
            <div className="relative mb-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-7 text-xs" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." value={search} />
            </div>
          )}
          <button className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onChange([])} type="button">
            <span className="flex h-4 w-4 items-center justify-center rounded border border-border">{values.length === 0 && <Check className="h-3 w-3" />}</span>
            {allLabel}
          </button>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((option) => {
              const active = selected.has(option.value);
              return (
                <button
                  className={cn('flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted', active && 'bg-muted/70')}
                  key={option.value}
                  onClick={() => onChange(active ? values.filter((value) => value !== option.value) : [...values, option.value])}
                  type="button"
                >
                  <Checkbox checked={active} className="pointer-events-none h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.description && <span className="shrink-0 text-[10px] text-muted-foreground">{option.description}</span>}
                </button>
              );
            })}
          </div>
          {values.length > 0 && (
            <Button className="mt-2 h-8 w-full gap-1.5 text-xs" onClick={() => onChange([])} size="sm" type="button" variant="ghost">
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              Limpar {label.toLowerCase()}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const EnterpriseSellerFilter = EnterpriseMultiSelectFilter;
export const EnterpriseClientFilter = EnterpriseMultiSelectFilter;
export const EnterpriseBranchFilter = EnterpriseMultiSelectFilter;
export const EnterpriseBrandFilter = EnterpriseMultiSelectFilter;
export const EnterpriseCategoryFilter = EnterpriseMultiSelectFilter;
export const EnterpriseProductFilter = EnterpriseMultiSelectFilter;
export const EnterpriseStatusFilter = EnterpriseSelectFilter;
```

- [ ] **Step 5: Export filters**

Update `src/components/enterprise/index.ts`:

```ts
export * from './EnterpriseBadge';
export * from './EnterpriseDataPanel';
export * from './EnterpriseDataTable';
export * from './EnterpriseFilterBar';
export * from './EnterpriseFilters';
export * from './EnterpriseMetricCard';
export * from './EnterprisePageHeader';
```

- [ ] **Step 6: Run foundation tests and commit**

Run: `npm test -- --run src/components/enterprise/EnterpriseFoundation.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/components/enterprise
git commit -m "feat: add enterprise filter system"
```

### Task 3: Comercial Filter Adapter

**Files:**
- Create: `src/components/comercial/EnterpriseComercialFilters.tsx`
- Modify: `src/components/comercial/ComercialFilters.tsx`
- Test: `src/components/comercial/comercialFiltersLogic.test.ts`

**Interfaces:**
- Consumes: `ComercialFiltersType`, `getDefaultFiltersForEmpresa`, `getComercialFiltersSummary`, `countActiveFilters`.
- Produces:

```ts
interface EnterpriseComercialFiltersProps {
  pendingFilters: ComercialFiltersType;
  appliedFilters: ComercialFiltersType;
  onPendingFiltersChange: (filters: ComercialFiltersType) => void;
  onApply: () => void;
  onClear: () => void;
  hasChanges: boolean;
  anos: string[];
  vendedores?: { codigo: string | number; nome: string }[];
  clientes?: { codigo: string | number; nome: string }[];
  marcas?: string[];
  resultCount?: number;
  showVendedorFilter?: boolean;
  showClienteFilter?: boolean;
  showMarcaFilter?: boolean;
}
```

- [ ] **Step 1: Keep existing logic tests green before refactor**

Run: `npm test -- --run src/components/comercial/comercialFiltersLogic.test.ts src/utils/formatters.periodoFiltro.test.ts`

Expected: PASS before editing.

- [ ] **Step 2: Extract reusable helpers from `ComercialFilters.tsx`**

Export the existing month constants and date helper behavior without changing outputs:

```ts
export const COMERCIAL_MESES = MESES;
export { normalizeMeses, safeFormatISO, getMesLabel };
```

If TypeScript rejects exporting function declarations because they are currently local, convert the local declarations to exported function declarations in place. Keep the public component API unchanged.

- [ ] **Step 3: Create the enterprise adapter**

Create `src/components/comercial/EnterpriseComercialFilters.tsx`:

```tsx
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
  type EnterpriseOption,
} from '@/components/enterprise';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { countActiveFilters, getComercialFiltersSummary } from './ComercialFilters';

const toOptions = (items: readonly { codigo: string | number; nome: string }[] = []): EnterpriseOption[] =>
  items.map((item) => ({ value: String(item.codigo), label: item.nome, description: `#${item.codigo}` }));

const monthOptions: EnterpriseOption[] = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Marco' },
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

interface EnterpriseComercialFiltersProps {
  pendingFilters: ComercialFiltersType;
  appliedFilters: ComercialFiltersType;
  onPendingFiltersChange: (filters: ComercialFiltersType) => void;
  onApply: () => void;
  onClear: () => void;
  hasChanges: boolean;
  anos: string[];
  vendedores?: { codigo: string | number; nome: string }[];
  clientes?: { codigo: string | number; nome: string }[];
  marcas?: string[];
  resultCount?: number;
  showVendedorFilter?: boolean;
  showClienteFilter?: boolean;
  showMarcaFilter?: boolean;
}

export function EnterpriseComercialFilters({
  pendingFilters,
  appliedFilters,
  onPendingFiltersChange,
  onApply,
  onClear,
  hasChanges,
  anos,
  vendedores = [],
  clientes = [],
  marcas = [],
  resultCount,
  showVendedorFilter,
  showClienteFilter,
  showMarcaFilter,
}: EnterpriseComercialFiltersProps) {
  const summary = getComercialFiltersSummary(appliedFilters, vendedores, clientes)
    .map((item) => `${item.label}: ${item.value}`)
    .join(' | ');
  const activeCount = countActiveFilters(appliedFilters);
  const update = (patch: Partial<ComercialFiltersType>) => onPendingFiltersChange({ ...pendingFilters, ...patch });

  return (
    <EnterpriseFilterBar
      activeCount={activeCount}
      applyLabel={hasChanges ? 'Aplicar alteracoes' : 'Aplicar filtros'}
      onApply={onApply}
      onClear={onClear}
      resultCount={resultCount}
      summary={summary}
    >
      <EnterpriseSelectFilter
        allLabel="Todos os anos"
        label="Ano"
        onChange={(value) => update({ anos: value ? [value] : [] })}
        options={anos.map((ano) => ({ value: ano, label: ano }))}
        value={pendingFilters.anos?.[0]}
      />
      <EnterpriseMultiSelectFilter
        allLabel="Todos os meses"
        label="Periodo"
        onChange={(values) => update({ meses: values })}
        options={monthOptions}
        values={(pendingFilters.meses || []).map(String)}
      />
      {showVendedorFilter && (
        <EnterpriseMultiSelectFilter
          allLabel="Todos os vendedores"
          label="Vendedor"
          onChange={(values) => update({ vendedores: values.length ? values : undefined, vendedor: values.length === 1 ? values[0] : undefined })}
          options={toOptions(vendedores)}
          values={(pendingFilters.vendedores || (pendingFilters.vendedor ? [pendingFilters.vendedor] : [])).map(String)}
        />
      )}
      {showClienteFilter && (
        <EnterpriseMultiSelectFilter
          allLabel="Todos os clientes"
          label="Cliente"
          onChange={(values) => update({ cliente: values[0] })}
          options={toOptions(clientes)}
          values={pendingFilters.cliente ? [String(pendingFilters.cliente)] : []}
        />
      )}
      {showMarcaFilter && (
        <EnterpriseMultiSelectFilter
          allLabel="Todas as marcas"
          label="Marca"
          onChange={(values) => update({ marcas: values.length ? values : undefined, marca: values.length === 1 ? values[0] : undefined })}
          options={marcas.map((marca) => ({ value: marca, label: marca }))}
          values={(pendingFilters.marcas || (pendingFilters.marca ? [pendingFilters.marca] : [])).map(String)}
        />
      )}
      <EnterpriseSelectFilter
        allLabel="Pedidos e devolucoes"
        label="Tipo"
        onChange={(value) => update({ tipo: (value as ComercialFiltersType['tipo']) || 'todos' })}
        options={[{ value: 'PEDIDO', label: 'Apenas pedidos' }, { value: 'DEVOLUCAO', label: 'Apenas devolucoes' }]}
        value={pendingFilters.tipo === 'todos' ? undefined : pendingFilters.tipo}
      />
    </EnterpriseFilterBar>
  );
}
```

- [ ] **Step 4: Run commercial filter tests**

Run: `npm test -- --run src/components/comercial/comercialFiltersLogic.test.ts src/utils/formatters.periodoFiltro.test.ts src/components/enterprise/EnterpriseFoundation.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the adapter**

```bash
git add src/components/comercial/EnterpriseComercialFilters.tsx src/components/comercial/ComercialFilters.tsx src/components/enterprise src/index.css
git commit -m "feat: add enterprise commercial filters"
```

### Task 4: Comercial Dashboard Migration

**Files:**
- Modify: `src/pages/comercial/MetasVendedoresPage.tsx`
- Modify: `src/components/comercial/DashboardKPICardsLegacy.tsx`
- Modify: `src/components/comercial/DashboardKPICardsPremium.tsx`
- Modify: `src/components/comercial/DashboardChartsLegacy.tsx`
- Modify: `src/components/comercial/DashboardChartsPremium.tsx`
- Test: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`

**Interfaces:**
- Consumes: current `useComercialData(appliedFilters)`, KPI values, dashboard chart props and existing click handlers.
- Produces: dashboard at `/comercial/dashboard` using enterprise header, filters, metrics and panels.

- [ ] **Step 1: Run existing dashboard-adjacent tests**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/comercial/RankingVendedoresChart.test.ts`

Expected: PASS before editing.

- [ ] **Step 2: Replace dashboard KPI card body**

In `DashboardKPICardsLegacy.tsx`, keep props and calculations, but replace local `KPICard` rendering with `EnterpriseMetricCard`:

```tsx
<EnterpriseMetricCard
  label="Faturamento real"
  value={fmtCurrency(kpis.faturamentoLiquido)}
  context="Valor real no periodo aplicado"
  comparison={kpis.totalValorPedido > 0 ? `${((kpis.faturamentoLiquido / kpis.totalValorPedido) * 100).toFixed(1)}% do valor pedido` : 'Sem valor pedido'}
  detail={onReceitaClick ? 'Clique para ver detalhes' : undefined}
  icon={<TrendingUp className="h-4 w-4" />}
  onClick={onReceitaClick}
  tone="positive"
/>
```

Map the remaining cards with the same structure:

- `Valor Total Pedido`: tone `info`, context `Base bruta de pedidos`.
- `Devolucoes`: tone `negative`, context `Valor devolvido no periodo`.
- `Valor Custo`: tone `warning`, context `Custo total associado`.
- `Descontos`: tone `negative`, context `Descontos concedidos`.
- `Pedidos`: tone `neutral`, context `Registros filtrados`.
- `Clientes`: tone `neutral`, context `Clientes unicos`.
- `Vendedores`: tone `neutral`, context `Vendedores ativos`.

Use wrapper class `enterprise-grid-metrics`.

- [ ] **Step 3: Align premium KPI variant**

In `DashboardKPICardsPremium.tsx`, either delegate to `DashboardKPICardsLegacy` or replace its local cards with the same `EnterpriseMetricCard` mapping. Keep any business-specific visibility rules intact.

- [ ] **Step 4: Wrap dashboard charts**

In `DashboardChartsLegacy.tsx` and `DashboardChartsPremium.tsx`, wrap each chart block with:

```tsx
<EnterpriseDataPanel title="Evolucao de vendas" description="Receita e volume no periodo" noPadding>
  <div className="h-[260px] min-w-0 p-3">
    <ResponsiveContainer width="100%" height="100%">
      {/* existing chart */}
    </ResponsiveContainer>
  </div>
</EnterpriseDataPanel>
```

Remove `bg-gradient-*`, `premium-card`, `shadow-*` and `rounded-xl/2xl` classes from migrated chart containers.

- [ ] **Step 5: Recompose `MetasVendedoresPage` shell**

In `src/pages/comercial/MetasVendedoresPage.tsx`, import `EnterprisePageHeader` and `EnterpriseComercialFilters`. Replace top spacing with:

```tsx
<div className="enterprise-page">
  <EnterprisePageHeader
    title="Dashboard Comercial"
    subtitle="Faturamento, margem, devolucoes e ranking"
    metadata={`${kpis.qtdPedidos.toLocaleString('pt-BR')} pedidos | ${kpis.qtdClientes.toLocaleString('pt-BR')} clientes`}
    actions={/* existing refresh/export actions if present */}
  />
  <EnterpriseComercialFilters
    pendingFilters={pendingFilters}
    appliedFilters={appliedFilters}
    onPendingFiltersChange={setPendingFilters}
    onApply={handleBuscar}
    onClear={handleClearFilters}
    hasChanges={hasChanges}
    anos={ANOS_DISPONIVEIS}
    vendedores={vendedoresDisponiveis}
    resultCount={pedidos.length}
    showVendedorFilter
  />
  {/* existing dashboard content */}
</div>
```

Preserve the route component export and all hook calls.

- [ ] **Step 6: Run dashboard tests and build type check through Vite**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/comercial/RankingVendedoresChart.test.ts`

Run: `npm run build`

Expected: tests PASS and build exits 0.

- [ ] **Step 7: Commit dashboard migration**

```bash
git add src/pages/comercial/MetasVendedoresPage.tsx src/components/comercial/DashboardKPICardsLegacy.tsx src/components/comercial/DashboardKPICardsPremium.tsx src/components/comercial/DashboardChartsLegacy.tsx src/components/comercial/DashboardChartsPremium.tsx
git commit -m "feat: migrate commercial dashboard visual system"
```

### Task 5: Comercial Vendedores Migration

**Files:**
- Modify: `src/pages/comercial/VendedoresPage.tsx`
- Test: `src/components/comercial/RankingVendedoresChart.test.ts`
- Test: `src/components/comercial/RankingVendedoresLabels.test.tsx`

**Interfaces:**
- Consumes: local calculations `vendedoresKPIs`, `rankingDetalhado`, `projecoes`, search state and tab state.
- Produces: compact seller performance page using enterprise primitives.

- [ ] **Step 1: Run seller-related tests**

Run: `npm test -- --run src/components/comercial/RankingVendedoresChart.test.ts src/components/comercial/RankingVendedoresLabels.test.tsx`

Expected: PASS before editing.

- [ ] **Step 2: Replace the top filter and header**

In `VendedoresPage.tsx`, remove the `CollapsibleFilterBar` import and use `EnterpriseComercialFilters` plus `EnterprisePageHeader`:

```tsx
<div className="enterprise-page">
  <EnterprisePageHeader
    title="Painel de Vendedores"
    subtitle="Performance, metas, ranking e comparativos"
    metadata={`${vendedoresFiltrados.length.toLocaleString('pt-BR')} vendedores visiveis`}
    actions={
      <EnterpriseSearchFilter
        label="Busca"
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar vendedor..."
      />
    }
  />
  <EnterpriseComercialFilters
    pendingFilters={pendingFilters}
    appliedFilters={appliedFilters}
    onPendingFiltersChange={setPendingFilters}
    onApply={handleBuscar}
    onClear={handleClearFilters}
    hasChanges={hasChanges}
    anos={ANOS_DISPONIVEIS}
    vendedores={vendedoresDisponiveis}
    resultCount={vendedoresPerformance.length}
    showVendedorFilter
  />
</div>
```

Keep the existing download button if it is wired to a real handler; otherwise remove the inert visual button.

- [ ] **Step 3: Replace KPI cards**

Replace the top KPI `Card` grid with:

```tsx
<div className="enterprise-grid-metrics">
  <EnterpriseMetricCard label="Meta total" value={formatCurrency(vendedoresKPIs.totalMeta, true)} context="Meta acumulada dos vendedores" target={`${formatPercent(vendedoresKPIs.percentualMeta)} atingido`} tone="info" />
  <EnterpriseMetricCard label="Faturado" value={formatCurrency(vendedoresKPIs.totalFaturado, true)} context="Faturamento liquido no periodo" target={`${formatCurrency(vendedoresKPIs.faltaMeta, true)} para a meta`} tone="positive" />
  <EnterpriseMetricCard label="Devolucoes" value={formatCurrency(vendedoresKPIs.totalDevolucoes, true)} context="Valor devolvido no periodo" tone="negative" />
  <EnterpriseMetricCard label="Clientes atendidos" value={formatNumber(vendedoresKPIs.clientesAtendidos)} context={`${formatNumber(vendedoresKPIs.clientesAtivos)} ativos nos ultimos 3 meses`} tone="neutral" />
</div>
```

- [ ] **Step 4: Replace decorative ranking cards**

For top sellers, use `EnterpriseDataPanel` with a compact list instead of podium/gradient cards:

```tsx
<EnterpriseDataPanel title="Ranking executivo" description="Vendedores por faturamento liquido">
  <div className="divide-y divide-border/60">
    {rankingDetalhado.slice(0, 8).map((v) => (
      <button key={v.codigo} className="flex w-full min-w-0 items-center justify-between gap-3 py-2 text-left hover:bg-muted/40" onClick={() => setSelectedVendedor(v.codigo)}>
        <span className="min-w-0 truncate text-sm font-medium">{v.nome}</span>
        <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{formatCurrency(v.faturamentoLiquido, true)}</span>
      </button>
    ))}
  </div>
</EnterpriseDataPanel>
```

Remove `bg-gradient-*`, `rank-1`, `rank-2`, `rank-3`, heavy shadows and icon boxes from migrated sections.

- [ ] **Step 5: Convert tables to `EnterpriseTable` primitives**

Replace manual table class names in ranking/projecoes/export sections with `EnterpriseTable`, `EnterpriseThead`, `EnterpriseTbody`, `EnterpriseTr`, `EnterpriseTh` and `EnterpriseTd`. Mark money and percentage cells with `numeric`.

- [ ] **Step 6: Run seller tests and build**

Run: `npm test -- --run src/components/comercial/RankingVendedoresChart.test.ts src/components/comercial/RankingVendedoresLabels.test.tsx`

Run: `npm run build`

Expected: PASS and build exits 0.

- [ ] **Step 7: Commit vendedores migration**

```bash
git add src/pages/comercial/VendedoresPage.tsx
git commit -m "feat: migrate seller dashboard visual system"
```

### Task 6: Comercial Clientes Migration

**Files:**
- Modify: `src/pages/comercial/ClientesAnalysePage.tsx`
- Modify: `src/pages/comercial/ClientesPage.tsx`
- Test: `src/components/comercial/ClientesExperience.test.tsx`

**Interfaces:**
- Consumes: `useComercialData(appliedFilters)`, client ranking, search, insights and tab state.
- Produces: `/comercial/clientes` using the migrated `ClientesPage` and enterprise primitives.

- [ ] **Step 1: Run client experience tests**

Run: `npm test -- --run src/components/comercial/ClientesExperience.test.tsx`

Expected: PASS before editing.

- [ ] **Step 2: Route `ClientesAnalysePage` to migrated page**

Change `src/pages/comercial/ClientesAnalysePage.tsx`:

```tsx
import ClientesPage from './ClientesPage';

export default function ClientesAnalysePage() {
  return <ClientesPage />;
}
```

- [ ] **Step 3: Replace local KPI component with `EnterpriseMetricCard`**

Remove local `KpiCard` and `useCountUp` from `ClientesPage.tsx`. Use:

```tsx
<div className="enterprise-grid-metrics">
  <EnterpriseMetricCard label="Total clientes" value={kpis.qtdClientes.toLocaleString('pt-BR')} context="Clientes unicos no periodo" tone="info" />
  <EnterpriseMetricCard label="Novos clientes" value={novosClientes.length.toLocaleString('pt-BR')} context="Primeira compra no ultimo mes" comparison={<VarianceIndicator value={12.4} label="referencia local" />} tone="positive" />
  <EnterpriseMetricCard label="Em risco" value={clientesEmRisco.length.toLocaleString('pt-BR')} context="Sem compra ha 3+ meses" tone="warning" />
  <EnterpriseMetricCard label="Estados atendidos" value={ufsUnicas.length.toLocaleString('pt-BR')} context="Cobertura geografica" tone="neutral" />
</div>
```

Keep only comparisons that already exist in the page calculation. If a delta is currently hardcoded only for decoration, remove it.

- [ ] **Step 4: Replace filter/header composition**

Use `EnterprisePageHeader`, `EnterpriseComercialFilters` and `EnterpriseSearchFilter` as in Task 5. Pass `showVendedorFilter` and `resultCount={clientesPerformance.length}`.

- [ ] **Step 5: Replace podium/cards and insight grids**

Convert ranking, insights, risk and new-customer sections to `EnterpriseDataPanel`. Use compact rows with `border-b`, `truncate`, `tabular-nums`, and restrained `EnterpriseBadge`.

- [ ] **Step 6: Convert ranking table**

Replace the full ranking table with `EnterpriseTable` primitives. Ensure:

- money cells use `numeric`;
- client names have `min-w-0` and truncate;
- dates stay in `tabular-nums`;
- no `premium-table-row`, `rank-*`, `shadow-md` or `bg-gradient-*` remains in `ClientesPage.tsx`.

- [ ] **Step 7: Run client tests and visual grep**

Run: `npm test -- --run src/components/comercial/ClientesExperience.test.tsx`

Run: `rg -n "bg-gradient|premium-table-row|rank-|shadow-md|rounded-2xl" src/pages/comercial/ClientesPage.tsx`

Expected: tests PASS and grep returns no migrated decorative class matches.

- [ ] **Step 8: Commit client migration**

```bash
git add src/pages/comercial/ClientesAnalysePage.tsx src/pages/comercial/ClientesPage.tsx
git commit -m "feat: migrate client analysis visual system"
```

### Task 7: Operacional Estoque Migration

**Files:**
- Create: `src/components/operacional/estoque/EnterpriseEstoqueFilters.tsx`
- Modify: `src/pages/operacional/EstoquePage.tsx`
- Modify: `src/components/operacional/estoque/EstoqueCommandCenter.tsx`
- Modify: `src/components/operacional/estoque/EstoqueSummaryCards.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductsTable.tsx`
- Test: `src/pages/operacional/EstoquePage.test.tsx`
- Test: `src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`
- Test: `src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

**Interfaces:**
- Consumes: `StockQuickFilter`, `StockSortMode`, `filterStockInsights`, `sortStockInsights`, `buildStockInsights`.
- Produces: estoque central and giro filters using the enterprise filter bar.

- [ ] **Step 1: Run estoque tests**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Expected: PASS before editing.

- [ ] **Step 2: Create `EnterpriseEstoqueFilters`**

Create `src/components/operacional/estoque/EnterpriseEstoqueFilters.tsx`:

```tsx
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
  type EnterpriseOption,
} from '@/components/enterprise';
import type { StockQuickFilter } from './estoqueIntelligence';

const quickOptions: EnterpriseOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponiveis' },
  { value: 'with-stock', label: 'Com estoque' },
  { value: 'low', label: 'Estoque baixo' },
  { value: 'critical', label: 'Criticos' },
  { value: 'out', label: 'Sem estoque' },
  { value: 'stagnant', label: 'Parados' },
  { value: 'attention', label: 'Exigem atencao' },
];

interface EnterpriseEstoqueFiltersProps {
  search: string;
  quickFilter: StockQuickFilter;
  brands: string[];
  groups: string[];
  lines: string[];
  options: { brands: string[]; groups: string[]; lines: string[] };
  resultCount: number;
  onSearchChange: (value: string) => void;
  onQuickFilterChange: (value: StockQuickFilter) => void;
  onBrandsChange: (value: string[]) => void;
  onGroupsChange: (value: string[]) => void;
  onLinesChange: (value: string[]) => void;
  onClearAll: () => void;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

export function EnterpriseEstoqueFilters(props: EnterpriseEstoqueFiltersProps) {
  const activeCount = Number(props.search.length > 0) + Number(props.quickFilter !== 'all') + props.brands.length + props.groups.length + props.lines.length;

  return (
    <EnterpriseFilterBar activeCount={activeCount} onClear={props.onClearAll} resultCount={props.resultCount} summary={props.quickFilter === 'all' ? 'Todos os produtos' : quickOptions.find((item) => item.value === props.quickFilter)?.label}>
      {props.leading}
      <EnterpriseSearchFilter label="Busca" onChange={props.onSearchChange} placeholder="Produto, codigo ou referencia" value={props.search} />
      <EnterpriseSelectFilter label="Disponibilidade" onChange={(value) => props.onQuickFilterChange((value || 'all') as StockQuickFilter)} options={quickOptions.filter((item) => item.value !== 'all')} value={props.quickFilter === 'all' ? undefined : props.quickFilter} />
      <EnterpriseMultiSelectFilter label="Marca" onChange={props.onBrandsChange} options={props.options.brands.map((value) => ({ value, label: value }))} values={props.brands} />
      <EnterpriseMultiSelectFilter label="Grupo" onChange={props.onGroupsChange} options={props.options.groups.map((value) => ({ value, label: value }))} values={props.groups} />
      <EnterpriseMultiSelectFilter label="Linha" onChange={props.onLinesChange} options={props.options.lines.map((value) => ({ value, label: value }))} values={props.lines} />
      {props.actions}
    </EnterpriseFilterBar>
  );
}
```

- [ ] **Step 3: Replace `EstoqueSmartFilters` usage**

In `EstoqueCommandCenter.tsx`, replace import and JSX:

```tsx
import { EnterpriseEstoqueFilters } from './EnterpriseEstoqueFilters';

<EnterpriseEstoqueFilters
  actions={actionsNode}
  brands={brands}
  groups={groups}
  leading={viewModeSegment}
  lines={lines}
  onBrandsChange={setBrands}
  onClearAll={clearFilters}
  onGroupsChange={setGroups}
  onLinesChange={setLines}
  onQuickFilterChange={setQuickFilter}
  onSearchChange={setSearch}
  options={options}
  quickFilter={quickFilter}
  resultCount={filtered.length}
  search={search}
/>
```

Keep the attention sheet, export button and view-mode segment exactly functional.

- [ ] **Step 4: Replace giro filters in `EstoquePage.tsx`**

Remove `UnifiedFilterBar` and `FilterDropdownChip` imports. Use `EnterpriseFilterBar`, `EnterpriseSearchFilter`, `EnterpriseSelectFilter` and `EnterpriseMultiSelectFilter` for `pendingGiro`. Preserve `applyGiroFilters`, `clearGiroFilters` and `giroActiveCount`.

- [ ] **Step 5: Migrate summary cards and products table**

In `EstoqueSummaryCards.tsx`, render `EnterpriseMetricCard` for total SKUs, valor em estoque, itens criticos and sem giro. Keep `onFilterChange` clickable behavior.

In `EstoqueProductsTable.tsx`, replace table wrapper/classes with `EnterpriseTable` primitives and keep sorting callbacks. Numeric cells must use `numeric`.

- [ ] **Step 6: Run estoque tests and visual grep**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Run: `rg -n "UnifiedFilterBar|FilterDropdownChip|bg-gradient|shadow-lg|rounded-2xl" src/pages/operacional/EstoquePage.tsx src/components/operacional/estoque`

Expected: tests PASS. The grep may still show `FilterDropdownChip` only in unused `EstoqueSmartFilters.tsx` if the file remains for compatibility; no migrated file should import it.

- [ ] **Step 7: Commit estoque migration**

```bash
git add src/components/operacional/estoque/EnterpriseEstoqueFilters.tsx src/pages/operacional/EstoquePage.tsx src/components/operacional/estoque/EstoqueCommandCenter.tsx src/components/operacional/estoque/EstoqueSummaryCards.tsx src/components/operacional/estoque/EstoqueProductsTable.tsx
git commit -m "feat: migrate stock visual system"
```

### Task 8: Financeiro Resumo Migration

**Files:**
- Create: `src/components/resumo/EnterpriseResumoFilters.tsx`
- Modify: `src/pages/financeiro/ResumoPage.tsx`
- Modify: `src/components/resumo/ResumoFiltersBar.tsx`
- Modify: `src/components/resumo/ResumoVitalsKPIs.tsx`
- Modify: `src/components/resumo/ResumoDuplicatasTable.tsx`
- Modify: `src/components/resumo/PedidosAbertosTable.tsx`
- Test: `src/components/resumo/ResumoResponsive.test.tsx`

**Interfaces:**
- Consumes: `ResumoFilters`, `useResumoComputed(filters)`, `hasSearched`, `markSearched`, `resetSearch`, existing table props.
- Produces: compact financeiro resumo layout and standardized duplicata filters.

- [ ] **Step 1: Run resumo tests**

Run: `npm test -- --run src/components/resumo/ResumoResponsive.test.tsx`

Expected: PASS before editing.

- [ ] **Step 2: Create `EnterpriseResumoFilters`**

Create `src/components/resumo/EnterpriseResumoFilters.tsx`:

```tsx
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
  type EnterpriseOption,
} from '@/components/enterprise';
import type { ResumoFilters } from '@/types/resumo';

const monthOptions: EnterpriseOption[] = [
  { value: '01', label: 'Jan' }, { value: '02', label: 'Fev' }, { value: '03', label: 'Mar' },
  { value: '04', label: 'Abr' }, { value: '05', label: 'Mai' }, { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' }, { value: '08', label: 'Ago' }, { value: '09', label: 'Set' },
  { value: '10', label: 'Out' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dez' },
];

const statusOptions: EnterpriseOption[] = [
  { value: 'em_aberto_nao_faturado', label: 'Em aberto' },
  { value: 'faturado_a_receber', label: 'Faturado a receber' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'a_vencer', label: 'A vencer' },
  { value: 'pago', label: 'Pagas' },
];

export function EnterpriseResumoFilters({ filters, onChange, empresas, anos, resultCount }: { filters: ResumoFilters; onChange: (filters: ResumoFilters) => void; empresas: string[]; anos: string[]; resultCount?: number }) {
  const update = (patch: Partial<ResumoFilters>) => onChange({ ...filters, ...patch });
  const activeCount = Number(Boolean(filters.search)) + Number(filters.status !== 'todos') + Number(filters.empresa !== 'todas') + Number((filters.anos?.length ?? 0) > 0) + Number((filters.meses?.length ?? 0) > 0) + Number(Boolean(filters.dataInicio || filters.dataFim));
  const reset = () => onChange({ search: '', status: 'todos', empresa: 'todas', anos: [], meses: [], dataInicio: null, dataFim: null });

  return (
    <EnterpriseFilterBar activeCount={activeCount} onClear={reset} resultCount={resultCount} summary={activeCount ? `${activeCount} filtros aplicados` : 'Sem filtros adicionais'}>
      <EnterpriseSearchFilter label="Busca" onChange={(search) => update({ search })} placeholder="Cliente, codigo ou duplicata" value={filters.search} />
      <EnterpriseSelectFilter label="Status" onChange={(status) => update({ status: (status as ResumoFilters['status']) || 'todos' })} options={statusOptions} value={filters.status === 'todos' ? undefined : filters.status} />
      <EnterpriseSelectFilter label="Filial" onChange={(empresa) => update({ empresa: empresa || 'todas' })} options={empresas.map((value) => ({ value, label: value }))} value={filters.empresa === 'todas' ? undefined : filters.empresa} />
      <EnterpriseSelectFilter label="Ano" onChange={(ano) => update({ anos: ano ? [ano] : [] })} options={anos.map((ano) => ({ value: ano, label: ano }))} value={filters.anos?.[0]} />
      <EnterpriseMultiSelectFilter label="Mes" onChange={(meses) => update({ meses })} options={monthOptions} values={filters.meses || []} />
    </EnterpriseFilterBar>
  );
}
```

- [ ] **Step 3: Replace `ResumoFiltersBar` implementation**

In `ResumoFiltersBar.tsx`, delegate to the new adapter:

```tsx
import { EnterpriseResumoFilters } from './EnterpriseResumoFilters';

export function ResumoFiltersBar(props: Props) {
  return <EnterpriseResumoFilters filters={props.filters} onChange={props.onChange} empresas={props.empresas} anos={props.anos ?? []} />;
}
```

- [ ] **Step 4: Recompose `ResumoPage` top area**

Replace `PelegriniModuleHeader` and the separate action row with `EnterprisePageHeader`:

```tsx
<EnterprisePageHeader
  title="Resumo Financeiro"
  subtitle="Liquidez, contas a receber e risco de cobranca"
  metadata={hasSearched && hasSource ? `${duplicatas.length.toLocaleString('pt-BR')} duplicatas | ${pedidos.length.toLocaleString('pt-BR')} pedidos` : undefined}
  actions={
    <>
      <Button variant="outline" size="sm" onClick={() => { setFilters(initialFilters); resetSearch(); }}>Limpar</Button>
      <Button size="sm" onClick={() => markSearched()}>Buscar</Button>
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || !hasSearched}>Atualizar</Button>
    </>
  }
/>
```

Use wrapper `className="enterprise-page max-w-[1600px] mx-auto"`.

- [ ] **Step 5: Migrate resumo KPIs and tables**

In `ResumoVitalsKPIs.tsx`, render `EnterpriseMetricCard` with existing values and context. Do not add new calculations.

In `ResumoDuplicatasTable.tsx` and `PedidosAbertosTable.tsx`, use `EnterpriseTable` primitives. Mark columns that render currency, percentages, quantities, dates or document numbers with `numeric` so they get right alignment and tabular numerals.

- [ ] **Step 6: Run resumo tests and build**

Run: `npm test -- --run src/components/resumo/ResumoResponsive.test.tsx`

Run: `npm run build`

Expected: PASS and build exits 0.

- [ ] **Step 7: Commit resumo migration**

```bash
git add src/components/resumo/EnterpriseResumoFilters.tsx src/pages/financeiro/ResumoPage.tsx src/components/resumo/ResumoFiltersBar.tsx src/components/resumo/ResumoVitalsKPIs.tsx src/components/resumo/ResumoDuplicatasTable.tsx src/components/resumo/PedidosAbertosTable.tsx
git commit -m "feat: migrate financial summary visual system"
```

### Task 9: Financeiro DRE Migration

**Files:**
- Create: `src/components/dre/EnterpriseDreFilters.tsx`
- Modify: `src/pages/financeiro/DrePage.tsx`
- Modify: `src/components/dre/DreIndicators.tsx`
- Modify: `src/components/dre/DreDashboard.tsx`
- Modify: `src/components/dre/DreGroupedTable.tsx`
- Test: `src/components/dre/dreFilterPeriod.test.ts`

**Interfaces:**
- Consumes: `DreFiltersType`, `extractFilterOptions`, `filterDreData`, `calculateIndicators`, `calculateGroupSummary`.
- Produces: compact DRE page with standardized filters, metric cards, panels and table.

- [ ] **Step 1: Run DRE tests**

Run: `npm test -- --run src/components/dre/dreFilterPeriod.test.ts`

Expected: PASS.

- [ ] **Step 2: Create `EnterpriseDreFilters`**

Create `src/components/dre/EnterpriseDreFilters.tsx`:

```tsx
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSelectFilter,
  type EnterpriseOption,
} from '@/components/enterprise';
import type { DreFilters as DreFiltersType } from '@/types/dre';

interface EnterpriseDreFiltersProps {
  filters: DreFiltersType;
  appliedFilters: DreFiltersType;
  onFiltersChange: (filters: DreFiltersType) => void;
  onSearch: () => void;
  onClear: () => void;
  resultCount: number;
  empresas: string[];
  anos: string[];
  grupos: string[];
  codigos: string[];
  vendedoresInternos: string[];
  vendedoresExternos: string[];
  empresasVendedorInterno: string[];
  empresasVendedorExterno: string[];
}

const toOptions = (values: string[]): EnterpriseOption[] => values.map((value) => ({ value, label: value }));

export function EnterpriseDreFilters({ filters, appliedFilters, onFiltersChange, onSearch, onClear, resultCount, empresas, anos, grupos, codigos, vendedoresInternos, vendedoresExternos, empresasVendedorInterno, empresasVendedorExterno }: EnterpriseDreFiltersProps) {
  const update = (patch: Partial<DreFiltersType>) => onFiltersChange({ ...filters, ...patch });
  const activeCount = [
    appliedFilters.empresa,
    appliedFilters.anos?.length,
    appliedFilters.meses?.length,
    appliedFilters.dataInicio || appliedFilters.dataFim,
    appliedFilters.grupos?.length,
    appliedFilters.codigos?.length,
    appliedFilters.vendedoresInternos?.length,
    appliedFilters.vendedoresExternos?.length,
    appliedFilters.empresasVendedorInterno?.length,
    appliedFilters.empresasVendedorExterno?.length,
  ].filter(Boolean).length;

  return (
    <EnterpriseFilterBar activeCount={activeCount} onApply={onSearch} onClear={onClear} resultCount={resultCount} summary={activeCount ? `${activeCount} filtros aplicados` : 'DRE completo'}>
      <EnterpriseSelectFilter label="Empresa" onChange={(empresa) => update({ empresa })} options={toOptions(empresas)} value={filters.empresa} />
      <EnterpriseMultiSelectFilter label="Ano" onChange={(values) => update({ anos: values })} options={toOptions(anos)} values={filters.anos || []} />
      <EnterpriseMultiSelectFilter label="Grupo" onChange={(values) => update({ grupos: values })} options={toOptions(grupos)} values={filters.grupos || []} />
      <EnterpriseMultiSelectFilter label="Conta" onChange={(values) => update({ codigos: values })} options={toOptions(codigos)} values={filters.codigos || []} />
      <EnterpriseMultiSelectFilter label="Vend. interno" onChange={(values) => update({ vendedoresInternos: values })} options={toOptions(vendedoresInternos)} values={filters.vendedoresInternos || []} />
      <EnterpriseMultiSelectFilter label="Vend. externo" onChange={(values) => update({ vendedoresExternos: values })} options={toOptions(vendedoresExternos)} values={filters.vendedoresExternos || []} />
      <EnterpriseMultiSelectFilter label="Emp. interno" onChange={(values) => update({ empresasVendedorInterno: values })} options={toOptions(empresasVendedorInterno)} values={filters.empresasVendedorInterno || []} />
      <EnterpriseMultiSelectFilter label="Emp. externo" onChange={(values) => update({ empresasVendedorExterno: values })} options={toOptions(empresasVendedorExterno)} values={filters.empresasVendedorExterno || []} />
    </EnterpriseFilterBar>
  );
}
```

- [ ] **Step 3: Replace DRE page chrome**

In `DrePage.tsx`, import `EnterprisePageHeader` and `EnterpriseDreFilters`. Replace desktop `Header` plus `CollapsibleFilterBar` with:

```tsx
<div className="enterprise-page">
  <EnterprisePageHeader
    title="DRE"
    subtitle="Demonstrativo de Resultado e composicao de margem"
    metadata={hasSearched ? `${filteredData.length.toLocaleString('pt-BR')} lancamentos` : undefined}
    actions={<Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>}
  />
  <EnterpriseDreFilters
    filters={pendingFilters}
    appliedFilters={appliedFilters}
    onFiltersChange={setPendingFilters}
    onSearch={handleSearch}
    onClear={handleClearFilters}
    resultCount={filteredData.length}
    empresas={filterOptions.empresas}
    anos={filterOptions.anos}
    grupos={filterOptions.grupos}
    codigos={filterOptions.codigos}
    vendedoresInternos={filterOptions.vendedoresInternos}
    vendedoresExternos={filterOptions.vendedoresExternos}
    empresasVendedorInterno={filterOptions.empresasVendedorInterno}
    empresasVendedorExterno={filterOptions.empresasVendedorExterno}
  />
</div>
```

For mobile, keep `MobileHeader` but replace bottom sheet contents with `EnterpriseDreFilters` so behavior is shared.

- [ ] **Step 4: Migrate DRE indicators**

In `DreIndicators.tsx`, map existing indicators to `EnterpriseMetricCard`. Preserve all existing indicator values and labels. Use `tone="positive"` for positive revenue/result, `tone="negative"` for negative values, `tone="warning"` for cost/expense, and `tone="neutral"` for informational values.

- [ ] **Step 5: Migrate DRE dashboard panels**

In `DreDashboard.tsx`, replace local `bg-card rounded-xl border p-4` wrappers with `EnterpriseDataPanel`. Remove decorative absolute circles and hover shadows from KPI cards. Keep dialogs for despesas variaveis/fixas and all calculations unchanged.

- [ ] **Step 6: Migrate grouped table**

In `DreGroupedTable.tsx`, use `EnterpriseTable` primitives while preserving hierarchy indentation, expand/collapse behavior and group totals.

- [ ] **Step 7: Run DRE tests and grep**

Run: `npm test -- --run src/components/dre/dreFilterPeriod.test.ts`

Run: `rg -n "bg-gradient|rounded-2xl|shadow-md|shadow-lg|dre-row-hover" src/pages/financeiro/DrePage.tsx src/components/dre`

Expected: test PASS. The grep should not show these classes in migrated DRE files except legacy components intentionally still outside the active path for non-pilot companies.

- [ ] **Step 8: Commit DRE migration**

```bash
git add src/components/dre/EnterpriseDreFilters.tsx src/pages/financeiro/DrePage.tsx src/components/dre/DreIndicators.tsx src/components/dre/DreDashboard.tsx src/components/dre/DreGroupedTable.tsx
git commit -m "feat: migrate dre visual system"
```

### Task 10: Integration, Visual Audit, and Final Hardening

**Files:**
- Modify only files proven necessary by failing tests, TypeScript errors, lint errors or visual evidence.

**Interfaces:**
- Consumes: all work from Tasks 1-9.
- Produces: verified Onda 1 ready for user review.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
npm test -- --run src/components/enterprise/EnterpriseFoundation.test.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/comercial/RankingVendedoresChart.test.ts src/components/comercial/RankingVendedoresLabels.test.tsx src/components/comercial/ClientesExperience.test.tsx src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx src/components/resumo/ResumoResponsive.test.tsx src/components/dre/dreFilterPeriod.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test -- --run`

Expected: PASS. If unrelated pre-existing tests fail, capture exact failures and verify the focused Onda 1 tests still pass.

- [ ] **Step 3: Run lint on migrated files**

Run:

```bash
npx eslint src/components/enterprise src/components/comercial/EnterpriseComercialFilters.tsx src/pages/comercial/MetasVendedoresPage.tsx src/pages/comercial/VendedoresPage.tsx src/pages/comercial/ClientesPage.tsx src/pages/comercial/ClientesAnalysePage.tsx src/components/operacional/estoque src/pages/operacional/EstoquePage.tsx src/components/resumo src/pages/financeiro/ResumoPage.tsx src/components/dre src/pages/financeiro/DrePage.tsx
```

Expected: no lint errors in migrated files.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 5: Start local dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`. Keep the server running for visual audit and stop it before final response.

- [ ] **Step 6: Browser audit routes**

At widths 390, 768, 1024 and 1440 px, inspect:

- `/comercial/dashboard`
- `/comercial/vendedores`
- `/comercial/clientes`
- `/operacional/estoque`
- `/financeiro/resumo`
- `/financeiro/dre`

For each route, evaluate:

```js
({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
})
```

Expected: `overflow` is `false`.

- [ ] **Step 7: Visual checklist**

For each audited route confirm:

- filters are compact and consistent;
- cards have useful context and no excessive height;
- primary data appears before secondary information;
- tables are dense but readable;
- charts are visible, nonblank and not covered by labels;
- buttons and filter labels do not clip;
- no migrated area shows decorative gradients or heavy shadow stacks;
- no cards are nested inside cards.

- [ ] **Step 8: Final diff check**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only intentional Onda 1 files are modified, plus any pre-existing unrelated untracked comissao files preserved outside commits if still present.

- [ ] **Step 9: Commit final hardening if needed**

If Steps 1-8 required fixes:

```bash
git add <files fixed during integration>
git commit -m "fix: harden enterprise visual migration"
```

If no fixes were needed, do not create an empty commit.
