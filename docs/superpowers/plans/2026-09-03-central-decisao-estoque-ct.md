# Central de Decisao de Estoque CT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir a tela de estoque da Casa da Transmissao em uma central confiavel para consulta, giro e decisao, usando somente dados reais das fontes configuradas.

**Architecture:** Manter `useEstoqueData` como unica fronteira de consulta e ampliar seu estado observavel sem alterar endpoints. Componentes puros calculam apresentacao e recomendacoes; Central, Giro e Assistente compartilham os mesmos registros normalizados e tratam falhas parciais separadamente.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, Radix/shadcn, Recharts, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-03-central-decisao-estoque-ct-design.md`

## Global Constraints

- Nao alterar endpoints, payloads, autenticacao ou permissoes.
- Nao criar dados ficticios nem transformar fonte indisponivel em valor zero.
- Usar apenas campos presentes em `EstoqueRecord` e `GiroRecord`.
- Preservar mudancas locais existentes e limitar o escopo aos arquivos de estoque.
- A pagina nao pode gerar rolagem horizontal em 390, 768, 1024 ou 1440 pixels.
- Toda estimativa deve informar formula, periodo e natureza estimada.

---

## File Structure

- `src/hooks/useEstoqueData.ts`: saude, atualizacao e separacao das tres fontes.
- `src/types/estoque.ts`: tipos de disponibilidade e metadados da consulta.
- `src/components/operacional/estoque/estoqueIntelligence.ts`: agregacao, granularidade, KPIs e recomendacoes puras.
- `src/components/operacional/estoque/EstoqueCommandCenter.tsx`: modos consolidado/detalhado, filtros e composicao da Central.
- `src/components/operacional/estoque/EstoqueSummaryCards.tsx`: indicadores filtraveis e tooltips.
- `src/components/operacional/estoque/EstoqueProductsTable.tsx`: colunas distintas por modo e lista responsiva.
- `src/components/operacional/estoque/EstoqueProductDrawer.tsx`: detalhe operacional baseado em campos reais.
- `src/components/operacional/GiroEstoqueTab.tsx`: painel gerencial de giro.
- `src/components/operacional/EstoqueAssistantTab.tsx`: chat, sugestoes e composicao do assistente.
- `src/components/operacional/EstoqueInsights.tsx`: insights locais deterministas e acionaveis.
- `src/pages/operacional/EstoquePage.tsx`: cabecalho, abas, estados parciais e atualizacao.

### Task 1: Source Health And Refresh Metadata

**Files:**
- Modify: `src/types/estoque.ts`
- Modify: `src/hooks/useEstoqueData.ts`
- Modify: `src/hooks/useEstoqueData.test.ts`
- Modify: `src/hooks/useEstoqueData.integration.test.tsx`

**Interfaces:**
- Produces: `StockSourceState`, `sourceStatus`, `lastSuccessfulUpdate` e `refetch()`.
- Consumes: as tres queries TanStack existentes.

- [ ] **Step 1: Write failing tests for partial and successful sources**

```ts
expect(result.current.sourceStatus).toEqual({
  consolidado: 'ready',
  detalhado: 'error',
  giro: 'ready',
});
expect(result.current.lastSuccessfulUpdate).toBeInstanceOf(Date);
```

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- --run src/hooks/useEstoqueData.test.ts src/hooks/useEstoqueData.integration.test.tsx`

Expected: FAIL because source metadata is not returned.

- [ ] **Step 3: Implement source state without changing fetch contracts**

```ts
export type StockSourceState = 'idle' | 'loading' | 'fetching' | 'ready' | 'error';

function queryState(query: {
  isLoading: boolean; isFetching: boolean; isError: boolean; data?: unknown[];
}): StockSourceState {
  if (query.isLoading) return 'loading';
  if (query.isError && !query.data?.length) return 'error';
  if (query.isFetching) return 'fetching';
  return query.data ? 'ready' : 'idle';
}
```

Return a stable `lastSuccessfulUpdate` updated only after at least one source succeeds. Keep `sourceErrors` and `partialSources` intact.

- [ ] **Step 4: Verify focused tests**

Run: `npm test -- --run src/hooks/useEstoqueData.test.ts src/hooks/useEstoqueData.integration.test.tsx`

Expected: PASS.

### Task 2: Real Consolidated And Detailed Modes

