# Cotacoes Abertas e Vendas Perdidas 10041 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar duas telas operacionais exclusivas do cliente `10041` para acompanhar cotacoes abertas e vendas perdidas, exportar o resultado filtrado e registrar o motivo da perda.

**Architecture:** Os dados do ERP entram por dois endpoints dedicados via `api-proxy`, sao normalizados para um contrato canonico comum e consumidos por hooks React Query. Os motivos da perda ficam em uma tabela Supabase protegida por RLS e sao combinados com as vendas perdidas no frontend. Componentes compartilhados cuidam de filtros, KPIs, tabela e exportacao sem alterar o restante do Comercial.

**Tech Stack:** React 18, TypeScript, React Router, TanStack React Query, Supabase/Postgres/RLS, shadcn/ui, Tailwind CSS, XLSX, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-25-cotacoes-vendas-perdidas-10041-design.md`

## Global Constraints

- Liberar as telas somente quando `codEmpresaAtiva === '10041'`.
- Nao derivar cotacoes a partir da base atual de movimentos faturados.
- Nao usar dados simulados em runtime.
- Nao esconder erro de integracao como lista vazia.
- Nao escrever dados no ERP; motivos ficam no Supabase.
- Nunca expor `service_role` no frontend.
- Preservar layout, rotas e funcionalidades atuais dos demais clientes.
- Usar TDD em cada tarefa: teste falha, implementacao minima, teste passa.
- Nao incluir as pastas nao relacionadas `.codex-rpa1002-push/`, `.pnpm-store/` e `tmp-auditoria-1004/` em commits.

---

## File Structure

- `src/types/cotacoesComerciais.ts`: contrato canonico, filtros, KPIs e motivos permitidos.
- `src/utils/cotacoesComerciais.ts`: normalizacao, classificacao, filtros e agregacoes puras.
- `src/utils/cotacoesComerciais.test.ts`: contrato real, regras e agregacoes.
- `src/hooks/useCotacoesComerciais.ts`: URL, requisicao e hooks React Query dos dois endpoints.
- `src/hooks/useCotacoesComerciais.test.ts`: paths, parametros, erro upstream e isolamento `10041`.
- `src/hooks/useMotivosPerda.ts`: leitura e upsert dos motivos no Supabase.
- `src/hooks/useMotivosPerda.test.ts`: validacao e payload da persistencia.
- `src/utils/cotacoesExcel.ts`: linhas tipadas e arquivo Excel das duas telas.
- `src/utils/cotacoesExcel.test.ts`: exportacao respeitando filtros e tipos.
- `src/components/comercial/cotacoes/CotacoesFilters.tsx`: filtros compartilhados.
- `src/components/comercial/cotacoes/CotacoesKpis.tsx`: KPIs compactos por modo.
- `src/components/comercial/cotacoes/CotacoesTable.tsx`: tabela responsiva compartilhada.
- `src/components/comercial/cotacoes/MotivoPerdaDialog.tsx`: cadastro e edicao do motivo.
- `src/pages/comercial/CotacoesAbertasPage.tsx`: composicao da tela de abertas.
- `src/pages/comercial/VendasPerdidasPage.tsx`: composicao da tela de perdidas.
- `src/pages/comercial/CotacoesComerciaisPages.test.tsx`: comportamento visivel das duas telas.
- `src/components/layout/ComercialSidebar.tsx`: ativacao das entradas para `10041`.
- `src/App.tsx`: imports, guarda e rotas.
- `src/hooks/useEmpresaConfig.ts`: paths configuraveis dos endpoints.
- `src/integrations/supabase/types.ts`: tipos gerados/atualizados da tabela e colunas.
- Migration path printed by `supabase migration new comercial_motivos_perda_10041`: tabela, paths configuraveis, indices, trigger e policies.

---

### Task 1: Dominio Canonico e Regras Puras

**Files:**
- Create: `src/types/cotacoesComerciais.ts`
- Create: `src/utils/cotacoesComerciais.ts`
- Test: `src/utils/cotacoesComerciais.test.ts`

**Interfaces:**
- Produces: `CotacaoComercial`, `CotacaoStatus`, `CotacoesFiltros`, `CotacoesKpis`, `MotivoPerdaCodigo`.
- Produces: `normalizarCotacao(raw, origem, hoje)`, `filtrarCotacoes(rows, filtros)` e `calcularCotacoesKpis(rows, motivos)`.

- [ ] **Step 1: Write the failing normalizer tests**

```ts
import { describe, expect, it } from 'vitest';
import { calcularCotacoesKpis, filtrarCotacoes, normalizarCotacao } from './cotacoesComerciais';

