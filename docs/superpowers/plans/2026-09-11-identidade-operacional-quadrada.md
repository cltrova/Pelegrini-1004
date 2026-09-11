# Identidade Visual Quadrada do Operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar ao módulo Operacional uma identidade visual mais quadrada, técnica e fluida, preservando integralmente cores, dados, rotas e regras de negócio.

**Architecture:** O `PelegriniModuleShell` exporá um identificador no elemento raiz e o Operacional ativará uma variante indexada da sidebar. Uma folha de estilos carregada após `index.css` conterá somente seletores sob `[data-module-shell='operacional']`; classes semânticas nos componentes de estoque darão estabilidade aos layouts e permitirão estilizar também os overlays renderizados em portal.

**Tech Stack:** React 18, TypeScript 5.8, Tailwind CSS 3.4, Radix UI, Recharts, Vitest, Testing Library e Vite.

**Spec:** `docs/superpowers/specs/2026-09-11-identidade-operacional-quadrada-design.md`

## Global Constraints

- Alterar apenas Sidebar Operacional, Estoque, Estoque Retroativo e Evolução de Distribuidores.
- Preservar as cores atuais das filiais e os modos claro e escuro.
- Painéis, cartões funcionais, tabelas e seções enquadradas usarão raio de `2px`.
- Botões, campos, menus, popovers, diálogos e drawers usarão raio máximo de `4px`.
- Badges semânticos, indicadores circulares, avatares e pontos de legenda podem permanecer arredondados.
- Remover blur, glassmorphism, brilhos, halos, gradientes decorativos e sombras profundas somente no Operacional.
- Transições de cor e opacidade terão duração entre `120ms` e `180ms`; a sidebar poderá abrir visualmente em até `220ms` sem deslocar o conteúdo.
- Hover não pode alterar dimensões, padding, borda ou fluxo do documento.
- Atualizações de filtros e dados devem preservar o conteúdo anterior ou espaço equivalente.
- Respeitar `prefers-reduced-motion` e não introduzir nova biblioteca.
- Não alterar consultas, hooks, endpoints, cálculos, rotas, permissões ou textos funcionais.
- Não incluir `.tmp-produtos-red.json` nem alterações preexistentes não relacionadas em commits desta execução.

---

### Task 1: Criar o escopo visual exclusivo do Operacional

**Files:**
- Modify: `src/components/pelegrini/PelegriniModuleShell.tsx`
- Modify: `src/components/pelegrini/PelegriniVisuals.test.tsx`
- Modify: `src/main.tsx`
- Create: `src/styles/operacional-square.css`
- Create: `src/styles/operacional-square.test.ts`

**Interfaces:**
- Consumes: `PelegriniModuleKey` e a prop existente `moduleKey` de `PelegriniModuleShell`.
- Produces: atributo raiz `data-module-shell: PelegriniModuleKey`, classe raiz `pelegrini-module-shell` e folha carregada depois de `index.css`.

- [ ] **Step 1: Escrever os testes de isolamento que falham**

Em `PelegriniVisuals.test.tsx`, acrescente ao teste do shell:

```tsx
expect(screen.getByTestId('pelegrini-module-shell')).toHaveAttribute(
  'data-module-shell',
  'operacional',
);
```

