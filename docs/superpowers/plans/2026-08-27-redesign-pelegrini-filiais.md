# Redesign Pelegrini por Filial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar uma identidade visual Pelegrini com temas especificos para Casa da Transmissao e Casa do Chevrolet na home, layouts internos, navegacao e componentes comuns.

**Architecture:** Criar uma camada central de tema em `src/config/pelegriniTheme.ts` e componentes compartilhados em `src/components/pelegrini/`. A home e os layouts internos passam a consumir estes temas conforme filial ativa, preservando rotas, endpoints, permissoes e filtros existentes.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Vitest, lucide-react, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-27-redesign-pelegrini-filiais-design.md`

## Global Constraints

- O redesign nao deve alterar endpoints, calculos, regras de filial, permissoes, autenticacao, filtros comerciais/financeiros ou rotas existentes.
- A home de modulos deve parecer claramente Pelegrini, nao um template universal.
- A filial CT deve ter visual proprio e coerente com Casa da Transmissao.
- A filial CCH deve ter visual proprio e coerente com Casa do Chevrolet.
- O layout deve permanecer denso, rapido e claro para gestao, sem virar landing page.
- Animacoes devem respeitar `prefers-reduced-motion`.
- Texto nao pode sobrepor elementos em desktop ou mobile.
- O sistema deve continuar buildando.

---

## File Structure

- Create `src/config/pelegriniTheme.ts`: tema base, tema por filial, resolucao de tema e metadados de negocio.
- Create `src/config/pelegriniTheme.test.ts`: testes de resolucao de tema.
- Create `src/components/pelegrini/PelegriniBrandMark.tsx`: marca compacta Pelegrini/filial.
- Create `src/components/pelegrini/PelegriniMotionBackdrop.tsx`: fundo automotivo animado e acessivel.
- Create `src/components/pelegrini/PelegriniBranchBadge.tsx`: badge visual da filial ativa.
- Create `src/components/pelegrini/PelegriniModuleShell.tsx`: shell compartilhado para modulos internos.
- Modify `src/index.css`: tokens/classes Pelegrini para superficies, animacoes e temas por filial.
- Modify `src/pages/HomePage.tsx`: home desktop com identidade Pelegrini.
- Modify `src/pages/HomeMobilePage.tsx`: home mobile com identidade Pelegrini.
- Modify `src/components/common/FilialBadge.tsx`: badge de filial usando tema.
- Modify `src/components/common/FilialSelectorDialog.tsx`: seletor visual com microinteracoes.
- Modify `src/components/layout/ComercialLayout.tsx`, `OperacionalLayout.tsx`, `FinanceiroLayout.tsx`, `WhatsappLayout.tsx`: aplicar shell compartilhado.
- Modify sidebars: `ComercialSidebar.tsx`, `OperacionalSidebar.tsx`, `FinanceiroSidebar.tsx`, `WhatsappSidebar.tsx`.
- Test existing impacted layout/config tests after each task.

---

### Task 1: Pelegrini Theme Foundation

**Files:**
- Create: `src/config/pelegriniTheme.ts`
- Create: `src/config/pelegriniTheme.test.ts`
- Modify: `src/config/filiaisEmpresa.ts`

**Interfaces:**
- Consumes: filial ids `transmissao` and `chevrolet` from `src/config/filiaisEmpresa.ts`.
- Produces:
  - `type PelegriniThemeKey = 'pelegrini' | 'transmissao' | 'chevrolet'`
  - `interface PelegriniTheme`
  - `const PELEGRINI_THEMES: Record<PelegriniThemeKey, PelegriniTheme>`
  - `function resolvePelegriniTheme(filialId?: string | null): PelegriniTheme`
  - `function getPelegriniThemeKey(filialId?: string | null): PelegriniThemeKey`

- [ ] **Step 1: Write the failing theme test**

Create `src/config/pelegriniTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getPelegriniThemeKey, resolvePelegriniTheme } from './pelegriniTheme';

