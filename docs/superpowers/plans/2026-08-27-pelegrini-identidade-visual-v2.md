# Pelegrini Identidade Visual V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current color-only Pelegrini redesign with a real automotive operating-panel identity for Grupo Pelegrini, Casa da Transmissao, and Casa do Chevrolet.

**Architecture:** Keep all business/data behavior untouched and add a focused visual layer: branch identity metadata, mechanical visual primitives, branded home composition, filial selector, sidebars, common states, and representative module headers. The implementation should reuse existing React/Vite/Tailwind patterns and avoid broad refactors.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, lucide-react, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-27-pelegrini-identidade-visual-v2-design.md`

## Global Constraints

- Do not alter endpoints, proxy/API, login/authentication, user creation, permissions, branch rules, calculations, Excel exports, or data queries.
- Remove residual generic/template copy from the main experience: `Powered by React`, `BI Reports`, and template-like labels.
- Reduce generic visual language in new/changed surfaces: `glass`, heavy `backdrop-blur`, `rounded-3xl`, decorative sparkles, and gradients without operational purpose.
- Keep cards and panels mostly between 8px and 12px radius unless an existing component contract requires otherwise.
- Avoid cards inside cards.
- Avoid text clipping at 320px, 375px, 768px, and desktop widths.
- Keep animations subtle, readable, and respectful of `prefers-reduced-motion`.
- Full test suite currently has known external failures in `src/components/comercial/ReceitaDetalheDialog.test.tsx`; do not edit that file unless a task explicitly touches it.

---

## File Structure

- Create `src/config/pelegriniIdentity.ts`: branch-specific operational words, visual motifs, module copy, state copy, and footer labels.
- Test `src/config/pelegriniIdentity.test.ts`: proves the identity copy has no forbidden generic labels and exposes CT/CCH distinct values.
- Modify `src/config/pelegriniTheme.ts`: add non-breaking fields only if needed by the identity helpers; keep current exports stable.
- Modify `src/components/pelegrini/PelegriniMotionBackdrop.tsx`: replace generic line/gear backdrop with branch-specific mechanical/automotive layers.
- Create `src/components/pelegrini/PelegriniOperationalCard.tsx`: reusable non-template module/card shell with tighter radius and operational accents.
- Create `src/components/pelegrini/PelegriniBranchPanel.tsx`: reusable large filial card for home and selector.
- Modify `src/components/pelegrini/PelegriniBrandMark.tsx`: improve logo proportions and sidebar/home tones.
- Modify `src/components/pelegrini/PelegriniBranchBadge.tsx`: keep compact status badge but make it less pill-template-like.
- Modify `src/components/pelegrini/index.ts`: export new primitives.
- Test `src/components/pelegrini/PelegriniVisuals.test.tsx`: extend visual primitive smoke tests.
- Modify `src/pages/HomePage.tsx`: rebuild desktop home using operational layout and remove generic copy/effects.
- Modify `src/pages/HomeMobilePage.tsx`: rebuild mobile home to match the desktop identity without overflow.
- Modify `src/config/pelegriniHome.ts`: update copy and features to automotive language.
- Test `src/config/pelegriniHome.test.ts`: assert no forbidden copy and expected module labels.
- Modify `src/components/common/FilialSelectorDialog.tsx`: make filial selection visual and branch-specific.
- Modify `src/components/common/EmptyState.tsx`, `src/components/common/ErrorState.tsx`, `src/components/common/LoadingState.tsx`: branded operational states.
- Modify sidebars:
  - `src/components/layout/ComercialSidebar.tsx`
  - `src/components/layout/FinanceiroSidebar.tsx`
  - `src/components/layout/OperacionalSidebar.tsx`
  - `src/components/layout/WhatsappSidebar.tsx`
- Modify representative module pages:
  - `src/pages/comercial/ProdutosPage.tsx`
  - `src/pages/operacional/EstoquePage.tsx`
  - `src/pages/financeiro/ResumoPage.tsx`
  - `src/pages/whatsapp/ChatPage.tsx`
- Keep existing tests and add only focused assertions for copy, rendering, and no forbidden labels.

---

### Task 1: Identity Data and Mechanical Primitives

**Files:**
- Create: `src/config/pelegriniIdentity.ts`
- Test: `src/config/pelegriniIdentity.test.ts`
- Modify: `src/components/pelegrini/PelegriniMotionBackdrop.tsx`
- Create: `src/components/pelegrini/PelegriniOperationalCard.tsx`
- Create: `src/components/pelegrini/PelegriniBranchPanel.tsx`
- Modify: `src/components/pelegrini/PelegriniBrandMark.tsx`
- Modify: `src/components/pelegrini/PelegriniBranchBadge.tsx`
- Modify: `src/components/pelegrini/index.ts`
- Test: `src/components/pelegrini/PelegriniVisuals.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces:
  - `getPelegriniIdentity(themeKey: PelegriniThemeKey): PelegriniIdentity`
  - `getPelegriniModuleIdentity(moduleKey: 'whatsapp' | 'comercial' | 'operacional' | 'financeiro'): PelegriniModuleIdentity`
  - `<PelegriniOperationalCard />`
  - `<PelegriniBranchPanel />`