describe('normalizarCotacao', () => {
  it('normaliza uma cotacao aberta do contrato Chevrolet 10041', () => {
    const row = normalizarCotacao({
      CodCotacao: '9012', DataCotacao: '2026-08-01', DataValidade: '2026-08-15',
      CodCliente: '88', NomeCliente: 'OFICINA CENTRAL', CodVendedor: '59',
      NomeVendedor: 'ERLAN C.CH', ValorTotal: '12.345,67', Status: 'ABERTA',
    }, 'abertas', new Date('2026-08-20T12:00:00-03:00'));

    expect(row).toMatchObject({
      idCotacao: '9012', numeroCotacao: '9012', codCliente: '88',
      nomeCliente: 'OFICINA CENTRAL', codVendedor: '59', valor: 12_345.67,
      status: 'aberta', diasEmAberto: 19,
    });
  });

  it.each([
    ['CANCELADA', 'cancelada'], ['RECUSADA', 'recusada'], ['VENCIDA', 'vencida'],
  ])('classifica %s como %s', (entrada, esperado) => {
    expect(normalizarCotacao({ CodCotacao: '1', DataCotacao: '2026-08-01', Status: entrada }, 'perdidas', new Date('2026-08-20')).status).toBe(esperado);
  });
});
```

- [ ] **Step 2: Run the normalizer tests and verify RED**

Run: `npx vitest run src/utils/cotacoesComerciais.test.ts`

Expected: FAIL because the module and functions do not exist.

- [ ] **Step 3: Implement canonical types and normalization**

```ts
export type CotacaoStatus = 'aberta' | 'cancelada' | 'recusada' | 'vencida';
export type CotacaoOrigem = 'abertas' | 'perdidas';

export interface CotacaoComercial {
  idCotacao: string;
  numeroCotacao: string;
  dataCotacao: string;
  dataValidade: string | null;
  codCliente: string;
  nomeCliente: string;
  codVendedor: string;
  nomeVendedor: string;
  valor: number;
  status: CotacaoStatus;
  motivoErp: string | null;
  diasEmAberto: number;
  raw: Record<string, unknown>;
}

export type MotivoPerdaCodigo =
  | 'preco' | 'prazo_entrega' | 'condicao_pagamento' | 'concorrencia'
  | 'indisponibilidade_produto' | 'cliente_desistiu' | 'cotacao_vencida' | 'outro';
```

Implement `pick()` with normalized keys, Brazilian numeric parsing, ISO/BR date parsing, status mapping and day difference clamped to zero. For source `abertas`, accept only `aberta`; for source `perdidas`, reject records outside `cancelada | recusada | vencida` by throwing `CotacaoInvalidaError` so bad contracts are visible in tests and logs.

- [ ] **Step 4: Add failing filter and KPI tests**

```ts
it('filters by search, seller and aging without mutating rows', () => {
  const result = filtrarCotacoes(rows, {
    busca: 'oficina', vendedores: ['59'], clientes: [], status: [], motivos: [], diasMin: 10, diasMax: null,
  });
  expect(result.map((row) => row.idCotacao)).toEqual(['9012']);
  expect(rows).toHaveLength(2);
});

it('calculates totals from filtered rows', () => {
  expect(calcularCotacoesKpis(rows, new Map())).toMatchObject({
    quantidade: 2, valorTotal: 15_345.67, ticketMedio: 7_672.835,
  });
});
```

- [ ] **Step 5: Implement filters and KPIs, then verify GREEN**

Run: `npx vitest run src/utils/cotacoesComerciais.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/types/cotacoesComerciais.ts src/utils/cotacoesComerciais.ts src/utils/cotacoesComerciais.test.ts
git commit -m "feat: add dominio de cotacoes 10041"
```

---

### Task 2: Consultas dos Endpoints ERP

**Files:**
- Create: `src/hooks/useCotacoesComerciais.ts`
- Test: `src/hooks/useCotacoesComerciais.test.ts`
- Modify: `src/hooks/useEmpresaConfig.ts`

**Interfaces:**
- Consumes: `CotacaoComercial`, `CotacaoOrigem`, `normalizarCotacao`.
- Produces: `buildCotacoesPath(origem, filtros, codEmpresaBi, configuredPath)`.
- Produces: `useCotacoesAbertas(filtros)` and `useVendasPerdidas(filtros)` returning React Query state plus `data: CotacaoComercial[]`.

- [ ] **Step 1: Write failing path tests**

```ts
expect(buildCotacoesPath('abertas', { dataIni: '2026-08-01', dataFim: '2026-08-31' }, '10041')).toBe(
  '/comercial/cotacoes_abertas_ch?data_ini=2026-08-01&data_fim=2026-08-31&cod_empresa_bi=10041',
);

