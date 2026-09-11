# Identidade Visual Quadrada do Comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar ao modulo Comercial uma identidade visual quadrada, tecnica e fluida, preservando cores, dados, rotas, permissoes e regras de negocio.

**Architecture:** O shell existente `data-module-shell="comercial"` sera a fronteira da nova folha visual, carregada depois dos estilos globais e operacionais. As primitivas compactas existentes serao fortalecidas com classes semanticas e overlays receberao uma classe explicita para funcionar fora da arvore do shell sem atingir outros modulos.

**Tech Stack:** React 18, TypeScript 5.8, Tailwind CSS 3.4, Radix UI, Recharts, Vitest, Testing Library e Vite.

**Spec:** `docs/superpowers/specs/2026-09-11-identidade-comercial-quadrada-design.md`

## Global Constraints

- Alterar somente o shell, a navegacao e as telas do modulo Comercial.
- Preservar as cores atuais, os temas claro/escuro e as identidades das filiais.
- Paineis, celulas, tabelas e secoes enquadradas usam raio de `2px`.
- Campos, botoes, menus, popovers, dialogos e drawers usam raio maximo de `4px`.
- Badges, avatares e indicadores circulares podem permanecer arredondados.
- Remover somente do Comercial sombras profundas, blur, glassmorphism, halos e gradientes decorativos.
- Transicoes de cor e opacidade ficam entre `120ms` e `180ms`; sidebar no maximo `220ms`.
- Hover e foco nao podem alterar dimensoes ou fluxo do documento.
- Durante refetch, preservar conteudo anterior e indicar atualizacao localmente.
- Respeitar `prefers-reduced-motion` e nao instalar biblioteca nova.
- Nao alterar consultas, endpoints, calculos, metas, comissoes, campanhas, rotas ou permissoes.
- Nao incluir em commits `src/config/localPreview.test.ts`, `src/config/localPreview.ts`, `src/hooks/useCotacoesComerciais.test.ts`, `src/hooks/useCotacoesComerciais.ts` nem `.tmp-produtos-red.json`.

---

### Task 1: Criar a camada visual exclusiva do Comercial

**Files:**
- Modify: `src/main.tsx`
- Create: `src/styles/comercial-square.css`
- Create: `src/styles/comercial-square.test.ts`
- Modify: `src/components/pelegrini/PelegriniVisuals.test.tsx`

**Interfaces:**
- Consumes: `data-module-shell="comercial"` ja exposto por `PelegriniModuleShell`.
- Produces: tokens `--commercial-panel-radius`, `--commercial-control-radius`, `--commercial-motion-fast` e `--commercial-motion-sidebar`.

- [ ] **Step 1: Escrever o teste de escopo que falha**

Crie `comercial-square.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('commercial square visual scope', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/comercial-square.css'), 'utf8');

  it('keeps structural rules inside the commercial module', () => {
    expect(css).toContain("[data-module-shell='comercial']");
    expect(css).not.toMatch(/^\s*\.(?:rounded|bg-card|premium-card)\b/m);
  });

  it('defines geometry, motion and reduced motion contracts', () => {
    expect(css).toContain('--commercial-panel-radius: 2px');
    expect(css).toContain('--commercial-control-radius: 4px');
    expect(css).toContain('--commercial-motion-sidebar: 220ms');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
```

Em `PelegriniVisuals.test.tsx`, confirme que um shell Comercial recebe o escopo e um shell Financeiro nao:

```tsx
expect(commercialShell).toHaveAttribute('data-module-shell', 'comercial');
expect(financialShell).toHaveAttribute('data-module-shell', 'financeiro');
```

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/styles/comercial-square.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: FAIL porque a folha ainda nao existe nem esta importada.

- [ ] **Step 3: Criar a folha e importa-la por ultimo**

Em `main.tsx`, mantenha:

```ts
import './index.css';
import './styles/operacional-square.css';
import './styles/comercial-square.css';
```

Inicie `comercial-square.css`:

```css
[data-module-shell='comercial'] {
  --commercial-panel-radius: 2px;
  --commercial-control-radius: 4px;
  --commercial-motion-fast: 150ms;
  --commercial-motion-sidebar: 220ms;
}

[data-module-shell='comercial'] .pelegrini-page-surface {
  background: hsl(var(--background));
}

[data-module-shell='comercial'] .pelegrini-surface-pattern {
  display: none;
}

[data-module-shell='comercial'] * {
  letter-spacing: 0;
}

@media (prefers-reduced-motion: reduce) {
  [data-module-shell='comercial'] *,
  [data-module-shell='comercial'] *::before,
  [data-module-shell='comercial'] *::after,
  .commercial-overlay,
  .commercial-overlay * {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 4: Executar os testes do escopo**

Run: `npm test -- src/styles/comercial-square.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commitar a fundacao**

```bash
git add src/main.tsx src/styles/comercial-square.css src/styles/comercial-square.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx
git commit -m "feat: scope square visual identity to commercial"
```

---

### Task 2: Aplicar a identidade a navegacao Comercial

**Files:**
- Modify: `src/components/layout/ComercialSidebar.tsx`
- Modify: `src/components/layout/ComercialSidebar.test.ts`
- Modify: `src/components/layout/ComercialMobileBottomNav.tsx`
- Modify: `src/components/layout/ComercialMobileLayout.tsx`
- Modify: `src/components/layout/ComercialLayout.tsx`
- Modify: `src/styles/comercial-square.css`

**Interfaces:**
- Consumes: prop `indexed?: boolean` e classes `sidebar-item-index`, `sidebar-item-active`, `pelegrini-sidebar-collapsible` de `PelegriniModuleSidebar`.
- Produces: sidebar indexada no desktop, classe `commercial-mobile-navigation` e estado de selecao de filial sem decoracao.

- [ ] **Step 1: Escrever testes de navegacao e isolamento**

Em `ComercialSidebar.test.ts`, valide a variante indexada e o mobile:

```tsx
expect(screen.getByTestId('module-sidebar')).toHaveAttribute(
  'data-navigation-style',
  'indexed',
);
expect(screen.getByText('01')).toHaveClass('sidebar-item-index');
expect(screen.getByRole('navigation', { name: 'Navegacao comercial mobile' }))
  .toHaveClass('commercial-mobile-navigation');
```

Adicione um teste de rotas e permissoes que mantenha `Cotações Abertas` e `Vendas Perdidas` somente nos contextos atuais.

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/components/layout/ComercialSidebar.test.ts src/components/pelegrini/PelegriniModuleSidebar.test.tsx --run`

Expected: FAIL pela variante e classe mobile ausentes.

- [ ] **Step 3: Ativar a sidebar indexada e marcar o mobile**

Em `ComercialSidebar.tsx`:

```tsx
<PelegriniModuleSidebar
  indexed
  theme={theme}
  items={comercialMenuItems}
  futureItems={showFutureItems ? futureMenuItems : undefined}
  mobileOpen={isMobileOpen}
  onMobileOpenChange={setIsMobileOpen}
/>
```

Na raiz de `ComercialMobileBottomNav`, adicione `aria-label="Navegacao comercial mobile"` e `commercial-mobile-navigation` sem mudar links ou regras.

- [ ] **Step 4: Simplificar o estado de selecao de filial**

Em `ComercialLayout.tsx`, substitua apenas as classes decorativas do icone:

```tsx
<div className="commercial-branch-placeholder-icon flex h-12 w-12 items-center justify-center border border-border bg-card">
  <Building2 className="h-6 w-6 text-primary" />
</div>
```

Preserve botoes, bloqueios, textos e callbacks atuais.

- [ ] **Step 5: Estilizar desktop e mobile sem deslocamento**

Acrescente:

```css
[data-module-shell='comercial'] .pelegrini-sidebar {
  border-right: 1px solid hsl(var(--sidebar-border));
  background: hsl(var(--sidebar-background));
  box-shadow: none;
}

[data-module-shell='comercial'] .sidebar-action {
  border-radius: var(--commercial-panel-radius);
  transition: color 150ms ease, background-color 150ms ease;
}