- Consumes:
  - `PelegriniThemeKey`, `PELEGRINI_THEMES`, `PelegriniTheme`.

- [ ] **Step 1: Write identity tests**

Add `src/config/pelegriniIdentity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_TEMPLATE_TERMS,
  getPelegriniIdentity,
  getPelegriniModuleIdentity,
} from './pelegriniIdentity';

describe('pelegriniIdentity', () => {
  it('keeps Casa da Transmissao and Casa do Chevrolet visually distinct', () => {
    const ct = getPelegriniIdentity('transmissao');
    const cch = getPelegriniIdentity('chevrolet');

    expect(ct.heroSignal).toContain('Cambio');
    expect(ct.microIndicators).toEqual(expect.arrayContaining(['Cambio', 'Diferencial', 'ZF']));
    expect(cch.heroSignal).toContain('Original');
    expect(cch.microIndicators).toEqual(expect.arrayContaining(['Original GM', 'Desde 1992']));
  });

  it('does not expose template residue in identity copy', () => {
    const text = [
      getPelegriniIdentity('pelegrini'),
      getPelegriniIdentity('transmissao'),
      getPelegriniIdentity('chevrolet'),
      getPelegriniModuleIdentity('whatsapp'),
      getPelegriniModuleIdentity('comercial'),
      getPelegriniModuleIdentity('operacional'),
      getPelegriniModuleIdentity('financeiro'),
    ].map((item) => JSON.stringify(item)).join(' ');

    FORBIDDEN_TEMPLATE_TERMS.forEach((term) => {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase());
    });
  });
});
```

- [ ] **Step 2: Run the failing identity test**

Run: `npm test -- src/config/pelegriniIdentity.test.ts --run`

Expected: FAIL because `src/config/pelegriniIdentity.ts` does not exist.

- [ ] **Step 3: Implement identity data**

Create `src/config/pelegriniIdentity.ts`:

```ts
import type { PelegriniThemeKey } from './pelegriniTheme';

export const FORBIDDEN_TEMPLATE_TERMS = ['Powered by React', 'BI Reports', 'Lovable'];

export type PelegriniModuleKey = 'whatsapp' | 'comercial' | 'operacional' | 'financeiro';

export interface PelegriniIdentity {
  themeKey: PelegriniThemeKey;
  eyebrow: string;
  heroTitle: string;
  heroSignal: string;
  operatingLine: string;
  microIndicators: string[];
  motionLabel: string;
  footerLine: string;
  selectorDescription: string;
}

export interface PelegriniModuleIdentity {
  key: PelegriniModuleKey;
  title: string;
  operationalLabel: string;
  description: string;
  metricLabel: string;
  tags: string[];
}

const identities: Record<PelegriniThemeKey, PelegriniIdentity> = {
  pelegrini: {
    themeKey: 'pelegrini',
    eyebrow: 'Grupo Pelegrini',
    heroTitle: 'Central de operacao das filiais automotivas',
    heroSignal: 'Vendas, estoque, financeiro e atendimento conectados',
    operatingLine: 'Uma mesa de controle para acompanhar Casa da Transmissao e Casa do Chevrolet.',
    microIndicators: ['Duas filiais', 'Quatro modulos', 'Operacao em tempo real'],
    motionLabel: 'Fluxo integrado de pecas e atendimento',
    footerLine: 'Pelegrini - operacao automotiva integrada',
    selectorDescription: 'Escolha a filial para ajustar visual, filtros e indicadores do painel.',
  },
  transmissao: {
    themeKey: 'transmissao',
    eyebrow: 'Casa da Transmissao',
    heroTitle: 'Operacao tecnica para cambio, diferencial e motor',
    heroSignal: 'Cambio, diferencial, motor e oleos no mesmo painel',
    operatingLine: 'Indicadores orientados para pecas tecnicas, giro e atendimento de balcão.',
    microIndicators: ['Cambio', 'Diferencial', 'ZF', 'Eaton'],
    motionLabel: 'Linhas de transmissao e giro tecnico',
    footerLine: 'Casa da Transmissao - cambio, diferencial e motor',
    selectorDescription: 'Painel com foco em pecas tecnicas, marcas e disponibilidade.',
  },
  chevrolet: {
    themeKey: 'chevrolet',
    eyebrow: 'Casa do Chevrolet',
    heroTitle: 'Pecas originais Chevrolet com atendimento especializado',
    heroSignal: 'Original GM, entrega rapida e tradicao desde 1992',
    operatingLine: 'Indicadores para balcão, pedidos, disponibilidade e relacionamento com clientes.',
    microIndicators: ['Original GM', 'Desde 1992', 'Entrega rapida'],
    motionLabel: 'Faixas de catalogo, pedido e entrega',
    footerLine: 'Casa do Chevrolet - pecas originais e atendimento especializado',
    selectorDescription: 'Painel com foco em pecas originais, pedidos e entrega.',
  },
};

const modules: Record<PelegriniModuleKey, PelegriniModuleIdentity> = {
  whatsapp: {
    key: 'whatsapp',
    title: 'WhatsApp',
    operationalLabel: 'Central de atendimento',
    description: 'Conversas, agentes e fila de atendimento com ritmo de balcão.',
    metricLabel: 'Fila e resposta',
    tags: ['Conversas', 'Agentes', 'Relatorios'],
  },
  comercial: {
    key: 'comercial',
    title: 'Comercial',
    operationalLabel: 'Pedidos e carteira',
    description: 'Clientes, produtos, cotacoes e vendas para decisao rapida.',
    metricLabel: 'Pedidos e margem',
    tags: ['Clientes', 'Produtos', 'Cotacoes'],
  },
  operacional: {
    key: 'operacional',
    title: 'Operacional',
    operationalLabel: 'Estoque e giro',
    description: 'Disponibilidade, prateleira e giro de pecas por filial.',
    metricLabel: 'Estoque e giro',
    tags: ['Estoque', 'Giro', 'Alertas'],
  },
  financeiro: {
    key: 'financeiro',
    title: 'Financeiro',
    operationalLabel: 'Caixa e cobranca',
    description: 'Resumo, DRE, duplicatas e cobranca em leitura executiva.',
    metricLabel: 'Caixa e DRE',
    tags: ['Resumo', 'DRE', 'Cobranca'],
  },
};

export function getPelegriniIdentity(themeKey: PelegriniThemeKey): PelegriniIdentity {
  return identities[themeKey];
}

export function getPelegriniModuleIdentity(moduleKey: PelegriniModuleKey): PelegriniModuleIdentity {
  return modules[moduleKey];
}
```

- [ ] **Step 4: Run identity tests until green**

Run: `npm test -- src/config/pelegriniIdentity.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Write primitive smoke tests**

Extend `src/components/pelegrini/PelegriniVisuals.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { PELEGRINI_THEMES } from '@/config/pelegriniTheme';
import { PelegriniBranchPanel } from './PelegriniBranchPanel';
import { PelegriniOperationalCard } from './PelegriniOperationalCard';