describe('pelegriniTheme', () => {
  it('resolves the neutral Pelegrini theme when no branch is active', () => {
    const theme = resolvePelegriniTheme(null);

    expect(getPelegriniThemeKey(null)).toBe('pelegrini');
    expect(theme.name).toBe('Pelegrini');
    expect(theme.tagline).toContain('gestao');
    expect(theme.logoSrc).toBe('/brand/pelegrini-icon.svg');
  });

  it('resolves Casa da Transmissao with heavy parts vocabulary', () => {
    const theme = resolvePelegriniTheme('transmissao');

    expect(getPelegriniThemeKey('transmissao')).toBe('transmissao');
    expect(theme.name).toBe('Casa da Transmissão');
    expect(theme.businessWords).toEqual(expect.arrayContaining(['Câmbio', 'Diferencial', 'Motor']));
    expect(theme.motion).toBe('transmission');
  });

  it('resolves Casa do Chevrolet with original parts vocabulary', () => {
    const theme = resolvePelegriniTheme('chevrolet');

    expect(getPelegriniThemeKey('chevrolet')).toBe('chevrolet');
    expect(theme.name).toBe('Casa do Chevrolet');
    expect(theme.businessWords).toEqual(expect.arrayContaining(['Peças originais', 'Freio', 'Arrefecimento']));
    expect(theme.motion).toBe('chevrolet');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/config/pelegriniTheme.test.ts --run`

Expected: FAIL because `src/config/pelegriniTheme.ts` does not exist.

- [ ] **Step 3: Implement the theme config**

Create `src/config/pelegriniTheme.ts`:

```ts
export type PelegriniThemeKey = 'pelegrini' | 'transmissao' | 'chevrolet';

export interface PelegriniTheme {
  key: PelegriniThemeKey;
  name: string;
  shortName: string;
  tagline: string;
  logoSrc: string;
  logoAlt: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  glow: string;
  motion: 'group' | 'transmission' | 'chevrolet';
  businessWords: string[];
  trustSignals: string[];
}

export const PELEGRINI_THEMES: Record<PelegriniThemeKey, PelegriniTheme> = {
  pelegrini: {
    key: 'pelegrini',
    name: 'Pelegrini',
    shortName: 'Grupo Pelegrini',
    tagline: 'gestao integrada das filiais automotivas',
    logoSrc: '/brand/pelegrini-icon.svg',
    logoAlt: 'Marca Pelegrini',
    primary: '#073F73',
    secondary: '#0B5A9E',
    accent: '#22C7E8',
    surface: '#081827',
    glow: 'rgba(34, 199, 232, 0.28)',
    motion: 'group',
    businessWords: ['Comercial', 'Operacional', 'Financeiro', 'Atendimento'],
    trustSignals: ['Gestão integrada', 'Filiais conectadas', 'Decisão rápida'],
  },
  transmissao: {
    key: 'transmissao',
    name: 'Casa da Transmissão',
    shortName: 'CT',
    tagline: 'pecas tecnicas para cambio, diferencial e motor',
    logoSrc: '/brand/casa-transmissao.png',
    logoAlt: 'Logo Casa da Transmissão',
    primary: '#073F73',
    secondary: '#0A5291',
    accent: '#49D2FF',
    surface: '#061626',
    glow: 'rgba(73, 210, 255, 0.26)',
    motion: 'transmission',
    businessWords: ['Câmbio', 'Diferencial', 'Motor', 'Óleos e aditivos'],
    trustSignals: ['ZF', 'Eaton', 'MWM', 'Meritor'],
  },
  chevrolet: {
    key: 'chevrolet',
    name: 'Casa do Chevrolet',
    shortName: 'CCH',
    tagline: 'pecas originais Chevrolet com atendimento especializado',
    logoSrc: '/brand/casa-chevrolet.png',
    logoAlt: 'Logo Casa do Chevrolet',
    primary: '#034E99',
    secondary: '#0A67BF',
    accent: '#FFFFFF',
    surface: '#061B34',
    glow: 'rgba(3, 78, 153, 0.28)',
    motion: 'chevrolet',
    businessWords: ['Peças originais', 'Freio', 'Arrefecimento', 'Motor'],
    trustSignals: ['Desde 1992', 'Entrega rápida', 'Atendimento especializado'],
  },
};

export function getPelegriniThemeKey(filialId?: string | null): PelegriniThemeKey {
  if (filialId === 'transmissao') return 'transmissao';
  if (filialId === 'chevrolet') return 'chevrolet';
  return 'pelegrini';
}

export function resolvePelegriniTheme(filialId?: string | null): PelegriniTheme {
  return PELEGRINI_THEMES[getPelegriniThemeKey(filialId)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/config/pelegriniTheme.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Run existing branch asset tests**

Run: `npm test -- src/config/brandAssets.test.ts src/config/pelegriniTheme.test.ts --run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config/pelegriniTheme.ts src/config/pelegriniTheme.test.ts
git commit -m "feat: add pelegrini branch themes"
```

---

### Task 2: Pelegrini Shared Visual Components

**Files:**
- Create: `src/components/pelegrini/PelegriniBrandMark.tsx`
- Create: `src/components/pelegrini/PelegriniBranchBadge.tsx`
- Create: `src/components/pelegrini/PelegriniMotionBackdrop.tsx`
- Create: `src/components/pelegrini/index.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `PelegriniTheme` from `src/config/pelegriniTheme.ts`.
- Produces:
  - `PelegriniBrandMark({ theme, compact, className })`
  - `PelegriniBranchBadge({ theme, active, className })`
  - `PelegriniMotionBackdrop({ theme, intensity, className })`

- [ ] **Step 1: Write a component smoke test**

Create `src/components/pelegrini/PelegriniVisuals.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark } from './PelegriniBrandMark';
import { PelegriniBranchBadge } from './PelegriniBranchBadge';

describe('Pelegrini visual components', () => {
  it('renders a branch brand mark with logo and name', () => {
    const theme = resolvePelegriniTheme('transmissao');

    render(<PelegriniBrandMark theme={theme} />);

    expect(screen.getByAltText('Logo Casa da Transmissão')).toBeInTheDocument();
    expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
  });

  it('renders branch trust signals', () => {
    const theme = resolvePelegriniTheme('chevrolet');

    render(<PelegriniBranchBadge theme={theme} active />);

    expect(screen.getByText('Casa do Chevrolet')).toBeInTheDocument();
    expect(screen.getByText('Desde 1992')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `PelegriniBrandMark`**

Create `src/components/pelegrini/PelegriniBrandMark.tsx`:

```tsx
import { cn } from '@/lib/utils';
import type { PelegriniTheme } from '@/config/pelegriniTheme';

interface PelegriniBrandMarkProps {
  theme: PelegriniTheme;
  compact?: boolean;
  className?: string;
}

export function PelegriniBrandMark({ theme, compact = false, className }: PelegriniBrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-3 min-w-0', className)}>
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm"
        style={{ boxShadow: `0 14px 34px -20px ${theme.glow}` }}
      >
        <img src={theme.logoSrc} alt={theme.logoAlt} className="max-h-10 max-w-10 object-contain" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{theme.name}</p>
          <p className="truncate text-xs text-muted-foreground">{theme.tagline}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `PelegriniBranchBadge`**

Create `src/components/pelegrini/PelegriniBranchBadge.tsx`:

```tsx
import { cn } from '@/lib/utils';
import type { PelegriniTheme } from '@/config/pelegriniTheme';

interface PelegriniBranchBadgeProps {
  theme: PelegriniTheme;
  active?: boolean;
  className?: string;
}

export function PelegriniBranchBadge({ theme, active = false, className }: PelegriniBranchBadgeProps) {
  const signal = theme.trustSignals[0];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all',
        active ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground',
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.accent }} />
      <span>{theme.name}</span>
      <span className="text-muted-foreground">•</span>
      <span>{signal}</span>
    </div>
  );
}
```

- [ ] **Step 5: Implement `PelegriniMotionBackdrop`**

Create `src/components/pelegrini/PelegriniMotionBackdrop.tsx`:

```tsx
import { cn } from '@/lib/utils';
import type { PelegriniTheme } from '@/config/pelegriniTheme';

interface PelegriniMotionBackdropProps {
  theme: PelegriniTheme;
  intensity?: 'soft' | 'strong';
  className?: string;
}

export function PelegriniMotionBackdrop({ theme, intensity = 'soft', className }: PelegriniMotionBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pelegrini-motion-backdrop pointer-events-none absolute inset-0 overflow-hidden', className)}
      data-motion={theme.motion}
      data-intensity={intensity}
      style={{
        '--pelegrini-primary': theme.primary,
        '--pelegrini-secondary': theme.secondary,
        '--pelegrini-accent': theme.accent,
      } as React.CSSProperties}
    >
      <span className="pelegrini-motion-line line-one" />
      <span className="pelegrini-motion-line line-two" />
      <span className="pelegrini-motion-gear" />
    </div>
  );
}
```

- [ ] **Step 6: Export components**

Create `src/components/pelegrini/index.ts`:

```ts
export { PelegriniBrandMark } from './PelegriniBrandMark';
export { PelegriniBranchBadge } from './PelegriniBranchBadge';
export { PelegriniMotionBackdrop } from './PelegriniMotionBackdrop';
```

- [ ] **Step 7: Add CSS utilities**

Append to `src/index.css` inside `@layer utilities`:

```css
.pelegrini-motion-backdrop {
  opacity: 0.9;
}

.pelegrini-motion-line {
  position: absolute;
  height: 2px;
  width: 38%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--pelegrini-accent), transparent);
  opacity: 0.22;
  animation: pelegriniMotionSweep 9s linear infinite;
}

.pelegrini-motion-line.line-one {
  top: 18%;
  left: -20%;
}

.pelegrini-motion-line.line-two {
  bottom: 22%;
  right: -18%;
  animation-delay: -4s;
}

.pelegrini-motion-gear {
  position: absolute;
  right: 8%;
  top: 18%;
  width: 160px;
  height: 160px;
  border: 1px solid color-mix(in srgb, var(--pelegrini-accent) 45%, transparent);
  border-radius: 999px;
  opacity: 0.18;
  animation: pelegriniGearTurn 26s linear infinite;
}

.pelegrini-motion-gear::before,
.pelegrini-motion-gear::after {
  content: '';
  position: absolute;
  inset: 22%;
  border: 1px dashed color-mix(in srgb, var(--pelegrini-accent) 60%, transparent);
  border-radius: inherit;
}

.pelegrini-motion-backdrop[data-motion='chevrolet'] .pelegrini-motion-gear {
  border-radius: 22px;
  transform: rotate(8deg);
}

@media (prefers-reduced-motion: reduce) {
  .pelegrini-motion-line,
  .pelegrini-motion-gear {
    animation: none;
  }
}

@keyframes pelegriniMotionSweep {
  from { transform: translateX(0); }
  to { transform: translateX(360%); }
}

@keyframes pelegriniGearTurn {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 8: Run component tests**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx src/config/pelegriniTheme.test.ts --run`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/pelegrini src/index.css
git commit -m "feat: add pelegrini visual primitives"
```

---

### Task 3: Redesign Desktop Home

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/config/pelegriniHome.ts`
- Test: `src/config/pelegriniHome.test.ts`

**Interfaces:**
- Consumes: `PELEGRINI_THEMES`, `PelegriniBrandMark`, `PelegriniMotionBackdrop`, existing auth/module permissions.
- Produces: Redesigned desktop home with neutral Pelegrini hero, branch identity rail and existing module navigation behavior.

- [ ] **Step 1: Update home config test**

Modify `src/config/pelegriniHome.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { pelegriniBrand, pelegriniModules } from './pelegriniHome';

describe('pelegriniHome', () => {
  it('uses Pelegrini as the visible product brand', () => {
    expect(pelegriniBrand.name).toBe('Pelegrini');
    expect(pelegriniBrand.headline).toContain('Pelegrini');
  });

  it('defines the four main Pelegrini modules in order', () => {
    expect(pelegriniModules.map((module) => module.title)).toEqual([
      'WhatsApp',
      'Comercial',
      'Operacional',
      'Financeiro',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails if headline is still generic**

Run: `npm test -- src/config/pelegriniHome.test.ts --run`

Expected: FAIL if `pelegriniBrand.headline` does not contain `Pelegrini`.

- [ ] **Step 3: Update brand copy**

Modify `src/config/pelegriniHome.ts`:

```ts
export const pelegriniBrand = {
  name: 'Pelegrini',
  subtitle: 'Gestao automotiva por filial',
  eyebrow: 'Grupo Pelegrini',
  headline: 'Pelegrini em tempo real: vendas, estoque, financeiro e atendimento por filial',
  footer: 'Pelegrini · Casa da Transmissao · Casa do Chevrolet',
  version: 'v1.0.0',
} as const;
```

- [ ] **Step 4: Refactor HomePage imports**

In `src/pages/HomePage.tsx`, add:

```ts
import { PELEGRINI_THEMES, resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark, PelegriniBranchBadge, PelegriniMotionBackdrop } from '@/components/pelegrini';
```

- [ ] **Step 5: Add neutral theme to `HomePage`**

Inside `HomePage`, after hooks:

```ts
const homeTheme = resolvePelegriniTheme(null);
const branchThemes = [PELEGRINI_THEMES.transmissao, PELEGRINI_THEMES.chevrolet];
```

- [ ] **Step 6: Replace desktop page background**

Change root desktop wrapper to:

```tsx
<div
  className="min-h-screen relative overflow-hidden bg-background"
  style={{
    background:
      'radial-gradient(circle at top left, rgba(73,210,255,0.14), transparent 30%), radial-gradient(circle at top right, rgba(3,78,153,0.16), transparent 28%), hsl(var(--background))',
  }}
>
  <PelegriniMotionBackdrop theme={homeTheme} />
```

- [ ] **Step 7: Replace header brand block**

Use:

```tsx
<PelegriniBrandMark theme={homeTheme} />
```

Keep login, logout, settings and theme toggle behavior unchanged.

- [ ] **Step 8: Replace hero content**

Use:

```tsx
<section className="relative mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 shadow-xl shadow-primary/5 backdrop-blur-xl">
  <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
    <div>
      <div className="mb-3 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {pelegriniBrand.eyebrow}
      </div>
      <h2 className="max-w-3xl text-3xl font-bold leading-tight text-foreground">
        {pelegriniBrand.headline}
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Uma central executiva para acompanhar Casa da Transmissão e Casa do Chevrolet sem perder velocidade de decisão.
      </p>
    </div>
    <div className="grid gap-3">
      {branchThemes.map((theme) => (
        <PelegriniBranchBadge key={theme.key} theme={theme} />
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 9: Keep module cards but update visual language**

Inside `ModuleCard`, preserve click logic and replace icon wrapper gradient maps with branch-inspired colors:

```ts
const accentMap: Record<string, { border: string; text: string; glow: string; rgb: string }> = {
  WhatsApp: { border: 'hover:border-cyan-500/40', text: 'text-cyan-400', glow: 'group-hover:shadow-cyan-500/20', rgb: '34,199,232' },
  Comercial: { border: 'hover:border-blue-500/40', text: 'text-blue-400', glow: 'group-hover:shadow-blue-500/20', rgb: '3,78,153' },
  Operacional: { border: 'hover:border-sky-500/40', text: 'text-sky-400', glow: 'group-hover:shadow-sky-500/20', rgb: '73,210,255' },
  Financeiro: { border: 'hover:border-emerald-500/40', text: 'text-emerald-400', glow: 'group-hover:shadow-emerald-500/20', rgb: '16,185,129' },
};
```

- [ ] **Step 10: Run tests**

Run: `npm test -- src/config/pelegriniHome.test.ts src/config/pelegriniTheme.test.ts --run`

Expected: PASS.

- [ ] **Step 11: Run build**

Run: `npm run build`

Expected: PASS with only existing warnings allowed.

- [ ] **Step 12: Commit**

```bash
git add src/pages/HomePage.tsx src/config/pelegriniHome.ts src/config/pelegriniHome.test.ts
git commit -m "feat: redesign pelegrini home"
```

---

### Task 4: Redesign Mobile Home

**Files:**
- Modify: `src/pages/HomeMobilePage.tsx`

**Interfaces:**
- Consumes: same theme primitives as desktop home.
- Produces: Mobile home with compact Pelegrini header, branch chips and existing module navigation behavior.

- [ ] **Step 1: Read current mobile home**

Run: `Get-Content src/pages/HomeMobilePage.tsx`

Expected: Identify current brand/header/module card structure.

- [ ] **Step 2: Add imports**

Add:

```ts
import { PELEGRINI_THEMES, resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark, PelegriniBranchBadge, PelegriniMotionBackdrop } from '@/components/pelegrini';
```

- [ ] **Step 3: Add mobile theme constants**

Inside component:

```ts
const homeTheme = resolvePelegriniTheme(null);
const branchThemes = [PELEGRINI_THEMES.transmissao, PELEGRINI_THEMES.chevrolet];
```

- [ ] **Step 4: Replace top brand/header**

Use compact structure:

```tsx
<div className="relative overflow-hidden border-b border-border/60 bg-card/80 px-4 py-4 backdrop-blur-xl">
  <PelegriniMotionBackdrop theme={homeTheme} intensity="soft" />
  <div className="relative z-10">
    <PelegriniBrandMark theme={homeTheme} />
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {branchThemes.map((theme) => (
        <PelegriniBranchBadge key={theme.key} theme={theme} />
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Keep module routing logic unchanged**

Confirm these remain unchanged:

```ts
navigate(path)
setEmpresaSelectorOpen(true)
setFilialDialogOpen(true)
```

- [ ] **Step 6: Run mobile/home tests**

Run: `npm test -- src/config/pelegriniHome.test.ts --run`

Expected: PASS.

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/HomeMobilePage.tsx
git commit -m "feat: redesign pelegrini mobile home"
```

---

### Task 5: Shared Module Shell

**Files:**
- Create: `src/components/pelegrini/PelegriniModuleShell.tsx`
- Modify: `src/components/pelegrini/index.ts`
- Modify: `src/components/layout/ComercialLayout.tsx`
- Modify: `src/components/layout/OperacionalLayout.tsx`
- Modify: `src/components/layout/FinanceiroLayout.tsx`
- Modify: `src/components/layout/WhatsappLayout.tsx`

**Interfaces:**
- Consumes: `useFilialSelecionada`, `resolvePelegriniTheme`.
- Produces: wrapper that sets visual theme variables and background for module content.

- [ ] **Step 1: Create shell component**

Create `src/components/pelegrini/PelegriniModuleShell.tsx`:

```tsx
import { ReactNode } from 'react';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniMotionBackdrop } from './PelegriniMotionBackdrop';
import { cn } from '@/lib/utils';

interface PelegriniModuleShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  className?: string;
}

export function PelegriniModuleShell({ children, sidebar, className }: PelegriniModuleShellProps) {
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);

  return (
    <div
      className={cn('min-h-screen flex w-full bg-background relative overflow-hidden', className)}
      data-pelegrini-theme={theme.key}
      style={{
        '--pelegrini-primary': theme.primary,
        '--pelegrini-secondary': theme.secondary,
        '--pelegrini-accent': theme.accent,
      } as React.CSSProperties}
    >
      <PelegriniMotionBackdrop theme={theme} intensity="soft" className="opacity-40" />
      <div className="relative z-10">{sidebar}</div>
      <main className="relative z-10 flex-1 md:ml-64 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Export shell**

Add to `src/components/pelegrini/index.ts`:

```ts
export { PelegriniModuleShell } from './PelegriniModuleShell';
```

- [ ] **Step 3: Apply shell to ComercialLayout**

Replace desktop wrapper:

```tsx
<PelegriniModuleShell sidebar={<ComercialSidebar />}>
  {bloquearConteudo ? placeholder : <Outlet />}
</PelegriniModuleShell>
```

Import:

```ts
import { PelegriniModuleShell } from '@/components/pelegrini';
```

- [ ] **Step 4: Apply shell to OperacionalLayout**

Use:

```tsx
<PelegriniModuleShell sidebar={<OperacionalSidebar />}>
  <Outlet />
</PelegriniModuleShell>
```

- [ ] **Step 5: Apply shell to FinanceiroLayout**

Use:

```tsx
<PelegriniModuleShell sidebar={<FinanceiroSidebar />}>
  <Outlet />
</PelegriniModuleShell>
```

- [ ] **Step 6: Apply shell to WhatsappLayout**

Use:

```tsx
<PelegriniModuleShell sidebar={<WhatsappSidebar />}>
  <Outlet />
</PelegriniModuleShell>
```

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/pelegrini/PelegriniModuleShell.tsx src/components/pelegrini/index.ts src/components/layout
git commit -m "feat: add pelegrini module shell"
```

---

### Task 6: Sidebar Branding

**Files:**
- Modify: `src/components/layout/ComercialSidebar.tsx`
- Modify: `src/components/layout/OperacionalSidebar.tsx`
- Modify: `src/components/layout/FinanceiroSidebar.tsx`
- Modify: `src/components/layout/WhatsappSidebar.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `useFilialSelecionada`, `resolvePelegriniTheme`, `PelegriniBrandMark`.
- Produces: filial-aware sidebar headers and active states.

- [ ] **Step 1: Add sidebar theme CSS**

Append to `src/index.css`:

```css
.pelegrini-sidebar {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--pelegrini-primary) 28%, hsl(var(--sidebar-background))) 0%, hsl(var(--sidebar-background)) 72%),
    hsl(var(--sidebar-background));
}

.pelegrini-sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(135deg, color-mix(in srgb, var(--pelegrini-accent) 16%, transparent) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.08;
}
```

- [ ] **Step 2: Update ComercialSidebar header**

Add imports:

```ts
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBrandMark } from '@/components/pelegrini';
```

Inside component:

```ts
const { filialAtiva } = useFilialSelecionada();
const theme = resolvePelegriniTheme(filialAtiva);
```

Change `aside` class to include:

```ts
'pelegrini-sidebar relative'
```

Replace header icon block with:

```tsx
<PelegriniBrandMark theme={theme} />
```

Keep module title below or beside it:

```tsx
<span className="text-[11px] text-sidebar-muted uppercase tracking-wider">Comercial ativo</span>
```

- [ ] **Step 3: Repeat header pattern for other sidebars**

Use module labels:

```ts
'Operacional ativo'
'Financeiro ativo'
'WhatsApp ativo'
```

- [ ] **Step 4: Keep existing menu arrays and routes unchanged**

Confirm no edits to `path` values in sidebar menu items.

- [ ] **Step 5: Run existing sidebar test**

Run: `npm test -- src/components/layout/ComercialSidebar.test.ts --run`

Expected: PASS.

- [ ] **Step 6: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/*Sidebar.tsx src/index.css
git commit -m "feat: brand module sidebars by branch"
```

---

### Task 7: Common Branch Context Components

**Files:**
- Modify: `src/components/common/FilialBadge.tsx`
- Modify: `src/components/common/FilialSelectorDialog.tsx`
- Modify: `src/components/common/EmptyState.tsx`
- Modify: `src/components/common/ErrorState.tsx`
- Modify: `src/components/common/LoadingState.tsx`

**Interfaces:**
- Consumes: `resolvePelegriniTheme` and existing filial context.
- Produces: common states and badges visually aligned to active branch.

- [ ] **Step 1: Update FilialBadge**

In `FilialBadge.tsx`, import:

```ts
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
```

After `filialConfig`:

```ts
const theme = resolvePelegriniTheme(filialAtiva);
```

Add inline CSS variables to `Button`:

```tsx
style={{
  '--pelegrini-accent': theme.accent,
} as React.CSSProperties}
```

Add class:

```ts
'border-primary/20 bg-card/70 hover:border-primary/40 hover:shadow-md'
```

- [ ] **Step 2: Update FilialSelectorDialog description**

Replace description text with:

```tsx
Escolha a filial para ajustar visual, filtros e indicadores do painel.
```

- [ ] **Step 3: Add trust signals in FilialSelectorDialog**

For each filial card, resolve theme:

```ts
const branchTheme = resolvePelegriniTheme(f.id);
```

Below the description, render:

```tsx
<div className="mt-2 flex flex-wrap gap-1.5">
  {branchTheme.trustSignals.slice(0, 3).map((signal) => (
    <span key={signal} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      {signal}
    </span>
  ))}
</div>
```

- [ ] **Step 4: Update common state wrappers**

In `EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`, add outer card classes:

```ts
'border border-border/60 bg-card/75 shadow-sm backdrop-blur-xl'
```

Do not change props or exported component names.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/common
git commit -m "feat: align common states with pelegrini branding"
```

---

### Task 8: First Module Refinement Pass

**Files:**
- Modify: `src/pages/comercial/*.tsx` only where page headers are obvious.
- Modify: `src/pages/operacional/*.tsx` only where page headers are obvious.
- Modify: `src/pages/financeiro/*.tsx` only where page headers are obvious.
- Modify: `src/pages/whatsapp/*.tsx` only where page headers are obvious.

**Interfaces:**
- Consumes: shell/sidebar/common theme work.
- Produces: first visible polish pass in one representative page per module.

- [ ] **Step 1: Identify page header patterns**

Run:

```bash
rg -n "page-header|page-title|Dashboard|Resumo|Estoque|Chat" src/pages src/components
```

Expected: list page-level headings and wrappers.

- [ ] **Step 2: Select one representative page per module**

Use:

```txt
Comercial: src/pages/comercial/ProdutosPage.tsx
Operacional: src/pages/operacional/EstoquePage.tsx
Financeiro: src/pages/financeiro/ResumoPage.tsx
WhatsApp: src/pages/whatsapp/ChatPage.tsx
```

- [ ] **Step 3: Add theme imports to each selected page**

Use:

```ts
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBranchBadge } from '@/components/pelegrini';
```

- [ ] **Step 4: Add theme constants to each page**

Inside each component:

```ts
const { filialAtiva } = useFilialSelecionada();
const theme = resolvePelegriniTheme(filialAtiva);
```

- [ ] **Step 5: Add branch badge to each page header**

Place near the title:

```tsx
<PelegriniBranchBadge theme={theme} active />
```

- [ ] **Step 6: Do not change data hooks**

Confirm imports starting with `useComercial`, `useEstoque`, `useResumo`, `useWhatsapp` remain unchanged.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- src/config/pelegriniTheme.test.ts src/config/brandAssets.test.ts --run
```

Expected: PASS.

- [ ] **Step 8: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/pages src/components
git commit -m "feat: add branch context to module pages"
```

---

### Task 9: Visual Verification and Deployment Prep

**Files:**
- No production code changes unless verification exposes a bug.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified local redesign ready for GitHub/Cloudflare.

- [ ] **Step 1: Run full focused test set**

Run:

```bash
npm test -- src/config/brandAssets.test.ts src/config/pelegriniTheme.test.ts src/config/pelegriniHome.test.ts src/components/pelegrini/PelegriniVisuals.test.tsx src/components/layout/ComercialSidebar.test.ts --run
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS with only pre-existing warnings about Browserslist, Tailwind duration, CSS import order, xlsx dynamic/static import and chunk size.

- [ ] **Step 3: Start local server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 8081
```

Expected: localhost available at `http://127.0.0.1:8081/`.

- [ ] **Step 4: Verify desktop home**

Open `http://127.0.0.1:8081/`.

Expected:

- Pelegrini hero appears.
- CT and CCH branch badges appear.
- Module cards still navigate or open required dialogs.
- No text overlap at desktop width.

- [ ] **Step 5: Verify branch modal**

Click the Comercial module as a non-master user or open the filial selector flow.

Expected:

- CT and CCH logos appear.
- Trust signal chips appear.
- Hover/selected states are visible.

- [ ] **Step 6: Verify one page per module**

Open:

```txt
/comercial/dashboard
/operacional/estoque
/financeiro/resumo
/whatsapp
```

Expected:

- Sidebar uses branch-aware branding.
- Page content remains readable.
- No endpoint or auth errors introduced by layout code.

- [ ] **Step 7: Commit verification-only fixes if needed**

If visual verification exposes layout bugs, fix them in the smallest affected file and commit:

```bash
git add <changed-files>
git commit -m "fix: polish pelegrini redesign layout"
```

- [ ] **Step 8: Push to master when user approves deployment**

Run:

```bash
git push origin HEAD:master
```

Expected: Cloudflare Pages deploy starts from the pushed commit.