[data-module-shell='comercial'] .sidebar-item-active {
  position: relative;
  box-shadow: none !important;
}

[data-module-shell='comercial'] .sidebar-item-active::before {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 3px;
  background: var(--pelegrini-accent);
  content: '';
}

[data-module-shell='comercial'] .commercial-mobile-navigation {
  border-radius: 0;
  box-shadow: none;
}

@media (min-width: 768px) {
  [data-module-shell='comercial'] .pelegrini-sidebar-collapsible {
    transition: width var(--commercial-motion-sidebar) cubic-bezier(0.22, 1, 0.36, 1);
  }
}
```

Nao altere a largura reservada de `72px` para o conteudo.

- [ ] **Step 6: Executar os testes de navegacao**

Run: `npm test -- src/components/layout/ComercialSidebar.test.ts src/components/pelegrini/PelegriniModuleSidebar.test.tsx src/components/layout/OperacionalSidebar.test.ts --run`

Expected: PASS, incluindo isolamento do Operacional.

- [ ] **Step 7: Commitar a navegacao**

```bash
git add src/components/layout/ComercialSidebar.tsx src/components/layout/ComercialSidebar.test.ts src/components/layout/ComercialMobileBottomNav.tsx src/components/layout/ComercialMobileLayout.tsx src/components/layout/ComercialLayout.tsx src/styles/comercial-square.css
git commit -m "feat: square commercial navigation"
```

---

### Task 3: Fortalecer as primitivas compactas e overlays

**Files:**
- Modify: `src/components/comercial/compact/ComercialCompactLayout.tsx`
- Modify: `src/components/comercial/compact/ComercialCompactLayout.css`
- Modify: `src/components/comercial/compact/ComercialCompactLayout.test.tsx`
- Modify: `src/components/comercial/EnterpriseComercialFilters.tsx`
- Modify: `src/styles/comercial-square.css`
- Modify: `src/styles/comercial-square.test.ts`

**Interfaces:**
- Consumes: props publicas atuais das cinco primitivas compactas.
- Produces: classes `commercial-workspace`, `commercial-toolbar`, `commercial-filter-control`, `commercial-metric-strip`, `commercial-data-viewport` e `commercial-overlay`.

- [ ] **Step 1: Escrever testes das classes e dimensoes estaveis**

Em `ComercialCompactLayout.test.tsx`:

```tsx
expect(screen.getByRole('main')).toHaveClass('commercial-workspace');
expect(screen.getByRole('banner')).toHaveClass('commercial-toolbar');
expect(screen.getByRole('region', { name: 'Filtros comerciais' }))
  .toHaveClass('commercial-filter-control');
expect(screen.getByRole('region', { name: 'Indicadores comerciais' }))
  .toHaveClass('commercial-metric-strip');
expect(screen.getByTestId('comercial-data-viewport'))
  .toHaveClass('commercial-data-viewport');
```

Valide que um valor `R$ 4.444.444,08` recebe largura intrinseca no item e nao no container inteiro.

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/components/comercial/compact/ComercialCompactLayout.test.tsx src/styles/comercial-square.test.ts --run`

Expected: FAIL pelas classes novas ausentes.

- [ ] **Step 3: Adicionar classes sem mudar as assinaturas**

Use `cn` para acrescentar:

```tsx
// ComercialCompactPage
'commercial-workspace comercial-compact-page min-h-0 min-w-0 max-w-full overflow-x-hidden'

// ComercialCommandBar
'commercial-toolbar comercial-command-bar'

// ComercialFilterBar
'commercial-filter-control comercial-filter-bar'

// ComercialMetricStrip
'commercial-metric-strip comercial-metric-strip'

// ComercialDataViewport
'commercial-data-viewport comercial-data-viewport min-h-0 min-w-0 max-w-full overflow-auto'
```

Para cada metrica, derive `valueLength` apenas quando `value` for texto e aplique:

```tsx
style={{ minWidth: `max(9rem, calc(${Math.max(valueLength, 1)}ch + 3rem))` }}
```

- [ ] **Step 4: Aplicar geometria e movimento**

Em `comercial-square.css`:

```css
[data-module-shell='comercial'] :where(
  .commercial-toolbar,
  .commercial-filter-control,
  .commercial-metric-strip,
  .commercial-data-viewport,
  .pelegrini-data-panel,
  .pelegrini-chart-frame,
  .bg-card
) {
  border-radius: var(--commercial-panel-radius) !important;
  box-shadow: none !important;
  background-image: none !important;
}

[data-module-shell='comercial'] :where(.rounded-md, .rounded-lg, .rounded-xl, .rounded-2xl) {
  border-radius: var(--commercial-panel-radius) !important;
}

[data-module-shell='comercial'] :where(button, input, select, textarea, [role='combobox'], [role='tab']) {
  border-radius: var(--commercial-control-radius) !important;
}

[data-module-shell='comercial'] :where(button, [role='button'], [role='tab']) {
  transition-property: color, background-color, border-color, opacity;
  transition-duration: var(--commercial-motion-fast);
}

[data-module-shell='comercial'] :where(.premium-card, .premium-hover-card, .dashboard-header-card):hover {
  transform: none !important;
  box-shadow: none !important;
}

.commercial-overlay {
  border-radius: var(--commercial-control-radius, 4px) !important;
  background: hsl(var(--popover));
}
```

Nao inclua `.rounded-full`.

- [ ] **Step 5: Identificar o painel portado de filtros**

No conteudo portado de `EnterpriseComercialFilters`, adicione `commercial-overlay`; preserve trigger, foco, campos e callbacks.

- [ ] **Step 6: Executar os testes das primitivas**

Run: `npm test -- src/components/comercial/compact/ComercialCompactLayout.test.tsx src/components/comercial/EnterpriseComercialFilters.test.tsx src/styles/comercial-square.test.ts --run`

Expected: PASS. Se o teste de filtros estiver em outro arquivo existente, use o arquivo que importa `EnterpriseComercialFilters` sem criar uma segunda suite redundante.

- [ ] **Step 7: Commitar as primitivas**

```bash
git add src/components/comercial/compact/ComercialCompactLayout.tsx src/components/comercial/compact/ComercialCompactLayout.css src/components/comercial/compact/ComercialCompactLayout.test.tsx src/components/comercial/EnterpriseComercialFilters.tsx src/styles/comercial-square.css src/styles/comercial-square.test.ts
git commit -m "feat: add stable commercial workspace primitives"
```

---

### Task 4: Converter Dashboard, Metas, Insights e Campanhas

**Files:**
- Modify: `src/pages/comercial/MetasVendedoresPage.tsx`
- Create: `src/pages/comercial/MetasVendedoresPage.test.tsx`
- Modify: `src/components/comercial/VisaoGeralRapida1004.tsx`
- Modify: `src/components/comercial/VisaoGeralRapida1004.test.ts`
- Modify: `src/components/comercial/PremiumMetasView.tsx`
- Modify: `src/components/comercial/RankingVendedoresPremium.tsx`
- Modify: `src/components/comercial/RankingVendedoresLabels.tsx`
- Modify: `src/components/comercial/InsightsIATab.tsx`
- Modify: `src/components/comercial/CampanhasTab.tsx`
- Modify: `src/styles/comercial-square.css`

**Interfaces:**
- Consumes: primitivas e `commercial-overlay` da Task 3.
- Produces: `commercial-dashboard`, `commercial-tab-strip`, `commercial-dashboard-panel`, `commercial-chart-frame` e `commercial-insight-action`.

- [ ] **Step 1: Escrever testes estruturais e de refetch**

Adicione aos testes existentes:

```tsx
expect(screen.getByRole('main')).toHaveClass('commercial-dashboard');
expect(screen.getByRole('tablist')).toHaveClass('commercial-tab-strip');
expect(screen.getByRole('region', { name: 'Indicadores do dashboard comercial' }))
  .toHaveClass('commercial-metric-strip');
```

Para refetch, use uma promessa controlada: renderize dados, acione `Atualizar`, mantenha um valor anterior visivel e confirme que somente o botao/status indica atualizacao ate resolver a promessa.

- [ ] **Step 2: Escrever testes de Insights e tooltip**