it('renders a mechanical branch panel with filial indicators', () => {
  render(
    <PelegriniBranchPanel
      theme={PELEGRINI_THEMES.transmissao}
      active
      indicators={['Cambio', 'Diferencial', 'ZF']}
      description="Painel com foco em pecas tecnicas."
      onSelect={() => undefined}
    />,
  );

  expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
  expect(screen.getByText('Cambio')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Casa da Transmissão/i })).toHaveClass('pelegrini-branch-panel');
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
  expect(screen.getByRole('button', { name: /Comercial/i })).toHaveClass('pelegrini-operational-card');
});
```

- [ ] **Step 6: Run primitive smoke tests and verify failure**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: FAIL because the new components do not exist.

- [ ] **Step 7: Implement primitives**

Create `PelegriniOperationalCard.tsx` with a button-based component using classes:

```tsx
className={cn(
  'pelegrini-operational-card group relative w-full overflow-hidden rounded-xl border text-left',
  'bg-card p-5 shadow-sm transition-[border-color,transform,box-shadow] duration-200',
  'hover:-translate-y-0.5 hover:shadow-lg',
)}
```

Create `PelegriniBranchPanel.tsx` with:

```tsx
className={cn(
  'pelegrini-branch-panel group relative w-full overflow-hidden rounded-xl border p-4 text-left',
  active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40',
)}
```

Update `PelegriniMotionBackdrop.tsx` so it renders branch-labeled layers:

```tsx
<span className="pelegrini-motion-track track-primary" />
<span className="pelegrini-motion-track track-secondary" />
<span className="pelegrini-motion-cog" />
<span className="pelegrini-motion-stamp" />
```

Add CSS in `src/index.css` for `.pelegrini-motion-track`, `.pelegrini-motion-cog`, and `.pelegrini-motion-stamp`, with `@media (prefers-reduced-motion: reduce)` disabling animation.

Update `src/components/pelegrini/index.ts` to export both new components.

- [ ] **Step 8: Run primitive tests**

Run: `npm test -- src/config/pelegriniIdentity.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/config/pelegriniIdentity.ts src/config/pelegriniIdentity.test.ts src/components/pelegrini src/index.css
git commit -m "feat: add pelegrini automotive identity primitives"
```

---

### Task 2: Home Desktop and Mobile Redesign

**Files:**
- Modify: `src/config/pelegriniHome.ts`
- Test: `src/config/pelegriniHome.test.ts`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomeMobilePage.tsx`

**Interfaces:**
- Consumes:
  - `getPelegriniIdentity`
  - `getPelegriniModuleIdentity`
  - `PelegriniOperationalCard`
  - `PelegriniBranchPanel`
- Produces:
  - A non-template desktop and mobile home with no `Powered by React`, no decorative Sparkles, no `rounded-3xl`, and no heavy glass/blur.

- [ ] **Step 1: Extend home tests**

Update `src/config/pelegriniHome.test.ts`:

```ts
it('uses automotive module copy and removes template residue', () => {
  const serialized = JSON.stringify({ pelegriniBrand, pelegriniModules, pelegriniAdminEntry });

  expect(serialized).toContain('Pedidos');
  expect(serialized).toContain('Estoque');
  expect(serialized).toContain('Cobranca');
  expect(serialized).not.toContain('Powered by React');
  expect(serialized).not.toContain('BI Reports');
});
```

- [ ] **Step 2: Run home config tests**

Run: `npm test -- src/config/pelegriniHome.test.ts --run`

Expected: FAIL if old copy is still present or required automotive terms are missing.

- [ ] **Step 3: Update home copy**

Modify `src/config/pelegriniHome.ts` so module descriptions match identity:

```ts
{
  title: 'Comercial',
  description: 'Pedidos, clientes, produtos e cotacoes para decisao rapida no balcão.',
  features: ['Clientes', 'Produtos', 'Cotacoes'],
}
```

Use `Cobranca`, `Estoque`, `Giro`, `Fila`, and `Relatorios` where appropriate.

- [ ] **Step 4: Replace desktop home composition**

In `src/pages/HomePage.tsx`:

- Remove `Sparkles` import.
- Replace the hero section with a solid operational panel:

```tsx
const homeIdentity = getPelegriniIdentity(homeTheme.key);
```

Use:

```tsx
<section className="pelegrini-command-board relative mb-6 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
  <PelegriniMotionBackdrop theme={homeTheme} intensity="strong" className="opacity-30" />
  <div className="relative grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {homeIdentity.eyebrow}
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-foreground">
        {homeIdentity.heroTitle}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        {homeIdentity.operatingLine}
      </p>
    </div>
  </div>
</section>
```

Replace module cards with `<PelegriniOperationalCard />`.

Replace branch badges with two `<PelegriniBranchPanel />` components.

Remove footer line containing `Powered by React`.

- [ ] **Step 5: Replace mobile home composition**

In `src/pages/HomeMobilePage.tsx`:

- Remove `backdrop-blur-xl` from the top header.
- Use a compact command-board section.
- Use one-column `<PelegriniBranchPanel />` for branch switching.
- Use `<PelegriniOperationalCard />` for modules.
- Ensure the longest branch name wraps cleanly:

```tsx
<h3 className="min-w-0 text-base font-semibold leading-tight">{theme.name}</h3>
```

