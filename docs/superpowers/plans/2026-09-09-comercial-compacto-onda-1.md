# Comercial Compacto CT/CCH - Onda 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma fundacao visual compacta e aplicar telas operacionais distintas a Comissoes, Cotacoes Abertas e Vendas Perdidas, preservando todos os contratos de dados existentes.

**Architecture:** Componentes locais em `src/components/comercial/compact` controlam cabecalho, filtros, indicadores e viewport rolavel. As tres paginas continuam proprietarias de estado, hooks e acoes; apenas passam a compor a nova fundacao e os componentes de cotacoes existentes recebem variantes por modo.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Framer Motion, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-09-comercial-compacto-onda-1-design.md`

## Global Constraints

- Nao alterar endpoints, parametros, normalizadores, permissoes, calculos, exportacoes ou regras de negocio.
- Preservar as alteracoes locais existentes em autenticacao e em `useComissaoVendedores`.
- Nao introduzir novas dependencias.
- Manter os temas claro e escuro e os acentos CT/CCH existentes.
- Nao criar rolagem horizontal no documento.
- Animacoes devem respeitar `prefers-reduced-motion`.
- Cada etapa usa TDD e inclui apenas seus arquivos no commit.

---

### Task 1: Fundacao compacta do Comercial

**Files:**
- Create: `src/components/comercial/compact/ComercialCompactLayout.tsx`
- Create: `src/components/comercial/compact/ComercialCompactLayout.test.tsx`
- Create: `src/components/comercial/compact/index.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `ComercialCompactPage`, `ComercialCommandBar`, `ComercialFilterBar`, `ComercialMetricStrip`, `ComercialDataViewport`.
- Consumes: `cn`, `Button`, `Tooltip` e tipos React existentes.

- [ ] **Step 1: Write the failing component tests**

```tsx
render(
  <ComercialCompactPage>
    <ComercialCommandBar title="Cotacoes abertas" actions={<button>Exportar</button>} />
    <ComercialMetricStrip metrics={[{ label: 'Valor em aberto', value: 'R$ 1.234.567,89' }]} />
    <ComercialDataViewport><table aria-label="Dados" /></ComercialDataViewport>
  </ComercialCompactPage>,
);
expect(screen.getByRole('heading', { name: 'Cotacoes abertas' })).toBeInTheDocument();
expect(screen.getByLabelText('Indicadores comerciais')).toHaveAttribute('data-density', 'compact');
expect(screen.getByTestId('comercial-data-viewport')).toHaveClass('min-h-0', 'overflow-auto');
```

- [ ] **Step 2: Run the test and verify the missing exports fail**

Run: `npm test -- --run src/components/comercial/compact/ComercialCompactLayout.test.tsx`

Expected: FAIL because `ComercialCompactLayout` does not exist.

- [ ] **Step 3: Implement the shared composition components**

```tsx
export function ComercialCompactPage({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <main className={cn('comercial-compact-page', className)}>{children}</main>;
}

export function ComercialCommandBar({ title, context, actions }: CommandBarProps) {
  return (
    <header className="comercial-command-bar">
      <div className="min-w-0"><h1>{title}</h1>{context && <span>{context}</span>}</div>
      {actions && <div className="comercial-command-actions">{actions}</div>}
    </header>
  );
}

export function ComercialMetricStrip({ metrics }: MetricStripProps) {
  return (
    <section aria-label="Indicadores comerciais" data-density="compact" className="comercial-metric-strip">
      {metrics.map((metric) => <ComercialMetricCell key={metric.label} {...metric} />)}
    </section>
  );
}
```

Add CSS with a flex column page, `min-height: 0`, 44 px command bar, 34 px controls, 64 px metric strip, and internal data scrolling. Use container queries or media queries at 1024, 768 and 640 px.

- [ ] **Step 4: Run focused tests and lint**

Run: `npm test -- --run src/components/comercial/compact/ComercialCompactLayout.test.tsx`

Run: `npx eslint src/components/comercial/compact/ComercialCompactLayout.tsx src/components/comercial/compact/ComercialCompactLayout.test.tsx`