Valide que cada insight tem titulo, acao gerencial completa e `white-space: normal` por classe semantica. No grafico com tooltip, dispare `mouseEnter` e `mouseLeave` e confirme que o conteudo temporario desaparece.

- [ ] **Step 3: Executar e confirmar a falha**

Run: `npm test -- src/pages/comercial/MetasVendedoresPage.test.tsx src/components/comercial/VisaoGeralRapida1004.test.ts src/components/comercial/RankingVendedoresLabels.test.tsx --run`

Expected: FAIL pelas classes e garantias de preservacao ausentes.

- [ ] **Step 4: Aplicar classes sem mudar dados**

Na raiz da pagina use:

```tsx
<ComercialCompactPage as="div" className="commercial-dashboard dashboard-commercial-page">
```

Marque o tablist, paineis e graficos:

```tsx
className="commercial-tab-strip"
className="commercial-dashboard-panel"
className="commercial-chart-frame"
```

Em Insights, use `commercial-insight-action` no texto acionavel e remova apenas classes de truncamento vertical que escondem a recomendacao.

- [ ] **Step 5: Preservar o conteudo durante refetch**

Separe carregamento inicial de atualizacao:

```ts
const showInitialLoading = isLoading && !hasRenderedData;
const isRefreshing = isFetching && hasRenderedData;
```

Use `showInitialLoading` para o skeleton de pagina. Mantenha as secoes montadas quando `isRefreshing` for verdadeiro e desabilite apenas a acao de atualizar.

- [ ] **Step 6: Aplicar a composicao visual**

```css
[data-module-shell='comercial'] .commercial-dashboard {
  height: 100%;
  min-height: 0;
  gap: 8px;
  overflow: hidden;
}

[data-module-shell='comercial'] :where(
  .commercial-dashboard-panel,
  .commercial-chart-frame
) {
  min-width: 0;
  border: 1px solid hsl(var(--border) / 0.75);
  border-radius: var(--commercial-panel-radius);
  background: hsl(var(--card));
  box-shadow: none;
}

[data-module-shell='comercial'] .commercial-insight-action {
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 7: Executar os testes do Dashboard**

Run: `npm test -- src/pages/comercial/MetasVendedoresPage.test.tsx src/components/comercial/VisaoGeralRapida1004.test.ts src/components/comercial/RankingVendedoresLabels.test.tsx src/components/comercial/ClientesExperience.test.tsx --run`

Expected: PASS sem alterar calculos ou chamadas.

- [ ] **Step 8: Commitar o Dashboard**

```bash
git add src/pages/comercial/MetasVendedoresPage.tsx src/pages/comercial/MetasVendedoresPage.test.tsx src/components/comercial/VisaoGeralRapida1004.tsx src/components/comercial/VisaoGeralRapida1004.test.ts src/components/comercial/PremiumMetasView.tsx src/components/comercial/RankingVendedoresPremium.tsx src/components/comercial/RankingVendedoresLabels.tsx src/components/comercial/InsightsIATab.tsx src/components/comercial/CampanhasTab.tsx src/styles/comercial-square.css
git commit -m "feat: square commercial dashboard workspace"
```

---

### Task 5: Converter Produtos e Clientes

**Files:**
- Modify: `src/pages/comercial/ProdutosPage.tsx`
- Modify: `src/pages/comercial/ProdutosPage.test.tsx`
- Modify: `src/pages/comercial/ClientesPage.tsx`
- Modify: `src/pages/comercial/ClientesPage.test.tsx`
- Modify: `src/pages/comercial/ClientesAnalysePage.tsx`
- Modify: `src/components/comercial/PremiumMarcasView.tsx`
- Modify: `src/components/comercial/PremiumTopProdutos.tsx`
- Modify: `src/components/comercial/PremiumCategoriasView.tsx`
- Modify: `src/components/comercial/ClienteDetalheDrilldown.tsx`
- Modify: `src/styles/comercial-square.css`

**Interfaces:**
- Consumes: `commercial-workspace`, `commercial-data-viewport` e `commercial-overlay`.
- Produces: `commercial-products`, `commercial-clients`, `commercial-table-frame`, `commercial-detail-panel` e `commercial-chart-frame`.

- [ ] **Step 1: Escrever testes de composicao e estados**

Nos testes de Produtos e Clientes:

```tsx
expect(screen.getByRole('main')).toHaveClass('commercial-products');
expect(screen.getByRole('main')).toHaveClass('commercial-clients');
expect(screen.getByRole('region', { name: 'Ranking de produtos' }))
  .toHaveClass('commercial-data-viewport');