- [ ] **Step 6: Run focused home tests**

Run:

```bash
npm test -- src/config/pelegriniHome.test.ts src/config/pelegriniIdentity.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Search for forbidden home residue**

Run:

```bash
rg "Powered by React|BI Reports|rounded-3xl|backdrop-blur-xl|Sparkles" src/pages/HomePage.tsx src/pages/HomeMobilePage.tsx
```

Expected: no output.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/config/pelegriniHome.ts src/config/pelegriniHome.test.ts src/pages/HomePage.tsx src/pages/HomeMobilePage.tsx
git commit -m "feat: redesign pelegrini command home"
```

---

### Task 3: Filial Selector Redesign

**Files:**
- Modify: `src/components/common/FilialSelectorDialog.tsx`
- Test: add assertions to `src/components/pelegrini/PelegriniVisuals.test.tsx` or create `src/components/common/FilialSelectorDialog.test.tsx` if existing test setup is simple.

**Interfaces:**
- Consumes:
  - `PelegriniBranchPanel`
  - `getPelegriniIdentity`
  - current `getFilialAccessState`
  - current `useFilialSelecionada`
- Produces:
  - Visual branch selector with CT/CCH personality and mobile-safe text.

- [ ] **Step 1: Write selector rendering test**

If there is no existing selector test harness, add a focused test file with mocked contexts:

```tsx
it('shows branch-specific operational indicators in filial selector', () => {
  render(<FilialSelectorDialog open onOpenChange={() => undefined} codEmpresa="1004" />);

  expect(screen.getByText('Cambio')).toBeInTheDocument();
  expect(screen.getByText('Diferencial')).toBeInTheDocument();
  expect(screen.getByText('Original GM')).toBeInTheDocument();
  expect(screen.getByText('Desde 1992')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run selector test and verify failure**

Run: `npm test -- src/components/common/FilialSelectorDialog.test.tsx --run`

Expected: FAIL if the new indicators are not rendered.

- [ ] **Step 3: Implement selector layout**

Modify `FilialSelectorDialog.tsx`:

- Replace list-style filial button with a responsive grid:

```tsx
<div className="grid gap-3 py-2 sm:grid-cols-2">
```

- Render each filial using `PelegriniBranchPanel`.
- Keep `blocked`, `active`, and confirm behavior exactly as-is.
- Keep buttons `Voltar/Cancelar` and `Acessar`.
- Make blocked state explicit with a small `Lock` row below the panel, not squeezed into the title line.

- [ ] **Step 4: Run selector tests**

Run: `npm test -- src/components/common/FilialSelectorDialog.test.tsx src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/components/common/FilialSelectorDialog.tsx src/components/common/FilialSelectorDialog.test.tsx src/components/pelegrini/PelegriniVisuals.test.tsx
git commit -m "feat: redesign pelegrini branch selector"
```

---

### Task 4: Sidebars and Module Shell Cleanup

**Files:**
- Modify: `src/components/pelegrini/PelegriniModuleShell.tsx`
- Modify: `src/components/layout/ComercialSidebar.tsx`
- Modify: `src/components/layout/FinanceiroSidebar.tsx`
- Modify: `src/components/layout/OperacionalSidebar.tsx`
- Modify: `src/components/layout/WhatsappSidebar.tsx`
- Test: `src/components/layout/ComercialSidebar.test.ts`

**Interfaces:**
- Consumes:
  - `getPelegriniIdentity`
  - `PelegriniBrandMark`
  - current route/menu arrays.
- Produces:
  - Sidebars with no `BI Reports`, no generic footer, and technical active state.

- [ ] **Step 1: Add sidebar copy assertion**

Update `ComercialSidebar.test.ts`:

```tsx
it('uses Pelegrini footer copy instead of legacy BI Reports copy', () => {
  renderSidebarForCompany('1004');

  expect(screen.getByText(/Pelegrini/i)).toBeInTheDocument();
  expect(screen.queryByText(/BI Reports/i)).not.toBeInTheDocument();
});
```

Use the existing render helper in that file; if the helper has a different name, use the local helper already used by current tests.

- [ ] **Step 2: Run sidebar test and verify failure**

Run: `npm test -- src/components/layout/ComercialSidebar.test.ts --run`

Expected: FAIL while `BI Reports v1.0.0` remains.

- [ ] **Step 3: Replace sidebar footers**

For each sidebar footer, replace:

```tsx
<p>BI Reports v1.0.0</p>
<p className="mt-1">Módulo Comercial</p>
```

with:

```tsx
<p className="font-medium text-sidebar-foreground">Pelegrini</p>
<p className="mt-1">{identity.footerLine}</p>
```

Use:

```tsx
const identity = getPelegriniIdentity(theme.key);
```

- [ ] **Step 4: Reduce generic sidebar effects**

In the sidebars:

- Replace gradient separators with solid sidebar-border separators:

```tsx
<div className="mx-4 mt-4 h-px bg-sidebar-border" />
```

- Keep active route behavior and paths unchanged.
- Keep mobile button and overlay behavior unchanged.

- [ ] **Step 5: Run sidebar tests**

Run: `npm test -- src/components/layout/ComercialSidebar.test.ts --run`

Expected: PASS.

- [ ] **Step 6: Search sidebar residue**

Run:

```bash
rg "BI Reports|bg-gradient-to-r|badge-pulse" src/components/layout/ComercialSidebar.tsx src/components/layout/FinanceiroSidebar.tsx src/components/layout/OperacionalSidebar.tsx src/components/layout/WhatsappSidebar.tsx
```

Expected: no `BI Reports`; gradients only if they serve a clearly functional indicator.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/components/pelegrini/PelegriniModuleShell.tsx src/components/layout/ComercialSidebar.tsx src/components/layout/FinanceiroSidebar.tsx src/components/layout/OperacionalSidebar.tsx src/components/layout/WhatsappSidebar.tsx src/components/layout/ComercialSidebar.test.ts
git commit -m "feat: align module sidebars with pelegrini identity"
```