expect(() => buildCotacoesPath('perdidas', { dataIni: '2026-08-01', dataFim: '2026-08-31' }, '1004')).toThrow(
  'Cotacoes comerciais disponiveis somente para 10041',
);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/hooks/useCotacoesComerciais.test.ts`

Expected: FAIL because `buildCotacoesPath` does not exist.

- [ ] **Step 3: Implement paths and strict fetch**

Defaults:

```ts
const DEFAULT_PATHS = {
  abertas: '/comercial/cotacoes_abertas_ch',
  perdidas: '/comercial/vendas_perdidas_ch',
} as const;
```

`fetchCotacoes()` must call `buildApiProxyUrl`, pass the publishable key, abort after 60 seconds, and throw when `!response.ok` or `x-proxy-upstream-error === 'true'`. Parse arrays from root, `dados`, `data`, `items`, `rows` or `registros`; malformed success payload throws `Formato inesperado no endpoint de cotacoes`.

- [ ] **Step 4: Add configured path fields**

Extend `Empresa`:

```ts
endpoint_path_comercial_cotacoes_abertas_ch?: string | null;
endpoint_path_comercial_vendas_perdidas_ch?: string | null;
```

Use the configured path when non-empty, otherwise use `DEFAULT_PATHS`.

- [ ] **Step 5: Add hook tests for upstream error and aliases**

Mock only `fetch`; assert that an upstream fallback header rejects, while a valid `dados` array maps to canonical rows. Assert query keys include endpoint, period, seller, customer and `10041`.

- [ ] **Step 6: Run tests and commit Task 2**

Run: `npx vitest run src/hooks/useCotacoesComerciais.test.ts src/utils/cotacoesComerciais.test.ts`

Expected: PASS.

```bash
git add src/hooks/useCotacoesComerciais.ts src/hooks/useCotacoesComerciais.test.ts src/hooks/useEmpresaConfig.ts
git commit -m "feat: integrate cotacoes endpoints 10041"
```

---

### Task 3: Persistencia Segura dos Motivos

**Files:**
- Create via `supabase migration new comercial_motivos_perda_10041`: use exactly the migration path printed by the CLI.
- Modify after migration: `src/integrations/supabase/types.ts`
- Create: `src/hooks/useMotivosPerda.ts`
- Test: `src/hooks/useMotivosPerda.test.ts`

**Interfaces:**
- Produces: `MotivoPerdaRegistro` and `validarMotivoPerda(input)`.
- Produces: `useMotivosPerda10041(idsCotacao)` and `useSalvarMotivoPerda10041()`.

- [ ] **Step 1: Discover the installed Supabase CLI and create the migration file**

Run:

```bash
supabase --version
supabase migration new comercial_motivos_perda_10041
```

Expected: CLI prints the exact generated migration path. Do not invent the timestamp.

- [ ] **Step 2: Write migration SQL**

```sql
create table public.comercial_motivos_perda (
  id uuid primary key default gen_random_uuid(),
  cod_empresa_bi text not null check (cod_empresa_bi = '10041'),
  id_cotacao text not null,
  motivo text not null check (motivo in (
    'preco', 'prazo_entrega', 'condicao_pagamento', 'concorrencia',
    'indisponibilidade_produto', 'cliente_desistiu', 'cotacao_vencida', 'outro'
  )),
  observacao text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cod_empresa_bi, id_cotacao),
  check (motivo <> 'outro' or nullif(btrim(observacao), '') is not null)
);

alter table public.comercial_motivos_perda enable row level security;

alter table public.empresas
  add column if not exists endpoint_path_comercial_cotacoes_abertas_ch text,
  add column if not exists endpoint_path_comercial_vendas_perdidas_ch text;

create policy "Read loss reasons by company"
on public.comercial_motivos_perda for select to authenticated
using (
  public.is_master_user()
  or (
    cod_empresa_bi = public.get_user_empresa()
    and exists (
      select 1 from public.user_module_permissions ump
      where ump.user_id = (select auth.uid()) and ump.modulo_comercial
    )
  )
);