```

Cubra loading inicial, dados preservados durante refetch, erro sem totalizadores zerados e estado vazio distinto de falha.

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/pages/comercial/ProdutosPage.test.tsx src/pages/comercial/ClientesPage.test.tsx --run`

Expected: FAIL pelas classes ou estados ainda nao protegidos.

- [ ] **Step 3: Aplicar as classes e paineis lineares**

Use nas raizes:

```tsx
<ComercialCompactPage className="commercial-products">
<ComercialCompactPage className="commercial-clients">
```

Use `commercial-table-frame`, `commercial-detail-panel` e `commercial-chart-frame` nos wrappers existentes. Nao crie wrappers adicionais em torno de cards ou tabelas.

- [ ] **Step 4: Identificar overlays de detalhe**

Adicione `commercial-overlay` ao conteudo portado de `ClienteDetalheDrilldown` e de qualquer drawer de Produtos utilizado nessas paginas. Preserve foco, `aria-label`, fechamento e scroll.

- [ ] **Step 5: Confinar overflow e estabilizar grades**

```css
[data-module-shell='comercial'] :where(.commercial-products, .commercial-clients) {
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

[data-module-shell='comercial'] .commercial-table-frame {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border) / 0.75);
  border-radius: var(--commercial-panel-radius);
}

[data-module-shell='comercial'] .commercial-table-frame > [role='region'] {
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
```

- [ ] **Step 6: Executar os testes de Produtos e Clientes**

Run: `npm test -- src/pages/comercial/ProdutosPage.test.tsx src/pages/comercial/ClientesPage.test.tsx src/components/comercial/ClientesExperience.test.tsx --run`

Expected: PASS.

- [ ] **Step 7: Commitar Produtos e Clientes**

```bash
git add src/pages/comercial/ProdutosPage.tsx src/pages/comercial/ProdutosPage.test.tsx src/pages/comercial/ClientesPage.tsx src/pages/comercial/ClientesPage.test.tsx src/pages/comercial/ClientesAnalysePage.tsx src/components/comercial/PremiumMarcasView.tsx src/components/comercial/PremiumTopProdutos.tsx src/components/comercial/PremiumCategoriasView.tsx src/components/comercial/ClienteDetalheDrilldown.tsx src/styles/comercial-square.css
git commit -m "feat: square commercial product and client views"
```

---

### Task 6: Converter Comissao, Cotacoes e Vendas Perdidas

**Files:**
- Modify: `src/pages/comercial/ComissaoPage.tsx`
- Modify: `src/pages/comercial/ComissaoPage.test.tsx`
- Modify: `src/components/comercial/ComissaoOperacaoFilter.tsx`
- Modify: `src/components/comercial/ComissaoOperacaoFilter.test.tsx`
- Modify: `src/pages/comercial/CotacoesAbertasPage.tsx`
- Modify: `src/pages/comercial/VendasPerdidasPage.tsx`
- Modify: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`
- Modify: `src/components/comercial/cotacoes/CotacoesFilters.tsx`
- Modify: `src/components/comercial/cotacoes/CotacaoDetailDrawer.tsx`
- Modify: `src/components/comercial/cotacoes/MotivoPerdaDialog.tsx`
- Modify: `src/styles/comercial-square.css`

**Interfaces:**
- Consumes: primitivas compactas e classe `commercial-overlay`.
- Produces: `commercial-commission`, `commercial-quotes`, `commercial-lost-sales` e `commercial-table-frame`.

- [ ] **Step 1: Escrever testes de paginas densas**

Em `ComissaoPage.test.tsx`:

```tsx
expect(screen.getByRole('main')).toHaveClass('commercial-commission');
expect(screen.getByRole('region', { name: 'Comissao por vendedor' }))
  .toHaveClass('commercial-table-frame');