---

### Task 5: Common States and Representative Module Headers

**Files:**
- Modify: `src/components/common/EmptyState.tsx`
- Modify: `src/components/common/ErrorState.tsx`
- Modify: `src/components/common/LoadingState.tsx`
- Create: `src/components/pelegrini/PelegriniModuleHeader.tsx`
- Modify: `src/components/pelegrini/index.ts`
- Modify: `src/pages/comercial/ProdutosPage.tsx`
- Modify: `src/pages/operacional/EstoquePage.tsx`
- Modify: `src/pages/financeiro/ResumoPage.tsx`
- Modify: `src/pages/whatsapp/ChatPage.tsx`

**Interfaces:**
- Produces:
  - `<PelegriniModuleHeader title subtitle moduleKey />`
- Consumes:
  - `getPelegriniIdentity`
  - `getPelegriniModuleIdentity`
  - `useFilialSelecionada`

- [ ] **Step 1: Add module header smoke test**

Extend `src/components/pelegrini/PelegriniVisuals.test.tsx`:

```tsx
it('renders module header with operational language', () => {
  render(<PelegriniModuleHeader title="Produtos" subtitle="Carteira de pecas" moduleKey="comercial" />);

  expect(screen.getByText('Produtos')).toBeInTheDocument();
  expect(screen.getByText(/Pedidos e carteira/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run header smoke test and verify failure**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: FAIL because `PelegriniModuleHeader` does not exist.

- [ ] **Step 3: Implement module header**

Create `src/components/pelegrini/PelegriniModuleHeader.tsx`:

```tsx
export function PelegriniModuleHeader({ title, subtitle, moduleKey }: PelegriniModuleHeaderProps) {
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const identity = getPelegriniIdentity(theme.key);
  const moduleIdentity = getPelegriniModuleIdentity(moduleKey);

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {identity.eyebrow} / {moduleIdentity.operationalLabel}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <PelegriniBranchBadge theme={theme} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update common states**

Change common states to use:

```tsx
'rounded-xl border border-border bg-card p-8 text-center shadow-sm'
```

Remove `backdrop-blur-xl`.

Use copy defaults:

- Error title: `Nao foi possivel carregar os dados da operacao`
- Error description: `Confira endpoint, periodo e filial selecionada.`
- Empty title: `Nenhum dado encontrado para esta filial`
- Loading title: `Carregando operacao Pelegrini`

Preserve incoming `title`, `description`, and icon props.

- [ ] **Step 5: Apply module headers to representative pages**

Add `PelegriniModuleHeader` near the top of:

- `ProdutosPage.tsx`: `moduleKey="comercial"`
- `EstoquePage.tsx`: `moduleKey="operacional"`
- `ResumoPage.tsx`: `moduleKey="financeiro"`
- `ChatPage.tsx`: `moduleKey="whatsapp"` where it does not break the three-column chat structure.

Do not alter hooks, filters, or data rendering.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx src/components/layout/ComercialSidebar.test.ts --run
```

Expected: PASS.

- [ ] **Step 7: Search common residue**

Run:

```bash
rg "backdrop-blur-xl|BI Reports|Powered by React" src/components/common src/components/pelegrini src/pages/comercial/ProdutosPage.tsx src/pages/operacional/EstoquePage.tsx src/pages/financeiro/ResumoPage.tsx src/pages/whatsapp/ChatPage.tsx
```

Expected: no forbidden residue in changed surfaces.

- [ ] **Step 8: Commit Task 5**

```bash
git add src/components/common/EmptyState.tsx src/components/common/ErrorState.tsx src/components/common/LoadingState.tsx src/components/pelegrini src/pages/comercial/ProdutosPage.tsx src/pages/operacional/EstoquePage.tsx src/pages/financeiro/ResumoPage.tsx src/pages/whatsapp/ChatPage.tsx
git commit -m "feat: brand pelegrini states and module headers"
```

---

### Task 6: Verification, Visual Audit, and Publish Decision

**Files:**
- No production file changes expected.
- Update SDD/progress notes if using subagent-driven development.

**Interfaces:**
- Consumes all previous task outputs.
- Produces a verified branch ready for user-approved GitHub/Cloudflare publication.

- [ ] **Step 1: Run formatting residue checks**

Run:

```bash
rg "Powered by React|BI Reports|Lovable" src public index.html
rg "rounded-3xl|backdrop-blur-xl|glass|Sparkles" src/pages/HomePage.tsx src/pages/HomeMobilePage.tsx src/components/pelegrini src/components/common src/components/layout
git diff --check
```

Expected:

- First command has no main-experience matches.
- Second command has no matches in home/pelegrini/common/layout files unless a reviewed exception is recorded.
- `git diff --check` exits 0.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/config/pelegriniIdentity.test.ts src/config/pelegriniHome.test.ts src/config/pelegriniTheme.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx src/components/layout/ComercialSidebar.test.ts --run
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS. Known non-blocking warnings may remain: Browserslist old data, large bundle, and existing xlsx chunk warning.

- [ ] **Step 4: Run full suite once**

Run: `npm test -- --run`

Expected: if the same two `ReceitaDetalheDialog.test.tsx` Excel tests fail and no new tests fail, record as known external gap. If new tests fail, fix before continuing.

- [ ] **Step 5: Browser visual audit**

Start or reuse local server at `http://127.0.0.1:8081/`.

Check:

- `/` desktop.
- `/` at mobile widths 320px and 375px.
- Filial selector modal.
- `/comercial/produtos`.
- `/operacional/estoque`.
- `/financeiro/resumo`.
- `/whatsapp`.

Acceptance:

- No blank screens.
- No console errors from the redesign.
- Home clearly reads as Pelegrini, not a generic template.
- CT and CCH look distinct.
- No text clipping in branch cards.
- Mobile sidebar opens above content.

- [ ] **Step 6: Commit verification notes if needed**

If only progress notes changed:

```bash
git status --short
```

Do not commit `.superpowers` unless it is intentionally tracked by the current workflow.

- [ ] **Step 7: Stop for publication approval**

Report:

- Git commit range.
- Tests/build results.
- Known full-suite Excel gap if still present.
- Local browser audit result.

Ask before pushing to `master` and relying on Cloudflare Pages deployment.

---

## Self-Review

### Spec coverage

- Home desktop/mobile: Task 2.
- Filial selector: Task 3.
- Sidebars/shell: Task 4.
- Common states: Task 5.
- Representative module surfaces: Task 5.
- Removal of `Powered by React`, `BI Reports`, and template residue: Tasks 2, 4, 5, 6.
- Responsiveness and browser validation: Task 6.
- No business/data changes: Global constraints repeated and scoped file list avoids data hooks/API files.

### Placeholder scan

Placeholder scan passed. Each task has concrete files, commands, expected outcomes, and commit instructions.

### Type consistency

The produced identities and components from Task 1 are consumed by Tasks 2-5 with stable names:

- `getPelegriniIdentity`
- `getPelegriniModuleIdentity`
- `PelegriniOperationalCard`
- `PelegriniBranchPanel`
- `PelegriniModuleHeader`
