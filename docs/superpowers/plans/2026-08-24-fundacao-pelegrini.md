# Fundacao Pelegrini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a entrada oficial do produto Pelegrini com home executiva para WhatsApp, Comercial, Operacional e Financeiro.

**Architecture:** A implementacao deve tratar Pelegrini como uma camada de produto acima dos modulos existentes. A rota raiz passa a renderizar a HomePage, enquanto os layouts internos dos quatro modulos continuam inalterados. Textos e configuracoes visiveis da home ficam centralizados em um arquivo de configuracao para facilitar as proximas etapas.

**Tech Stack:** React 18, Vite 5, TypeScript, React Router, Tailwind CSS, shadcn/ui, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-fundacao-pelegrini-design.md`

## Global Constraints

- A rota raiz `/` deve abrir a home Pelegrini, nao redirecionar direto para Comercial.
- A home deve apresentar os quatro modulos principais: WhatsApp, Comercial, Operacional e Financeiro.
- A marca principal visivel na home deve ser "Pelegrini".
- Os layouts internos existentes dos modulos nao devem ser reescritos nesta etapa.
- Os guards atuais de autenticacao, permissao, empresa e filial devem ser preservados.
- Nenhum schema ou migration Supabase deve ser criado nesta etapa.
- O projeto deve compilar ao final.

---

## File Structure

- Modify: `src/App.tsx`
  - Responsavel por registrar a rota raiz e importar a HomePage.
- Modify: `src/pages/HomePage.tsx`
  - Responsavel pela home desktop Pelegrini, mantendo autenticacao, permissoes e seletores existentes.
- Modify: `src/pages/HomeMobilePage.tsx`
  - Responsavel pela home mobile Pelegrini, mantendo comportamento mobile existente.
- Create: `src/config/pelegriniHome.ts`
  - Responsavel por concentrar marca, textos e metadados dos quatro modulos.
- Create: `src/config/pelegriniHome.test.ts`
  - Responsavel por garantir que a configuracao da home exponha a marca e os quatro modulos esperados.

---

### Task 1: Pelegrini Home Configuration

**Files:**
- Create: `src/config/pelegriniHome.ts`
- Create: `src/config/pelegriniHome.test.ts`

**Interfaces:**
- Consumes: `UserModuleKey` from `src/hooks/useUserModulePermissions.ts`.
- Produces:
  - `pelegriniBrand: { name: string; subtitle: string; eyebrow: string; headline: string; footer: string; version: string }`
  - `pelegriniModules: PelegriniHomeModule[]`
  - `PelegriniHomeModule` with fields `title`, `description`, `path`, `features`, `moduloKey`, `accent`

- [ ] **Step 1: Write the failing config test**

Create `src/config/pelegriniHome.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pelegriniBrand, pelegriniModules } from './pelegriniHome';