create policy "Insert loss reasons by company"
on public.comercial_motivos_perda for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.is_master_user()
    or (
      cod_empresa_bi = public.get_user_empresa()
      and exists (
        select 1 from public.user_module_permissions ump
        where ump.user_id = (select auth.uid()) and ump.modulo_comercial
      )
    )
  )
);

create policy "Update loss reasons by company"
on public.comercial_motivos_perda for update to authenticated
using (
  public.is_master_user()
  or (
    cod_empresa_bi = public.get_user_empresa()
    and exists (
      select 1 from public.user_module_permissions ump
      where ump.user_id = (select auth.uid()) and ump.modulo_comercial
    )
  )
)
with check (
  public.is_master_user()
  or (
    cod_empresa_bi = public.get_user_empresa()
    and exists (
      select 1 from public.user_module_permissions ump
      where ump.user_id = (select auth.uid()) and ump.modulo_comercial
    )
  )
);
```

Add an `updated_at` trigger using the project's existing `update_updated_at_column()` function. Add a `before update` trigger function that copies `old.created_by` and `old.created_at` into `new`, so an upsert cannot rewrite creation metadata.

- [ ] **Step 3: Write failing validation and payload tests**

```ts
expect(validarMotivoPerda({ motivo: 'outro', observacao: '  ' })).toEqual({
  valido: false, erro: 'Informe a observacao para o motivo Outro.',
});

expect(buildMotivoPerdaUpsert('9012', { motivo: 'preco', observacao: '' }, 'user-1')).toEqual({
  cod_empresa_bi: '10041', id_cotacao: '9012', motivo: 'preco', observacao: null, created_by: 'user-1',
});
```

- [ ] **Step 4: Implement hook and update generated types**

Read reasons with `.eq('cod_empresa_bi', '10041').in('id_cotacao', ids)` only when authenticated and IDs are non-empty. Save with `.upsert(payload, { onConflict: 'cod_empresa_bi,id_cotacao' })`, invalidate `['comercial-motivos-perda', '10041']`, and surface Supabase errors to the dialog.

- [ ] **Step 5: Verify migration safely**

Use Supabase MCP/CLI read-only checks where available. Apply schema through the approved deployment path, then run security and performance advisors. If production credentials are unavailable, commit the migration and report database deployment as an explicit blocker rather than bypassing it.

- [ ] **Step 6: Run tests and commit Task 3**

Run: `npx vitest run src/hooks/useMotivosPerda.test.ts`

Expected: PASS.

```bash
git add supabase/migrations src/integrations/supabase/types.ts src/hooks/useMotivosPerda.ts src/hooks/useMotivosPerda.test.ts
git commit -m "feat: persist loss reasons for 10041"
```

---

### Task 4: Exportacao Excel

**Files:**
- Create: `src/utils/cotacoesExcel.ts`
- Test: `src/utils/cotacoesExcel.test.ts`

**Interfaces:**
- Consumes: canonical rows and optional `Map<string, MotivoPerdaRegistro>`.
- Produces: `buildCotacoesExcelRows(mode, rows, motivos)` and `exportCotacoesExcel(input)`.

- [ ] **Step 1: Write failing export row tests**

```ts
const result = buildCotacoesExcelRows('perdidas', [row], new Map([
  ['9012', { motivo: 'preco', observacao: null }],
]));

expect(result).toEqual([{
  Cotacao: '9012', Data: expect.any(Date), Cliente: 'OFICINA CENTRAL',
  Vendedor: 'ERLAN C.CH', Valor: 12_345.67, Status: 'Cancelada',
  'Motivo da perda': 'Preco', Observacao: '',
}]);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/utils/cotacoesExcel.test.ts`

Expected: FAIL because the exporter does not exist.

- [ ] **Step 3: Implement rows and workbook**

Use `XLSX.utils.json_to_sheet`, set currency cells to numeric format `R$ #,##0.00`, date cells to `dd/mm/yyyy`, apply readable column widths and call `XLSX.writeFile`. Filenames:

- `10041-cotacoes-abertas-YYYY-MM-DD-YYYY-MM-DD.xlsx`
- `10041-vendas-perdidas-YYYY-MM-DD-YYYY-MM-DD.xlsx`

- [ ] **Step 4: Verify and commit Task 4**

Run: `npx vitest run src/utils/cotacoesExcel.test.ts`