**Files:**
- Modify: `src/components/operacional/estoque/estoqueIntelligence.ts`
- Modify: `src/components/operacional/estoque/estoqueIntelligence.test.ts`
- Modify: `src/components/operacional/estoque/EstoqueCommandCenter.tsx`
- Modify: `src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductsTable.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

**Interfaces:**
- Produces: `StockGranularity`, `detectStockGranularity(records)` and mode-specific column presets.
- Consumes: `ViewMode`, `EstoqueRecord[]` and existing `StockProductInsight[]`.

- [ ] **Step 1: Write failing tests for aggregation and detail granularity**

```ts
expect(buildConsolidatedStock([branchA, branchB])).toEqual([
  expect.objectContaining({ cod_produto: 101, quantidade_estoque: 15, valor_estoque: 7500 }),
]);
expect(detectStockGranularity([{ ...branchA, localizacao_produto: 'A-01' }])).toBe('location');
```

Add a component test asserting that detailed mode displays `Localizacao`, `Custo medio`, `Ultima compra` and `Ultima venda`, while consolidated mode displays aggregate columns.

- [ ] **Step 2: Run intelligence and table tests**

Run: `npm test -- --run src/components/operacional/estoque/estoqueIntelligence.test.ts src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Expected: FAIL on missing aggregation and mode columns.

- [ ] **Step 3: Add pure granularity helpers**

```ts
export type StockGranularity = 'product' | 'branch' | 'location';

export function detectStockGranularity(rows: EstoqueRecord[]): StockGranularity {
  if (rows.some(row => Boolean(row.localizacao_produto?.trim()))) return 'location';
  const branches = new Set(rows.map(row => row.cod_empresa));
  return branches.size > 1 ? 'branch' : 'product';
}
```

Aggregate consolidated rows by `cod_produto`; keep detailed rows independent by `cod_empresa`, `cod_produto` and `localizacao_produto`.

- [ ] **Step 4: Render genuinely different modes**

Use separate immutable presets:

```ts
const consolidatedColumns = ['product', 'brand', 'group', 'quantity', 'value', 'lastMovement', 'status'];
const detailedColumns = ['product', 'branch', 'location', 'quantity', 'averageCost', 'value', 'lastPurchase', 'lastSale'];
```

When `detectStockGranularity(detalhadoData) === 'product'`, show: `A fonte detalhada nao informou filial ou localizacao; exibindo os campos adicionais disponiveis.`

- [ ] **Step 5: Verify mode tests**

Run: `npm test -- --run src/components/operacional/estoque/estoqueIntelligence.test.ts src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Expected: PASS.

### Task 3: Actionable Central Header, KPIs And Filters

**Files:**
- Modify: `src/pages/operacional/EstoquePage.tsx`
- Modify: `src/pages/operacional/EstoquePage.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueSummaryCards.tsx`
- Modify: `src/components/operacional/estoque/EstoqueDashboardControls.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueSmartFilters.tsx`

**Interfaces:**
- Consumes: source health and refresh metadata from Task 1.
- Produces: compact header, six responsive KPIs and filter chips.

- [ ] **Step 1: Write failing interaction tests**

```tsx
fireEvent.click(screen.getByRole('button', { name: /Sem estoque.*12/i }));
expect(screen.getByRole('button', { name: /Sem estoque.*12/i })).toHaveAttribute('aria-pressed', 'true');
expect(screen.getByText(/Quantidade menor ou igual a zero/i)).toBeInTheDocument();
```

Test that refresh shows feedback and that a partial source warning does not hide healthy stock data.

- [ ] **Step 2: Run page and control tests**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueDashboardControls.test.tsx`

Expected: FAIL on tooltip and refresh metadata.

- [ ] **Step 3: Implement compact header and responsive cards**

Use `grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6`, `min-w-0`, tabular numbers and responsive value sizing. Add tooltips with rule, period and source for every metric.

- [ ] **Step 4: Implement filter behavior**

Cards toggle their quick filter. Filter chips remove individual dimensions. Export receives the already filtered records. Persist column preferences under `pelegrini:estoque:columns:${branchKey}:${viewMode}`.

- [ ] **Step 5: Verify focused tests**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueDashboardControls.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`

Expected: PASS.

### Task 4: Management Giro Dashboard

**Files:**
- Create: `src/components/operacional/estoque/giroIntelligence.ts`
- Create: `src/components/operacional/estoque/giroIntelligence.test.ts`
- Create: `src/components/operacional/estoque/GiroManagementPanel.tsx`
- Create: `src/components/operacional/estoque/GiroManagementPanel.test.tsx`
- Modify: `src/components/operacional/GiroEstoqueTab.tsx`

**Interfaces:**
- Produces: `GiroManagementSummary`, `buildGiroManagementSummary(products)` and a filter callback.
- Consumes: current `GiroProductSummary[]` generated by `GiroEstoqueTab`.

- [ ] **Step 1: Write failing metric tests**

```ts
expect(buildGiroManagementSummary(products)).toMatchObject({
  serving: 1,
  warning: 1,
  shortage: 1,
  excess: 1,
  idleCapital: 30000,
  averageCoverageDays: 42,
});
```

Coverage ignores products with no sales baseline; idle capital sums products classified as excess or without sales beyond the configured window.

- [ ] **Step 2: Run the new tests**

Run: `npm test -- --run src/components/operacional/estoque/giroIntelligence.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure summaries and chart datasets**