```

Em `CotacoesComerciaisPages.test.tsx`, valide as raizes `commercial-quotes` e `commercial-lost-sales`, tabela com scroll interno e overlays com `commercial-overlay`.

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test -- src/pages/comercial/ComissaoPage.test.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/comercial/ComissaoOperacaoFilter.test.tsx --run`

Expected: FAIL pelas classes e overlays ausentes.

- [ ] **Step 3: Marcar raizes e viewports**

Use:

```tsx
<ComercialCompactPage className="commercial-commission comissao-page">
<ComercialCompactPage className="commercial-quotes">
<ComercialCompactPage className="commercial-lost-sales">
```

Marque o wrapper de cada tabela como `commercial-table-frame`. Nao mude colunas, filtros, totais nem paginacao.

- [ ] **Step 4: Marcar filtros e detalhes portados**

Adicione `commercial-overlay` ao conteudo portado de `ComissaoOperacaoFilter`, `CotacoesFilters`, `CotacaoDetailDrawer` e `MotivoPerdaDialog`. Garanta que os triggers mantenham `aria-expanded` e o conteudo mantenha titulo acessivel.

- [ ] **Step 5: Preservar dados durante atualizacao**

Nas tres paginas, use o padrao:

```ts
const hasVisibleData = rows.length > 0 || hasResolvedEmptyState;
const showInitialLoading = isLoading && !hasVisibleData;
const isRefreshing = isFetching && hasVisibleData;
```

O estado `isRefreshing` mantem tabela, totalizadores, contagem e paginacao montados; apenas comandos relacionados ficam desabilitados.

- [ ] **Step 6: Aplicar densidade e overflow**

```css
[data-module-shell='comercial'] :where(
  .commercial-commission,
  .commercial-quotes,
  .commercial-lost-sales
) {
  height: 100%;
  min-height: 0;
  min-width: 0;
  gap: 8px;
  overflow: hidden;
}

[data-module-shell='comercial'] .commercial-table-frame table {
  width: 100%;
  border-collapse: collapse;
}

[data-module-shell='comercial'] .commercial-table-frame :where(th, td) {
  height: 32px;
  border-bottom: 1px solid hsl(var(--border) / 0.55);
  padding: 4px 8px;
}
```

- [ ] **Step 7: Executar os testes das paginas**

Run: `npm test -- src/pages/comercial/ComissaoPage.test.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/comercial/ComissaoOperacaoFilter.test.tsx src/components/layout/ComercialSidebar.test.ts --run`

Expected: PASS, incluindo rotas e permissoes atuais.

- [ ] **Step 8: Commitar as paginas densas**

```bash
git add src/pages/comercial/ComissaoPage.tsx src/pages/comercial/ComissaoPage.test.tsx src/components/comercial/ComissaoOperacaoFilter.tsx src/components/comercial/ComissaoOperacaoFilter.test.tsx src/pages/comercial/CotacoesAbertasPage.tsx src/pages/comercial/VendasPerdidasPage.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx src/components/comercial/cotacoes/CotacoesFilters.tsx src/components/comercial/cotacoes/CotacaoDetailDrawer.tsx src/components/comercial/cotacoes/MotivoPerdaDialog.tsx src/styles/comercial-square.css
git commit -m "feat: square commercial transaction views"
```

---

### Task 7: Validar responsividade, fluidez e isolamento

**Files:**
- Modify: `src/styles/comercial-square.css`
- Modify: `src/styles/comercial-square.test.ts`
- Modify: testes afetados somente quando a verificacao revelar uma regressao real

**Interfaces:**
- Consumes: todas as telas e classes produzidas nas Tasks 1 a 6.
- Produces: identidade Comercial validada em claro/escuro, desktop/mobile e isolada dos demais modulos.

- [ ] **Step 1: Fortalecer os contratos de CSS**

Em `comercial-square.test.ts`, acrescente:

```ts
it('keeps shadows only on temporary overlays', () => {
  const shadowRules = css.match(/[^{}]+\{[^{}]*box-shadow:\s*(?!none)[^;]+;[^{}]*\}/g) ?? [];
  expect(shadowRules.every((rule) => rule.includes('.commercial-overlay'))).toBe(true);
});

it('does not animate layout dimensions', () => {
  expect(css).not.toMatch(/transition(?:-property)?:[^;]*(?:all|width|height|padding|margin)/);
});
```

- [ ] **Step 2: Executar os testes focados consolidados**

Run:

```bash
npm test -- src/styles/comercial-square.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx src/components/pelegrini/PelegriniModuleSidebar.test.tsx src/components/layout/ComercialSidebar.test.ts src/components/comercial/compact/ComercialCompactLayout.test.tsx src/pages/comercial/MetasVendedoresPage.test.tsx src/pages/comercial/ProdutosPage.test.tsx src/pages/comercial/ClientesPage.test.tsx src/pages/comercial/ComissaoPage.test.tsx src/pages/comercial/CotacoesComerciaisPages.test.tsx --run
```

Expected: PASS. Registre separadamente qualquer falha baseline reproduzida antes do plano.

- [ ] **Step 3: Executar verificacoes estaticas e build**

Run: `npm run lint`

Expected: codigo `0` sem novos erros.

Run: `npx tsc -b --pretty false`

Expected: codigo `0` ou somente falhas baseline ja documentadas, sem erro em arquivo alterado pelo plano.

Run: `npm run build`

Expected: codigo `0` e `dist/` gerado.

Run: `git diff --check`

Expected: codigo `0`.

- [ ] **Step 4: Subir o servidor de validacao**

Use uma porta livre:

```powershell
$env:VITE_LOCAL_PREVIEW='true'
npm run dev -- --host 127.0.0.1 --port 4175
```

Se `4175` estiver ocupada, use a proxima porta livre e registre a URL.

- [ ] **Step 5: Validar as rotas em navegador real**

Inspecione:

```text
/comercial/dashboard
/comercial/produtos
/comercial/clientes
/comercial/comissao
/comercial/cotacoes
/comercial/perdidas
```

Em cada rota, valide `1440x900`, `1024x768`, `768x1024` e `390x844`:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

Confirme ausencia de sobreposicao, cortes sem alternativa, scroll horizontal da pagina, erros no console e overlay do Vite.

- [ ] **Step 6: Validar fluidez e interacoes**

- Sidebar desktop: largura visual `72px -> 248px` sem mudar a posicao ou largura do conteudo principal.
- Refetch: dado anterior permanece visivel, comando fica desabilitado e nenhum skeleton de pagina substitui o conteudo.
- Filtros: painel permanece dentro do viewport e abaixo/acima da sidebar conforme o empilhamento correto.
- Drawers e dialogos: foco, fechamento e scroll funcionam sem overflow do documento.
- Graficos: tooltip aparece no hover e desaparece apos `mouseLeave`.
- Mobile: navegacao inferior nao cobre a ultima linha de conteudo.
- Reduced motion: transicoes nao essenciais ficam efetivamente desativadas.

- [ ] **Step 7: Validar isolamento**

Abra `/operacional/estoque` e uma rota de Financeiro. Confirme:

```js
document.querySelector('[data-module-shell="comercial"]') === null
```

e que nenhuma classe `commercial-*` foi adicionada aos shells desses modulos.

- [ ] **Step 8: Corrigir apenas regressao comprovada e repetir a verificacao afetada**

Para cada problema encontrado, volte ao ciclo da Task proprietaria: crie primeiro um teste focado que reproduza o sintoma, confirme a falha, aplique a menor correcao e repita o teste e a rota afetada. Faça um commit separado usando somente os caminhos explicitamente listados em `Files` daquela Task. Nao faça refatoracoes fora do escopo.

- [ ] **Step 9: Commitar o acabamento validado**

```bash
git add src/styles/comercial-square.css src/styles/comercial-square.test.ts
git commit -m "fix: polish commercial responsive visual identity"
```

Antes do commit, remova do staging qualquer arquivo listado nas restricoes globais.