Renderize o shell desse teste com `moduleKey="operacional"`. Em `operacional-square.test.ts`, valide o contrato da folha:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('operational square visual scope', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/operacional-square.css'), 'utf8');

  it('scopes structural rules to the operational shell', () => {
    expect(css).toContain("[data-module-shell='operacional']");
    expect(css).not.toMatch(/^\s*\.(?:rounded|bg-card|premium-card)\b/m);
  });

  it('defines stable radii and reduced motion', () => {
    expect(css).toContain('--operational-panel-radius: 2px');
    expect(css).toContain('--operational-control-radius: 4px');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
```

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx src/styles/operacional-square.test.ts --run`

Expected: FAIL porque o shell ainda não possui `data-testid="pelegrini-module-shell"`, `data-module-shell` nem a nova folha.

- [ ] **Step 3: Expor o identificador e criar a base da folha**

No elemento raiz de `PelegriniModuleShell`, adicione:

```tsx
data-testid="pelegrini-module-shell"
data-module-shell={moduleKey}
```

Em `main.tsx`, mantenha a ordem:

```ts
import './index.css';
import './styles/operacional-square.css';
```

Inicie `operacional-square.css` com:

```css
[data-module-shell='operacional'] {
  --operational-panel-radius: 2px;
  --operational-control-radius: 4px;
  --operational-motion-fast: 150ms;
  --operational-motion-sidebar: 220ms;
}

[data-module-shell='operacional'] .pelegrini-page-surface {
  background: hsl(var(--background));
}

[data-module-shell='operacional'] .pelegrini-surface-pattern {
  display: none;
}

[data-module-shell='operacional'] * {
  letter-spacing: 0;
}

@media (prefers-reduced-motion: reduce) {
  [data-module-shell='operacional'] *,
  [data-module-shell='operacional'] *::before,
  [data-module-shell='operacional'] *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 4: Executar os testes do escopo**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx src/styles/operacional-square.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commitar somente o escopo visual**

```bash
git add src/components/pelegrini/PelegriniModuleShell.tsx src/components/pelegrini/PelegriniVisuals.test.tsx src/main.tsx src/styles/operacional-square.css src/styles/operacional-square.test.ts
git commit -m "feat: scope square visual identity to operational"
```

---

### Task 2: Converter a sidebar Operacional sem alterar as outras sidebars

**Files:**
- Modify: `src/components/pelegrini/PelegriniModuleSidebar.tsx`
- Modify: `src/components/pelegrini/PelegriniModuleSidebar.test.tsx`
- Modify: `src/components/layout/OperacionalSidebar.tsx`
- Modify: `src/components/layout/OperacionalSidebar.test.ts`
- Modify: `src/styles/operacional-square.css`

**Interfaces:**
- Consumes: `PelegriniSidebarItem[]` e o escopo `data-module-shell='operacional'` da Task 1.
- Produces: prop opcional `indexed?: boolean`, índice visual `sidebar-item-index` e atributo `data-navigation-style='indexed'`.

- [ ] **Step 1: Escrever testes para numeração e isolamento**

Atualize o helper de `PelegriniModuleSidebar.test.tsx` para aceitar `indexed` e adicione:

```tsx
it('numbers links only when indexed navigation is requested', () => {
  renderSidebar({ indexed: true });

  expect(screen.getByTestId('module-sidebar')).toHaveAttribute('data-navigation-style', 'indexed');
  expect(screen.getByText('01')).toHaveClass('sidebar-item-index');
  expect(screen.getByText('02')).toHaveClass('sidebar-item-index');
});
```

Em `OperacionalSidebar.test.ts`, valide:

```ts
expect(source).toContain('indexed');
```

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/components/pelegrini/PelegriniModuleSidebar.test.tsx src/components/layout/OperacionalSidebar.test.ts --run`

Expected: FAIL porque a prop e os índices ainda não existem.

- [ ] **Step 3: Implementar a variante indexada**

Adicione `indexed?: boolean` às props, passe `index` no `items.map` e renderize dentro de `SidebarLink`:

```tsx
{indexed && (
  <span aria-hidden="true" className="sidebar-item-index">
    {String(index + 1).padStart(2, '0')}
  </span>
)}
```

No `aside`:

```tsx
data-navigation-style={indexed ? 'indexed' : 'default'}
```

Em `OperacionalSidebar.tsx`:

```tsx
<PelegriniModuleSidebar
  indexed
  theme={theme}
  items={items}
  mobileOpen={isMobileOpen}
  onMobileOpenChange={setIsMobileOpen}
/>
```

- [ ] **Step 4: Aplicar a geometria e o movimento da sidebar**

Acrescente regras específicas:

```css
[data-module-shell='operacional'] .pelegrini-sidebar {
  background: hsl(var(--sidebar-background));
  box-shadow: none;
  border-right: 1px solid hsl(var(--sidebar-border));
}

[data-module-shell='operacional'] .sidebar-action {
  border-radius: 2px;
  transition: color 150ms ease, background-color 150ms ease;
}

[data-module-shell='operacional'] .sidebar-item-active {
  background: hsl(var(--sidebar-accent)) !important;
  box-shadow: inset 3px 0 0 var(--pelegrini-accent);
}

[data-module-shell='operacional'] .sidebar-item-index {
  width: 1.5rem;
  flex: 0 0 1.5rem;
  color: hsl(var(--sidebar-muted));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 768px) {
  [data-module-shell='operacional'] .pelegrini-sidebar-collapsible {
    transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: none;
  }

  [data-module-shell='operacional'] .pelegrini-sidebar-collapsible:hover,
  [data-module-shell='operacional'] .pelegrini-sidebar-collapsible:focus-within {
    box-shadow: none;
  }

  [data-module-shell='operacional'] .pelegrini-sidebar-collapsible:not(:hover):not(:focus-within) .sidebar-item-index {
    display: none;
  }
}
```

Não altere as larguras existentes de `72px` e `248px`; o conteúdo principal continuará reservado em `72px`.

- [ ] **Step 5: Executar os testes de sidebar**

Run: `npm test -- src/components/pelegrini/PelegriniModuleSidebar.test.tsx src/components/layout/OperacionalSidebar.test.ts src/components/layout/ComercialSidebar.test.ts src/components/layout/FinanceiroSidebar.test.tsx --run`

Expected: PASS, incluindo a proteção das sidebars Comercial e Financeiro.

- [ ] **Step 6: Commitar a sidebar**

```bash
git add src/components/pelegrini/PelegriniModuleSidebar.tsx src/components/pelegrini/PelegriniModuleSidebar.test.tsx src/components/layout/OperacionalSidebar.tsx src/components/layout/OperacionalSidebar.test.ts src/styles/operacional-square.css
git commit -m "feat: square operational sidebar navigation"
```

---

### Task 3: Criar primitivas quadradas e estáveis para o Estoque

**Files:**
- Modify: `src/components/operacional/estoque/EstoqueWorkspace.tsx`
- Modify: `src/components/operacional/estoque/EstoqueWorkspace.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueMetricStrip.tsx`
- Modify: `src/components/operacional/estoque/EstoqueMetricStrip.test.tsx`
- Modify: `src/styles/operacional-square.css`

**Interfaces:**
- Consumes: os quatro wrappers atuais de `EstoqueWorkspace.tsx`.
- Produces: classes semânticas `operational-workspace`, `operational-workspace-header`, `operational-toolbar`, `operational-data-viewport` e `operational-metric-strip`.

- [ ] **Step 1: Escrever testes das classes estruturais**

Em `EstoqueWorkspace.test.tsx`, renderize cada wrapper e valide:

```tsx
expect(screen.getByRole('region', { name: 'Mesa operacional de estoque' }))
  .toHaveClass('operational-workspace');
expect(screen.getByRole('banner', { name: 'Navegacao do estoque' }))
  .toHaveClass('operational-workspace-header');
expect(screen.getByRole('toolbar', { name: 'Comandos do estoque' }))
  .toHaveClass('operational-toolbar');
expect(screen.getByRole('region', { name: 'Dados do estoque' }))
  .toHaveClass('operational-data-viewport');
```

No teste da faixa de métricas, valide `operational-metric-strip` no elemento raiz.

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx --run`

Expected: FAIL pelas classes ausentes.

- [ ] **Step 3: Adicionar as classes sem alterar as props existentes**

Acrescente cada classe ao primeiro argumento de `cn`, por exemplo:

```tsx
className={cn(
  'operational-workspace flex h-[calc(100dvh-var(--estoque-shell-offset,0px))] min-h-0 min-w-0 flex-col overflow-hidden',
  className,
)}
```

Use o mesmo padrão nos outros três wrappers e na raiz de `EstoqueMetricStrip`.

- [ ] **Step 4: Definir a fundação visual e de estabilidade**

```css
[data-module-shell='operacional'] :where(
  .operational-workspace-header,
  .operational-toolbar,
  .operational-data-viewport,
  .operational-metric-strip,
  .pelegrini-data-panel,
  .pelegrini-kpi-card,
  .pelegrini-chart-frame,
  .bg-card
) {
  border-radius: var(--operational-panel-radius) !important;
  box-shadow: none !important;
  background-image: none !important;
}

[data-module-shell='operacional'] :where(.rounded-md, .rounded-lg, .rounded-xl, .rounded-2xl) {
  border-radius: var(--operational-panel-radius) !important;
}

[data-module-shell='operacional'] :where(button, input, select, textarea, [role='combobox'], [role='tab']) {
  border-radius: var(--operational-control-radius) !important;
}

[data-module-shell='operacional'] :where(button, [role='button'], [role='tab']) {
  transition-property: color, background-color, border-color, opacity;
  transition-duration: var(--operational-motion-fast);
}

[data-module-shell='operacional'] :where(.premium-card, .premium-hover-card, .dashboard-header-card):hover {
  transform: none !important;
  box-shadow: none !important;
}
```

Não inclua `.rounded-full` nesses seletores.

- [ ] **Step 5: Executar os testes das primitivas**

Run: `npm test -- src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx src/styles/operacional-square.test.ts --run`

Expected: PASS.

- [ ] **Step 6: Commitar as primitivas**

```bash
git add src/components/operacional/estoque/EstoqueWorkspace.tsx src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx src/styles/operacional-square.css
git commit -m "feat: add stable operational workspace primitives"
```

---

### Task 4: Aplicar a identidade à Visão Geral e Central de Estoque

**Files:**
- Modify: `src/components/operacional/estoque/EstoqueOverview.tsx`
- Modify: `src/components/operacional/estoque/EstoqueOverview.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueCommandCenter.tsx`
- Modify: `src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueSummaryCards.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductsTable.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductsTable.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueSmartFilters.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductDrawer.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductDrawer.test.tsx`
- Modify: `src/pages/operacional/EstoquePage.tsx`
- Modify: `src/pages/operacional/EstoquePage.test.tsx`
- Modify: `src/styles/operacional-square.css`

**Interfaces:**
- Consumes: classes estruturais da Task 3 e dados atuais de `EstoquePage`.
- Produces: classes `operational-panel`, `operational-kpi-grid`, `operational-filter-control`, `operational-table-frame` e `operational-overlay`.

- [ ] **Step 1: Escrever testes de composição e overlays**

Nos testes existentes, valide os novos hooks sem testar detalhes de cor:

```tsx
expect(screen.getByRole('region', { name: 'Visão geral do estoque' }))
  .toHaveClass('operational-dashboard');
expect(screen.getByRole('region', { name: 'Central de estoque' }))
  .toHaveClass('operational-command-center');
expect(screen.getByRole('table')).toHaveClass('operational-stock-table');
```

Abra o filtro, o drawer e o seletor de colunas nos testes correspondentes e valide que o conteúdo portado possui `operational-overlay`.

- [ ] **Step 2: Executar os testes focados e confirmar a falha**

Run: `npm test -- src/components/operacional/estoque/EstoqueOverview.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx src/components/operacional/estoque/EstoqueProductDrawer.test.tsx --run`

Expected: FAIL pelos novos hooks ausentes.

- [ ] **Step 3: Marcar as superfícies estruturais**

Faça estas alterações sem mudar estado ou cálculos:

```tsx
// EstoqueOverview
<div
  aria-label="Visão geral do estoque"
  className="operational-dashboard flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
>
<section className={cn(
  'operational-panel flex h-auto min-h-0 min-w-0 flex-col overflow-hidden border border-border/70 bg-card/60 p-2.5',
  className,
)}>
<div className="operational-kpi-grid grid shrink-0 grid-cols-2 gap-px border-b border-border/60 bg-border/60 sm:grid-cols-4 lg:grid-cols-8">

// EstoqueCommandCenter
<section
  aria-label="Central de estoque"
  className="operational-command-center estoque-manager-view flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden"
>

// EstoqueProductsTable
<section
  aria-label="Produtos do estoque"
  className="operational-table-frame estoque-products-table flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden border border-border/70 bg-background"
>
<table className="operational-stock-table w-full caption-bottom text-sm">
```

Adicione `operational-filter-control` aos containers de filtro e `operational-overlay` a `DialogContent`, `SheetContent`, conteúdos de popover e drawer dessa entrega.

- [ ] **Step 4: Aplicar o layout contínuo e compacto**

```css
[data-module-shell='operacional'] .operational-dashboard,
[data-module-shell='operacional'] .operational-command-center {
  background: hsl(var(--background));
}

[data-module-shell='operacional'] .operational-panel,
[data-module-shell='operacional'] .operational-table-frame {
  border: 1px solid hsl(var(--border));
  border-radius: 2px;
  background: hsl(var(--card));
  box-shadow: none;
}

[data-module-shell='operacional'] .operational-kpi-grid {
  gap: 1px;
  background: hsl(var(--border));
}

[data-module-shell='operacional'] .operational-kpi-grid > * {
  min-width: 0;
  border: 0;
  border-radius: 0 !important;
  background: hsl(var(--card)) !important;
}

[data-module-shell='operacional'] .operational-stock-table :where(th, td) {
  height: 2rem;
  border-bottom: 1px solid hsl(var(--border) / 0.7);
}

.operational-overlay {
  border-radius: 4px !important;
  background: hsl(var(--popover)) !important;
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.16) !important;
  backdrop-filter: none !important;
}
```

O seletor `.operational-overlay` é intencionalmente uma classe explícita porque Radix renderiza overlays fora do shell.

- [ ] **Step 5: Preservar espaço durante atualização**

Mantenha os dados anteriores montados quando `isFetching` for verdadeiro. O spinner deve aparecer apenas dentro do botão de atualização; `LoadingState` de página inteira permanece exclusivo para a carga inicial sem dados. Cubra em `EstoquePage.test.tsx`:

```tsx
expect(screen.getByText('Produto preservado')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Atualizando dados do estoque' }))
  .toBeDisabled();
```

- [ ] **Step 6: Executar a suíte da Visão Geral e Central**

Run: `npm test -- src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueOverview.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx src/components/operacional/estoque/EstoqueProductDrawer.test.tsx --run`

Expected: PASS.

- [ ] **Step 7: Commitar Visão Geral e Central**

```bash
git add src/pages/operacional/EstoquePage.tsx src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueOverview.tsx src/components/operacional/estoque/EstoqueOverview.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueSummaryCards.tsx src/components/operacional/estoque/EstoqueProductsTable.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx src/components/operacional/estoque/EstoqueSmartFilters.tsx src/components/operacional/estoque/EstoqueProductDrawer.tsx src/components/operacional/estoque/EstoqueProductDrawer.test.tsx src/styles/operacional-square.css
git commit -m "feat: square stock overview and central workspace"
```

---

### Task 5: Aplicar a identidade ao Giro e Assistente

**Files:**
- Modify: `src/components/operacional/GiroEstoqueTab.tsx`
- Modify: `src/components/operacional/GiroEstoqueTab.test.tsx`
- Modify: `src/components/operacional/EstoqueAssistantTab.tsx`
- Modify: `src/components/operacional/EstoqueAssistantTab.test.tsx`
- Modify: `src/components/operacional/estoque/GiroFilterPopover.tsx`
- Modify: `src/components/operacional/estoque/GiroFilterPopover.test.tsx`
- Modify: `src/components/operacional/estoque/GiroManagementPanel.tsx`
- Modify: `src/components/operacional/estoque/GiroManagementPanel.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueAttentionPanel.tsx`
- Modify: `src/components/operacional/estoque/EstoqueMovementHighlights.tsx`
- Modify: `src/components/operacional/estoque/EstoqueMovementTimeline.tsx`
- Modify: `src/styles/operacional-square.css`

**Interfaces:**
- Consumes: `operational-panel` e `operational-overlay` da Task 4.
- Produces: classes `operational-giro`, `operational-assistant`, `operational-action-row` e filtros portados com a geometria correta.

- [ ] **Step 1: Escrever testes dos novos pontos de estilo**

Nos testes das abas, valide:

```tsx
expect(screen.getByRole('region', { name: /giro de estoque/i }))
  .toHaveClass('operational-giro');
expect(screen.getByRole('region', { name: /assistente de estoque/i }))
  .toHaveClass('operational-assistant');
```

No teste do popover, abra o filtro e valide `operational-overlay` no painel visível.

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/components/operacional/GiroEstoqueTab.test.tsx src/components/operacional/EstoqueAssistantTab.test.tsx src/components/operacional/estoque/GiroFilterPopover.test.tsx src/components/operacional/estoque/GiroManagementPanel.test.tsx --run`

Expected: FAIL pelas classes ausentes.

- [ ] **Step 3: Adicionar classes e retirar movimento decorativo**

Marque as raízes das abas e painéis com as classes produzidas. Substitua o movimento da seta em `EstoqueMovementHighlights`:

```tsx
<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
```

Mantenha `animate-spin` apenas nos indicadores de consulta em andamento e acrescente `motion-reduce:animate-none` a eles.

- [ ] **Step 4: Achatar painéis e manter os indicadores semânticos**

```css
[data-module-shell='operacional'] :where(.operational-giro, .operational-assistant) .operational-panel {
  border-radius: 2px;
  box-shadow: none;
  background-image: none;
}

[data-module-shell='operacional'] .operational-action-row {
  min-height: 2.75rem;
  border-bottom: 1px solid hsl(var(--border) / 0.7);
  transition: background-color 150ms ease;
}

[data-module-shell='operacional'] .operational-action-row:hover {
  background: hsl(var(--muted) / 0.35);
}
```

Não altere os pontos de status `rounded-full`, pois comunicam severidade.

- [ ] **Step 5: Executar os testes do Giro e Assistente**

Run: `npm test -- src/components/operacional/GiroEstoqueTab.test.tsx src/components/operacional/EstoqueAssistantTab.test.tsx src/components/operacional/estoque/GiroFilterPopover.test.tsx src/components/operacional/estoque/GiroManagementPanel.test.tsx --run`

Expected: PASS.

- [ ] **Step 6: Commitar Giro e Assistente**

```bash
git add src/components/operacional/GiroEstoqueTab.tsx src/components/operacional/GiroEstoqueTab.test.tsx src/components/operacional/EstoqueAssistantTab.tsx src/components/operacional/EstoqueAssistantTab.test.tsx src/components/operacional/estoque/GiroFilterPopover.tsx src/components/operacional/estoque/GiroFilterPopover.test.tsx src/components/operacional/estoque/GiroManagementPanel.tsx src/components/operacional/estoque/GiroManagementPanel.test.tsx src/components/operacional/estoque/EstoqueAttentionPanel.tsx src/components/operacional/estoque/EstoqueMovementHighlights.tsx src/components/operacional/estoque/EstoqueMovementTimeline.tsx src/styles/operacional-square.css
git commit -m "feat: square giro and stock assistant views"
```

---

### Task 6: Aplicar a identidade ao Estoque Retroativo e Distribuidores

**Files:**
- Modify: `src/pages/operacional/EstoqueRetroativoPage.tsx`
- Modify: `src/pages/operacional/EstoqueRetroativoPage.test.tsx`
- Modify: `src/pages/operacional/DistribuidoresPage.tsx`
- Modify: `src/pages/operacional/DistribuidoresPage.test.tsx`
- Modify: `src/components/operacional/estoque/DistributorEvolutionTab.tsx`
- Modify: `src/components/operacional/estoque/DistributorEvolutionTab.test.tsx`
- Modify: `src/styles/operacional-square.css`

**Interfaces:**
- Consumes: wrappers da Task 3 e `operational-panel`/`operational-overlay` da Task 4.
- Produces: `operational-retroactive`, `operational-distributors`, `operational-comparison-matrix` e `operational-chart-panel`.

- [ ] **Step 1: Escrever testes de estrutura responsiva**

Adicione aos testes das páginas:

```tsx
expect(screen.getByRole('region', { name: /estoque retroativo/i }))
  .toHaveClass('operational-retroactive');
expect(screen.getByRole('region', { name: /evolução de distribuidores/i }))
  .toHaveClass('operational-distributors');
```

No teste de `DistributorEvolutionTab`, valide que a matriz possui `operational-comparison-matrix` e o gráfico possui `operational-chart-panel`.

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/pages/operacional/EstoqueRetroativoPage.test.tsx src/pages/operacional/DistribuidoresPage.test.tsx src/components/operacional/estoque/DistributorEvolutionTab.test.tsx --run`

Expected: FAIL pelos hooks estruturais ausentes.

- [ ] **Step 3: Marcar páginas, tabela e gráfico**

Use os wrappers existentes:

```tsx
<EstoqueWorkspace aria-label="Estoque retroativo" className="operational-retroactive bg-background">
<EstoqueWorkspace aria-label="Evolução de distribuidores" className="operational-distributors bg-background">
```

Adicione `operational-comparison-matrix` ao container da tabela mensal, `operational-chart-panel operational-panel` ao gráfico de vendas x compras e `operational-overlay` ao painel de filtros e ao drawer de detalhes.

- [ ] **Step 4: Completar responsividade das duas telas**

```css
[data-module-shell='operacional'] :where(.operational-retroactive, .operational-distributors) {
  background: hsl(var(--background));
}

[data-module-shell='operacional'] .operational-comparison-matrix {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

[data-module-shell='operacional'] .operational-chart-panel {
  min-height: 14rem;
  border-radius: 2px;
  box-shadow: none;
}

@media (max-width: 767px) {
  [data-module-shell='operacional'] .operational-comparison-matrix {
    overflow-x: hidden;
  }

  [data-module-shell='operacional'] .operational-chart-panel {
    min-height: 12rem;
  }
}
```

Preserve o gradiente interno da área do gráfico porque ele representa dados; retire somente gradientes de container e fundo.

- [ ] **Step 5: Executar os testes das páginas independentes**

Run: `npm test -- src/pages/operacional/EstoqueRetroativoPage.test.tsx src/pages/operacional/DistribuidoresPage.test.tsx src/components/operacional/estoque/DistributorEvolutionTab.test.tsx --run`

Expected: PASS.

- [ ] **Step 6: Commitar Retroativo e Distribuidores**

```bash
git add src/pages/operacional/EstoqueRetroativoPage.tsx src/pages/operacional/EstoqueRetroativoPage.test.tsx src/pages/operacional/DistribuidoresPage.tsx src/pages/operacional/DistribuidoresPage.test.tsx src/components/operacional/estoque/DistributorEvolutionTab.tsx src/components/operacional/estoque/DistributorEvolutionTab.test.tsx src/styles/operacional-square.css
git commit -m "feat: square retroactive and distributor views"
```

---

### Task 7: Verificar isolamento, fluidez, responsividade e produção

**Files:**
- Verify: only files already listed in Tasks 1-6
- Test: `src/styles/operacional-square.test.ts`
- Test: Operational and shared component test suites

**Interfaces:**
- Consumes: identidade Operacional completa das Tasks 1-6.
- Produces: build validado e registro de que não há regressão visual nos demais módulos.

- [ ] **Step 1: Fazer a varredura estática da folha final**

Run: `rg -n "backdrop-filter|backdrop-blur|radial-gradient|box-shadow|translateY|scale\(|animation:" src/styles/operacional-square.css`

Expected: somente a sombra curta de `.operational-overlay`; nenhuma animação decorativa, blur, halo, escala ou elevação.

- [ ] **Step 2: Executar lint e testes completos**

Run: `npm run lint`

Expected: exit code 0.

Run: `npm test -- --run`

Expected: todas as suítes PASS.

- [ ] **Step 3: Executar o build de produção**

Run: `npm run build`

Expected: exit code 0 e bundle gerado em `dist/`.

- [ ] **Step 4: Iniciar o servidor de validação**

Run: `npm run dev -- --host 127.0.0.1 --port 4175`

Expected: Vite informa `http://127.0.0.1:4175/` sem erro de compilação.

- [ ] **Step 5: Validar visualmente as três rotas**

Abra e inspecione:

```text
http://127.0.0.1:4175/operacional/estoque
http://127.0.0.1:4175/operacional/estoque/retroativo
http://127.0.0.1:4175/operacional/distribuidores
```

Em `1440x900`, `1024x768`, `768x1024` e `390x844`, confirme: ausência de rolagem horizontal da página, texto completo, sidebar acima dos filtros, tabela confinando o próprio overflow, conteúdo estável durante atualização e overlays dentro da viewport.

- [ ] **Step 6: Validar interação e movimento**

Em claro e escuro, exercite sidebar minimizada/expandida, filtro, tabs, drawer, hover de tabela, hover de gráfico e atualização. Confirme que não há salto de layout, mudança de tamanho em hover, tooltip travado, animação repetitiva ou tela vazia durante refetch.

- [ ] **Step 7: Confirmar que outros módulos não mudaram**

Abra `/comercial/dashboard` e `/financeiro` e confirme que sidebar, raios, fundos e cards continuam com a identidade anterior. Inspecione o DOM e confirme que recebem `data-module-shell="comercial"` e `data-module-shell="financeiro"`, nunca as regras do seletor Operacional.

- [ ] **Step 8: Revisar o diff e versionar correções encontradas na validação**

Run: `git diff --check`

Expected: nenhuma linha com whitespace inválido.

Se a validação exigir correções nos arquivos já previstos, execute novamente os Steps 1-7 e então:

```bash
git add src/components/pelegrini src/components/layout/OperacionalSidebar.tsx src/components/operacional src/pages/operacional src/styles/operacional-square.css src/styles/operacional-square.test.ts src/main.tsx
git commit -m "fix: polish operational responsive visual identity"
```