Expected: PASS with no lint output.

- [ ] **Step 5: Commit only the compact foundation**

```bash
git add src/components/comercial/compact src/index.css
git commit -m "feat: add compact commercial layout foundation"
```

### Task 2: Barra de filtros e indicadores de cotacoes

**Files:**
- Modify: `src/components/comercial/cotacoes/CotacoesFilters.tsx`
- Modify: `src/components/comercial/cotacoes/CotacoesKpis.tsx`
- Modify: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`

**Interfaces:**
- Consumes: `ComercialFilterBar`, `ComercialMetricStrip` from Task 1.
- Produces: mode-specific compact filters and metrics while preserving existing props.

- [ ] **Step 1: Add failing tests for mode-specific compact composition**

```tsx
render(<CotacoesFilters mode="abertas" {...filterProps} />);
expect(screen.getByLabelText('Filtros de cotacoes')).toHaveAttribute('data-mode', 'abertas');
expect(screen.getByRole('button', { name: 'Mais filtros' })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Motivos' })).not.toBeInTheDocument();

render(<CotacoesKpis mode="perdidas" kpis={lostKpis} />);
expect(screen.getByLabelText('Indicadores comerciais')).toHaveAttribute('data-mode', 'perdidas');
expect(screen.getByText('Valor perdido')).toBeInTheDocument();
```

- [ ] **Step 2: Run and verify the new assertions fail**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx -t "shared commercial quote components"`

Expected: FAIL because compact mode attributes and `Mais filtros` do not exist.

- [ ] **Step 3: Move secondary filters into an accessible popover**

Keep search and Apply visible. Render Vendedores, Clientes and aging inside `Mais filtros` for open quotes. Render Vendedores, Clientes, Status and Motivos inside `Mais filtros` for lost sales. Keep all labels and pending/applied behavior unchanged.

```tsx
<ComercialFilterBar search={searchControl} primary={primaryControls} actions={actions}>
  <Popover>
    <PopoverTrigger asChild><Button variant="outline">Mais filtros</Button></PopoverTrigger>
    <PopoverContent>{secondaryControls}</PopoverContent>
  </Popover>
</ComercialFilterBar>
```

- [ ] **Step 4: Render KPIs through the shared strip**

Map the current four cells to `ComercialMetricStrip`; set `tone="danger"` for lost value and expired quotes, and ensure the value node has `title={value}` without `truncate`.

- [ ] **Step 5: Run the entire quote component test group**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx -t "shared commercial quote components"`

Expected: PASS.

- [ ] **Step 6: Commit the shared quote controls**

```bash
git add src/components/comercial/cotacoes/CotacoesFilters.tsx src/components/comercial/cotacoes/CotacoesKpis.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx
git commit -m "feat: compact commercial quote controls"
```

### Task 3: Mesa de Cotacoes Abertas

**Files:**
- Modify: `src/pages/comercial/CotacoesAbertasPage.tsx`
- Modify: `src/components/comercial/cotacoes/CotacoesGestorPanel.tsx`
- Modify: `src/components/comercial/cotacoes/CotacoesTable.tsx`
- Modify: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`

**Interfaces:**
- Consumes: compact foundation from Task 1 and quote controls from Task 2.
- Preserves: `useCotacoesAbertas`, `CotacaoDetailDrawer`, `exportCotacoesExcel`, `filtrarCotacoes`, `sortOpenQuotes`.

- [ ] **Step 1: Add a failing page-composition test**

```tsx
await renderCotacoesAbertasPage();
fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
expect(screen.getByRole('main')).toHaveClass('comercial-compact-page');
expect(screen.getByLabelText('Prioridades de cotacoes abertas')).toBeInTheDocument();
expect(screen.getByTestId('comercial-data-viewport')).toContainElement(screen.getByRole('table'));
expect(screen.queryByText('Acompanhe as cotacoes pendentes no periodo selecionado.')).not.toBeInTheDocument();
```

- [ ] **Step 2: Run and verify the compact structure is absent**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx -t "open quotes page"`

Expected: FAIL on the new compact shell and priority label assertions.

- [ ] **Step 3: Recompose the page without changing state or data flow**

Use `ComercialCompactPage`, `ComercialCommandBar`, compact period controls, `CotacoesFilters`, `CotacoesKpis`, a mode-specific `CotacoesGestorPanel`, and `ComercialDataViewport`. Keep export disabled conditions unchanged.

- [ ] **Step 4: Specialize manager panel and table for follow-up work**

For mode `abertas`, use the accessible label `Prioridades de cotacoes abertas`, show overdue count and longest-open quotes, and keep each action wired to `onSelectCotacao`. Keep default sort by open days descending then oldest date.

- [ ] **Step 5: Run all open-quote tests**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx -t "open quotes page"`

Expected: PASS, including query parameters, sorting, drawer, errors and export.

- [ ] **Step 6: Commit the open-quotes desk**

```bash
git add src/pages/comercial/CotacoesAbertasPage.tsx src/components/comercial/cotacoes/CotacoesGestorPanel.tsx src/components/comercial/cotacoes/CotacoesTable.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx
git commit -m "feat: build compact open quotes desk"
```

### Task 4: Analise dedicada de Vendas Perdidas

**Files:**
- Modify: `src/pages/comercial/VendasPerdidasPage.tsx`
- Modify: `src/components/comercial/cotacoes/CotacoesGestorPanel.tsx`
- Modify: `src/components/comercial/cotacoes/CotacoesTable.tsx`
- Modify: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`

**Interfaces:**
- Consumes: compact foundation and existing reason map.
- Preserves: `useVendasPerdidas`, `useMotivosPerda10041`, `MotivoPerdaDialog`, `CotacaoDetailDrawer`, export and retry behavior.

- [ ] **Step 1: Add a failing lost-sales composition test**

```tsx
await renderVendasPerdidasPage();
expect(screen.getByRole('main')).toHaveClass('comercial-compact-page');
expect(screen.getByLabelText('Concentracao de vendas perdidas')).toBeInTheDocument();
expect(screen.queryByText('Análise das perdas e registro dos motivos no período selecionado.')).not.toBeInTheDocument();
expect(within(screen.getByRole('table')).getByText('Motivo da perda')).toBeInTheDocument();
```

- [ ] **Step 2: Run and verify the dedicated structure is absent**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx -t "lost sales page"`

Expected: FAIL on the compact shell or lost-sales concentration label.

- [ ] **Step 3: Recompose the page for loss analysis**

Use the same compact primitives but keep red only for values and statuses that indicate loss. Give Status and Motivos visual priority in the filter popover. Remove the permanent explanatory subtitle.

- [ ] **Step 4: Specialize manager panel and row hierarchy**

For mode `perdidas`, expose the label `Concentracao de vendas perdidas`, summarize the most frequent reason and largest-value losses, and keep edit/detail callbacks unchanged. Place reason, value and seller before secondary dates at narrower widths.

- [ ] **Step 5: Run all lost-sales tests**

Run: `npm test -- --run src/pages/comercial/CotacoesComerciaisPages.test.tsx -t "lost sales page"`

Expected: PASS, including joined reasons, reason editing, local filters, export and retries.

- [ ] **Step 6: Commit the lost-sales analysis**

```bash
git add src/pages/comercial/VendasPerdidasPage.tsx src/components/comercial/cotacoes/CotacoesGestorPanel.tsx src/components/comercial/cotacoes/CotacoesTable.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx
git commit -m "feat: specialize compact lost sales analysis"
```

### Task 5: Mesa compacta de Comissoes

**Files:**
- Modify: `src/pages/comercial/ComissaoPage.tsx`
- Modify: `src/pages/comercial/ComissaoPage.test.tsx`
- Preserve without edits: `src/hooks/useComissaoVendedores.ts`
- Preserve without edits: `src/hooks/useComissaoVendedores.test.ts`

**Interfaces:**
- Consumes: compact foundation from Task 1.
- Preserves: `ComissaoFiltros`, `useComissaoVendedores`, `ComissaoVendedorFilter` and current operation range.

- [ ] **Step 1: Add failing tests for compact filters and metrics**

```tsx
render(<ComissaoPage />);
expect(screen.getByRole('main')).toHaveClass('comercial-compact-page');
expect(screen.getByRole('button', { name: 'Mais filtros' })).toBeInTheDocument();
expect(screen.queryByText(/Metas e comissão de vendedores/)).not.toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
expect(screen.getByLabelText('Indicadores comerciais')).toHaveTextContent('Objetivo mensal');
expect(screen.getByLabelText('Indicadores comerciais')).toHaveTextContent('Pedidos em aberto');
```

- [ ] **Step 2: Run and verify compact behavior is missing**

Run: `npm test -- --run src/pages/comercial/ComissaoPage.test.tsx`

Expected: FAIL because the compact shell, advanced-filter popover and metrics are absent.

- [ ] **Step 3: Recompose filters while preserving request values**

Keep Ano, Mes, Vendedor and Buscar visible. Move Codigo da Meta, fiscal range and switches into `Mais filtros`. Render active advanced choices as removable status chips without changing when `aplicado` is set.

- [ ] **Step 4: Add the compact totals strip**

After an applied query, map `totais.objetivoMensal`, `totais.faturadoAteHoje`, `totais.valorTotal` and `totais.pedidosAberto` into `ComercialMetricStrip`. Render `Indisponivel` for null and `R$ 0,00` for numeric zero.

- [ ] **Step 5: Move the table into the data viewport**

Keep the existing columns and formatter behavior. Make seller/name sticky, keep the header sticky, use 40-44 px rows, and replace the large pre-search card with a compact empty state inside the remaining viewport.

- [ ] **Step 6: Run commission tests and inspect hook diff remains untouched**

Run: `npm test -- --run src/pages/comercial/ComissaoPage.test.tsx src/hooks/useComissaoVendedores.test.ts`

Run: `git diff -- src/hooks/useComissaoVendedores.ts src/hooks/useComissaoVendedores.test.ts`

Expected: tests PASS; hook diff contains only the pre-existing user changes.

- [ ] **Step 7: Commit only commission page files**

```bash
git add src/pages/comercial/ComissaoPage.tsx src/pages/comercial/ComissaoPage.test.tsx
git commit -m "feat: compact commercial commission desk"
```

### Task 6: Integrated responsive verification

**Files:**
- Modify if a verified defect requires it: `src/index.css`
- Modify if a verified defect requires it: files from Tasks 1-5 only.

**Interfaces:**
- Consumes all prior tasks.
- Produces no new public interface.

- [ ] **Step 1: Run all targeted tests**

Run: `npm test -- --run src/components/comercial/compact/ComercialCompactLayout.test.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx src/pages/comercial/ComissaoPage.test.tsx src/hooks/useComissaoVendedores.test.ts`

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 2: Run lint and production build**

Run: `npx eslint src/components/comercial/compact src/components/comercial/cotacoes src/pages/comercial/CotacoesAbertasPage.tsx src/pages/comercial/VendasPerdidasPage.tsx src/pages/comercial/ComissaoPage.tsx`

Run: `npm run build`

Expected: exit code 0. Existing chunk-size warnings may remain, but no new error is accepted.

- [ ] **Step 3: Verify routes at 1440 and 1024 px**

Open `/comercial/comissao`, `/comercial/cotacoes`, and `/comercial/perdidas`. Confirm no global horizontal scroll, one-line desktop metrics, internal table scrolling, readable values and no repeated subtitle.

- [ ] **Step 4: Verify routes at 768 and 390 px**

Confirm two-column metrics, filters inside the mobile panel, no clipped controls, no broken labels and detail access through drawers.

- [ ] **Step 5: Verify runtime quality**

Confirm there is no Vite error overlay, no console error, no broken image and no reference to `IA`, `copilot` or `insights inteligentes` in the three routes.

- [ ] **Step 6: Review final diff**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; unrelated authentication and hook changes remain preserved and identifiable.