Return status distribution, ABC distribution, stock-versus-sales points, no-sale buckets and idle-capital ranking. Empty datasets return empty arrays, never fabricated points.

- [ ] **Step 4: Add the management panel**

Render six compact KPI buttons above the table. Keep charts in the existing right-side analysis sheet using `ResponsiveContainer`; chart selections call `onStatusFilterChange` or `onProductSelect`.

- [ ] **Step 5: Explain status rules**

Wrap each status label in a tooltip describing the current formula. Add an `Acao recomendada` column derived from status: replenish, monitor, review excess or keep current level.

- [ ] **Step 6: Verify giro tests**

Run: `npm test -- --run src/components/operacional/estoque/giroIntelligence.test.ts src/components/operacional/estoque/GiroManagementPanel.test.tsx src/pages/operacional/EstoquePage.test.tsx`

Expected: PASS.

### Task 5: Useful Assistant And Deterministic Insights

**Files:**
- Modify: `src/components/operacional/EstoqueAssistantTab.tsx`
- Modify: `src/components/operacional/EstoqueInsights.tsx`
- Create: `src/components/operacional/estoque/assistantInsights.ts`
- Create: `src/components/operacional/estoque/assistantInsights.test.ts`
- Create: `src/components/operacional/EstoqueAssistantTab.test.tsx`

**Interfaces:**
- Produces: `StockActionInsight[]` and `buildStockActionInsights(stock, giro, now)`.
- Consumes: current AI configuration and existing assistant request path.

- [ ] **Step 1: Write failing local insight tests**

```ts
expect(buildStockActionInsights(stock, giro, NOW)).toEqual(expect.arrayContaining([
  expect.objectContaining({ kind: 'shortage-risk', productCode: 101, severity: 'critical' }),
  expect.objectContaining({ kind: 'idle-capital', productCode: 202, severity: 'warning' }),
]));
```

- [ ] **Step 2: Run assistant tests**

Run: `npm test -- --run src/components/operacional/estoque/assistantInsights.test.ts src/components/operacional/EstoqueAssistantTab.test.tsx`

Expected: FAIL because local insights and the compact interaction do not exist.

- [ ] **Step 3: Implement deterministic insight rules**

Generate only rules supported by current data: zero balance with recent sales, excess with low sales, more than 90 days without sale, and purchases without subsequent movement. Each insight includes `sourceLabel`, `periodLabel`, `reason` and `recommendedAction`.

- [ ] **Step 4: Refine chat composition**

Keep the composer visible at the bottom, show six compact suggestion buttons, processing and retry states, conversation history and the source period below assistant responses. Remove decorative empty space.

- [ ] **Step 5: Make Insights useful without AI**

Render local insights even when AI configuration is absent. AI failure leaves deterministic insights visible and displays a scoped retry message only in Chat.

- [ ] **Step 6: Verify assistant tests**

Run: `npm test -- --run src/components/operacional/estoque/assistantInsights.test.ts src/components/operacional/EstoqueAssistantTab.test.tsx`

Expected: PASS.

### Task 6: Responsive Visual Audit

**Files:**
- Modify only stock files with defects demonstrated by tests or browser checks.
- Add tests beside each corrected component.

**Interfaces:**
- Consumes: completed Central, Giro and Assistant.
- Produces: verified `/operacional/estoque` experience.

- [ ] **Step 1: Run scoped lint and tests**

Run: `npx eslint src/hooks/useEstoqueData.ts src/pages/operacional/EstoquePage.tsx src/components/operacional/estoque src/components/operacional/GiroEstoqueTab.tsx src/components/operacional/EstoqueAssistantTab.tsx src/components/operacional/EstoqueInsights.tsx`

Run: `npm test -- --run src/hooks/useEstoqueData.test.ts src/hooks/useEstoqueData.integration.test.tsx src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque`

Expected: PASS without new warnings.

- [ ] **Step 2: Run full regression and production build**

Run: `npm test -- --run`

Run: `npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Verify target widths in the browser**

At 390, 768, 1024 and 1440 pixels, inspect `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, then test search, KPI filtering, detailed mode, column persistence, drawer, giro filters, assistant suggestions and retry states.

- [ ] **Step 4: Fix only proven defects with a red test first**

For each defect, add a focused regression test, confirm it fails, apply the smallest correction and rerun the affected test plus the production build.

- [ ] **Step 5: Check the final diff**

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.

## Plan Self-Review

- Spec coverage: source health, modes, KPIs, filters, drawer, Giro, Assistant, accessibility and responsive verification are assigned to Tasks 1-6.
- Placeholder scan: nenhuma etapa pendente, vaga ou sem interface definida permanece.
- Type consistency: source metadata is produced before page consumption; giro and assistant helpers are pure and independently testable.
- Scope: external contracts remain untouched; all new calculations are presentation-layer derivations over existing records.