Expected: PASS with XLSX boundary mocked and row generation real.

```bash
git add src/utils/cotacoesExcel.ts src/utils/cotacoesExcel.test.ts
git commit -m "feat: export cotacoes 10041 to excel"
```

---

### Task 5: Shared Operational Components

**Files:**
- Create: `src/components/comercial/cotacoes/CotacoesFilters.tsx`
- Create: `src/components/comercial/cotacoes/CotacoesKpis.tsx`
- Create: `src/components/comercial/cotacoes/CotacoesTable.tsx`
- Test through: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`

**Interfaces:**
- `CotacoesFilters` receives pending filters, seller/customer/motive options, and `onApply`/`onClear`.
- `CotacoesKpis` receives `mode`, `kpis` and renders four stable KPI cells.
- `CotacoesTable` receives `mode`, rows, motives and optional `onEditMotivo`.

- [ ] **Step 1: Write failing component behavior tests**

Render the components with two rows and assert:

```ts
expect(screen.getByRole('columnheader', { name: 'Cotacao' })).toBeInTheDocument();
expect(screen.getByText('OFICINA CENTRAL')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /registrar motivo/i })).toBeInTheDocument();
expect(screen.queryByText(/raw/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run page/component tests and verify RED**

Run: `npx vitest run src/pages/comercial/CotacoesComerciaisPages.test.tsx`

Expected: FAIL because shared components do not exist.

- [ ] **Step 3: Implement filters and KPIs**

Use compact inputs and popovers matching existing Commercial controls. Numeric aging inputs are constrained to zero or greater. `Aplicar` copies pending filters to applied filters; changing a pending control alone must not refetch.

- [ ] **Step 4: Implement responsive table**

Desktop uses a dense table with sticky header and horizontal overflow. Mobile uses one repeated item card per quote, not cards nested inside page cards. Keep stable min widths, tabular numbers, status badges and accessible labels on icon buttons.

- [ ] **Step 5: Verify and commit Task 5**

Run: `npx vitest run src/pages/comercial/CotacoesComerciaisPages.test.tsx`

Expected: shared component tests PASS.

```bash
git add src/components/comercial/cotacoes src/pages/comercial/CotacoesComerciaisPages.test.tsx
git commit -m "feat: add shared quotes components"
```

---

### Task 6: Cotacoes Abertas Page, Route and Menu

**Files:**
- Create: `src/pages/comercial/CotacoesAbertasPage.tsx`
- Modify: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`
- Modify: `src/components/layout/ComercialSidebar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useCotacoesAbertas`, filtering/KPI utilities, shared components and Excel exporter.
- Produces: guarded `/comercial/cotacoes` route.

- [ ] **Step 1: Write failing page and access tests**

Mock the hook boundary with canonical rows. Assert title, KPIs, filter application, visible export button, disabled export for empty results, loading skeleton, no-results text and endpoint error with `Tentar novamente`.

Export `getComercialMenuItems` for a pure test:

```ts
expect(getComercialMenuItems('10041').map((item) => item.path)).toContain('/comercial/cotacoes');
expect(getComercialMenuItems('1004').map((item) => item.path)).not.toContain('/comercial/cotacoes');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/layout/ComercialSidebar.test.ts`

Expected: FAIL because page, route and menu entry are absent.

- [ ] **Step 3: Implement the page**

Default period is current month through today. Initial applied filters trigger the first query. Filter locally for search/aging and send period/seller/customer to the endpoint. Export exactly `filteredRows`.

- [ ] **Step 4: Add the 10041 guard and route**

Add `RequireEmpresa10041` beside existing route guards in `src/App.tsx`; it renders children only when active company is exactly `10041`, otherwise redirects to `/comercial/dashboard`. Add the page import and route.

- [ ] **Step 5: Move the menu entry out of Em breve only for 10041**

Add `Clock` to active items for `10041`. Keep `futureMenuItems` visible only when the active company is not `10041`, so other clients retain the current screenshot behavior.

- [ ] **Step 6: Verify and commit Task 6**

Run: `npx vitest run src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/layout/ComercialSidebar.test.ts`

Expected: PASS.

```bash
git add src/pages/comercial/CotacoesAbertasPage.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/layout/ComercialSidebar.tsx src/components/layout/ComercialSidebar.test.ts src/App.tsx
git commit -m "feat: activate open quotes page 10041"
```

---

### Task 7: Vendas Perdidas and Motivo Dialog

**Files:**
- Create: `src/components/comercial/cotacoes/MotivoPerdaDialog.tsx`
- Create: `src/pages/comercial/VendasPerdidasPage.tsx`
- Modify: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`
- Modify: `src/components/layout/ComercialSidebar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useVendasPerdidas`, `useMotivosPerda10041`, `useSalvarMotivoPerda10041`, shared components and Excel exporter.
- Produces: guarded `/comercial/perdidas` route and motive CRUD UI.

- [ ] **Step 1: Write failing dialog tests**

Assert the motive options, save payload, preservation after save error, edit preload, and mandatory observation for `outro`:

```ts
fireEvent.click(screen.getByRole('option', { name: 'Outro' }));
fireEvent.click(screen.getByRole('button', { name: 'Salvar motivo' }));
expect(screen.getByText('Informe a observacao para o motivo Outro.')).toBeInTheDocument();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/pages/comercial/CotacoesComerciaisPages.test.tsx`

Expected: FAIL because dialog and lost-sales page are absent.

- [ ] **Step 3: Implement motive dialog**

Use a Select for the fixed reason set, Textarea for observation, mutation loading state, inline error, success toast and close only after confirmed save. Use `Pencil` for edit and `MessageSquarePlus` for first registration with tooltips.

- [ ] **Step 4: Implement lost-sales page**

Join reasons by `idCotacao`, calculate `motivoMaisFrequente` from the filtered rows, and export the joined motive. Include status and reason filters. `Tentar novamente` refetches both ERP rows and reasons.

- [ ] **Step 5: Activate route and menu**

Add guarded `/comercial/perdidas` route and active `XCircle` menu item for `10041`. Keep the disabled `BREVE` item for other companies.

- [ ] **Step 6: Verify and commit Task 7**

Run: `npx vitest run src/pages/comercial/CotacoesComerciaisPages.test.tsx src/hooks/useMotivosPerda.test.ts src/components/layout/ComercialSidebar.test.ts`

Expected: PASS.

```bash
git add src/components/comercial/cotacoes/MotivoPerdaDialog.tsx src/pages/comercial/VendasPerdidasPage.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/layout/ComercialSidebar.tsx src/App.tsx
git commit -m "feat: activate lost sales page 10041"
```

---

### Task 8: Integration Verification and Delivery

**Files:**
- Modify only files required by failures directly caused by Tasks 1-7.
- Do not fix unrelated pre-existing tests in the same commit.

**Interfaces:**
- Verifies all earlier task outputs together.

- [ ] **Step 1: Run focused feature suite**

```bash
npx vitest run \
  src/utils/cotacoesComerciais.test.ts \
  src/hooks/useCotacoesComerciais.test.ts \
  src/hooks/useMotivosPerda.test.ts \
  src/utils/cotacoesExcel.test.ts \
  src/pages/comercial/CotacoesComerciaisPages.test.tsx \
  src/components/layout/ComercialSidebar.test.ts
```

Expected: all feature tests PASS with zero failures.

- [ ] **Step 2: Run full test suite and production build**

```bash
npx vitest run
npm run build
```

Expected: build exit code `0`. Record pre-existing unrelated failures separately; investigate any new failure touching modified behavior.

- [ ] **Step 3: Verify real endpoint contracts**

Call both paths through the same proxy flow with `cod_empresa_bi=10041` and the current month. Record HTTP status, row count and field names without exposing commercial values. If either endpoint is absent, leave the UI's explicit integration error active and report the external dependency.

- [ ] **Step 4: Verify Supabase security**

Confirm migration applied, RLS enabled, authenticated `10041` user can read/write its reasons, a non-`10041` user cannot, and master access matches current project policy. Run Supabase security and performance advisors and review new findings.

- [ ] **Step 5: Start dev server and verify UI**

Run `npm run dev -- --host 127.0.0.1` on a free port. Check desktop at `1440x900` and mobile at `390x844`: no overlap, no clipped values, filters usable, table/cards scroll correctly, dialogs fit viewport, and export/motive buttons have accessible names.

- [ ] **Step 6: Review diff and commit verification fixes**

```bash
git diff --check
git status --short
git diff --stat
```

Commit only if verification required a feature-scoped correction:

Stage only the exact feature files changed during verification, list them with `git diff --name-only`, and commit with `git commit -m "fix: validate quotes workflow 10041"`.

- [ ] **Step 7: Push main after user-approved execution**

```bash
git push origin main
```

Expected: `main` and `origin/main` point to the same final commit.