describe('pelegriniHome config', () => {
  it('uses Pelegrini as the visible product brand', () => {
    expect(pelegriniBrand.name).toBe('Pelegrini');
    expect(pelegriniBrand.subtitle).toBe('Painel modular de gestao');
    expect(pelegriniBrand.footer).toContain('Pelegrini');
  });

  it('defines the four main Pelegrini modules in order', () => {
    expect(pelegriniModules.map((module) => module.title)).toEqual([
      'WhatsApp',
      'Comercial',
      'Operacional',
      'Financeiro',
    ]);
  });

  it('keeps each module connected to an entry route and permission key', () => {
    expect(pelegriniModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'WhatsApp', path: '/whatsapp', moduloKey: 'whatsapp' }),
        expect.objectContaining({ title: 'Comercial', path: '/comercial/dashboard', moduloKey: 'comercial' }),
        expect.objectContaining({ title: 'Operacional', path: '/operacional/estoque', moduloKey: 'operacional' }),
        expect.objectContaining({ title: 'Financeiro', path: '/financeiro', moduloKey: 'financeiro' }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/config/pelegriniHome.test.ts --run
```

Expected: FAIL because `src/config/pelegriniHome.ts` does not exist.

- [ ] **Step 3: Create the Pelegrini home config**

Create `src/config/pelegriniHome.ts`:

```ts
import type { UserModuleKey } from '@/hooks/useUserModulePermissions';

export interface PelegriniHomeModule {
  title: 'WhatsApp' | 'Comercial' | 'Operacional' | 'Financeiro';
  description: string;
  path: string;
  features: string[];
  moduloKey: UserModuleKey;
  accent: 'emerald' | 'purple' | 'orange' | 'blue';
}

export const pelegriniBrand = {
  name: 'Pelegrini',
  subtitle: 'Painel modular de gestao',
  eyebrow: 'Gestao integrada',
  headline: 'Acompanhe operacao, vendas, financeiro e atendimento em um so lugar',
  footer: 'Pelegrini · Painel modular de gestao',
  version: 'v1.0.0',
} as const;

export const pelegriniModules: PelegriniHomeModule[] = [
  {
    title: 'WhatsApp',
    description: 'Atendimento, conversas, agentes e automacoes em uma rotina organizada.',
    path: '/whatsapp',
    features: ['Chat', 'Agentes', 'Relatorios'],
    moduloKey: 'whatsapp',
    accent: 'emerald',
  },
  {
    title: 'Comercial',
    description: 'Vendas, metas, clientes e performance comercial para decisao rapida.',
    path: '/comercial/dashboard',
    features: ['Metas', 'Clientes', 'Produtos'],
    moduloKey: 'comercial',
    accent: 'purple',
  },
  {
    title: 'Operacional',
    description: 'Estoque, giro e indicadores operacionais para acompanhar a execucao.',
    path: '/operacional/estoque',
    features: ['Estoque', 'Giro', 'Alertas'],
    moduloKey: 'operacional',
    accent: 'orange',
  },
  {
    title: 'Financeiro',
    description: 'Resumo, DRE, variacoes, duplicatas e cobranca em uma visao gerencial.',
    path: '/financeiro',
    features: ['Resumo', 'DRE', 'Cobranca'],
    moduloKey: 'financeiro',
    accent: 'blue',
  },
];
```

- [ ] **Step 4: Run the config test**

Run:

```bash
npm test -- src/config/pelegriniHome.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/pelegriniHome.ts src/config/pelegriniHome.test.ts
git commit -m "feat: add pelegrini home config"
```

---

### Task 2: Desktop Home Entry

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/HomePage.tsx`

**Interfaces:**
- Consumes:
  - `pelegriniBrand`
  - `pelegriniModules`
  - `PelegriniHomeModule`
- Produces:
  - `/` rendering `<HomePage />`
  - Desktop home visible as "Pelegrini"

- [ ] **Step 1: Change the root route**

In `src/App.tsx`, add the import:

```ts
import HomePage from "./pages/HomePage";
```

Replace:

```tsx
<Route path="/" element={<Navigate to="/comercial/dashboard" replace />} />
```

with:

```tsx
<Route path="/" element={<HomePage />} />
```

- [ ] **Step 2: Import the Pelegrini config in HomePage**

In `src/pages/HomePage.tsx`, add:

```ts
import { pelegriniBrand, pelegriniModules, type PelegriniHomeModule } from '@/config/pelegriniHome';
```

Update the local module type usage:

```ts
const modules: Omit<ModuleCardProps, 'index' | 'noAccess' | 'onMasterClick' | 'isMaster' | 'onShowDetails' | 'locked'>[] = [
```

Replace the hardcoded array with a mapping from `pelegriniModules`:

```ts
const modules: Omit<ModuleCardProps, 'index' | 'noAccess' | 'onMasterClick' | 'isMaster' | 'onShowDetails' | 'locked'>[] = pelegriniModules.map((module: PelegriniHomeModule) => {
  const iconMap = {
    WhatsApp: MessageSquare,
    Comercial: ShoppingCart,
    Operacional: Truck,
    Financeiro: TrendingUp,
  } satisfies Record<PelegriniHomeModule['title'], React.ComponentType<{ className?: string }>>;

  const styleMap = {
    emerald: {
      gradient: 'from-emerald-400 via-green-500 to-teal-500',
      glowColor: 'group-hover:shadow-emerald-500/25',
    },
    purple: {
      gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
      glowColor: 'group-hover:shadow-purple-500/25',
    },
    orange: {
      gradient: 'from-amber-400 via-orange-500 to-red-500',
      glowColor: 'group-hover:shadow-orange-500/25',
    },
    blue: {
      gradient: 'from-cyan-400 via-blue-500 to-indigo-500',
      glowColor: 'group-hover:shadow-blue-500/25',
    },
  } satisfies Record<PelegriniHomeModule['accent'], { gradient: string; glowColor: string }>;

  return {
    ...module,
    icon: iconMap[module.title],
    gradient: styleMap[module.accent].gradient,
    glowColor: styleMap[module.accent].glowColor,
    disabled: false,
  };
});
```

- [ ] **Step 3: Replace visible desktop brand copy**

In `src/pages/HomePage.tsx`, replace:

```tsx
<h1 className="text-xl font-bold text-foreground">BI Reports</h1>
<p className="text-xs text-muted-foreground">Sistema Modular de Relatórios</p>
```

with:

```tsx
<h1 className="text-xl font-bold text-foreground">{pelegriniBrand.name}</h1>
<p className="text-xs text-muted-foreground">{pelegriniBrand.subtitle}</p>
```

Replace:

```tsx
Plataforma de Business Intelligence
```

with:

```tsx
{pelegriniBrand.eyebrow}
```

Replace the hero title block with:

```tsx
<h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2 leading-tight">
  {pelegriniBrand.headline}
</h2>
```

Replace:

```tsx
Selecione um módulo para acessar relatórios interativos e análises em tempo real.
```

with:

```tsx
Selecione um modulo para acessar as areas principais do painel.
```

Replace footer text:

```tsx
© 2024 BI Reports · Sistema Modular de Relatórios Operacionais
```

with:

```tsx
© 2026 {pelegriniBrand.footer}
```

Replace:

```tsx
<span className="text-xs text-muted-foreground">v1.0.0</span>
```

with:

```tsx
<span className="text-xs text-muted-foreground">{pelegriniBrand.version}</span>
```

- [ ] **Step 4: Run tests and type build**

Run:

```bash
npm test -- src/config/pelegriniHome.test.ts --run
npm run build
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/HomePage.tsx
git commit -m "feat: route pelegrini home"
```

---

### Task 3: Mobile Home and Final Verification

**Files:**
- Modify: `src/pages/HomeMobilePage.tsx`

**Interfaces:**
- Consumes:
  - `pelegriniBrand`
  - `pelegriniModules`
- Produces:
  - Mobile home copy aligned with Pelegrini
  - Final verified build

- [ ] **Step 1: Inspect current mobile home text**

Run:

```bash
rg "BI Reports|Business Intelligence|Sistema Modular|Módulos|modulos|2024|v1.0.0" src/pages/HomeMobilePage.tsx
```

Expected: shows current visible copy that must be aligned with Pelegrini where present.

- [ ] **Step 2: Import the Pelegrini config**

In `src/pages/HomeMobilePage.tsx`, add:

```ts
import { pelegriniBrand, pelegriniModules } from '@/config/pelegriniHome';
```

- [ ] **Step 3: Replace mobile visible brand copy**

Replace visible brand strings with these values:

```tsx
{pelegriniBrand.name}
{pelegriniBrand.subtitle}
{pelegriniBrand.headline}
```

If the file has a mobile modules array with the same four modules, update its title, description, path and features from `pelegriniModules`. Preserve the existing mobile layout, authentication behavior, permission checks and click handlers.

- [ ] **Step 4: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Vite starts and prints a local URL such as `http://localhost:5173/`.

- [ ] **Step 5: Verify in browser**

Open the local URL and verify:

- `/` shows "Pelegrini";
- the four modules appear;
- clicking each available module routes to its existing module route or opens the existing permission/login flow;
- no obvious text overlap appears on desktop width.

- [ ] **Step 6: Run final checks**

Run:

```bash
npm test -- src/config/pelegriniHome.test.ts --run
npm run build
git status --short --branch
```

Expected:

- test passes;
- build succeeds;
- working tree only contains intended Pelegrini implementation files before commit.

- [ ] **Step 7: Commit**

```bash
git add src/pages/HomeMobilePage.tsx
git commit -m "feat: align mobile home with pelegrini"
```

- [ ] **Step 8: Push the completed foundation**

Run:

```bash
git push
```

Expected: commits are uploaded to `origin/master`.
