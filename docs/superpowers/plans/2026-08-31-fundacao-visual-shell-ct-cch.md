# Fundacao Visual e Shell CT/CCH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir estruturalmente a sidebar, alterar o modal para abrir somente apos clique em modulo e estabelecer a fundacao visual responsiva usada por CT e CCH.

**Architecture:** Um componente compartilhado recebera a configuracao de navegacao de cada modulo e renderizara estados compacto e expandido sem inferir conteudo pela estrutura do DOM. A Home controlara explicitamente o modulo pendente e abrira o modal de filial somente por acao do usuario. Primitives visuais compartilhadas concentrarao valores responsivos, paineis, filtros e titulos para as migracoes seguintes.

**Tech Stack:** React 18, TypeScript, React Router, Tailwind CSS, Radix Tooltip/Dialog, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-08-31-reconstrucao-visual-ct-cch-design.md`

## Global Constraints

- Nao alterar hooks de dados, contratos de API, endpoints, schemas, payloads, permissoes, rotas protegidas, calculos ou regras comerciais.
- A Home nunca deve abrir o modal de filial automaticamente.
- A sidebar desktop mede 72 px recolhida e 248 px expandida.
- Nenhum rotulo pode permanecer visivel ou ocupar largura no estado recolhido.
- Scroll horizontal de pagina e proibido; tabelas podem rolar dentro do proprio container.
- CT e CCH usam a mesma arquitetura com tokens, marca, acentos e vocabulario proprios.
- Preservar todas as alteracoes locais existentes.

---

### Task 1: Sidebar compartilhada e configuravel

**Files:**
- Create: `src/components/pelegrini/PelegriniModuleSidebar.tsx`
- Create: `src/components/pelegrini/PelegriniModuleSidebar.test.tsx`
- Modify: `src/components/pelegrini/index.ts`
- Modify: `src/components/layout/ComercialSidebar.tsx`
- Modify: `src/components/layout/OperacionalSidebar.tsx`
- Modify: `src/components/layout/FinanceiroSidebar.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `PelegriniTheme`, `NavLink`, `useLocation`, `useNavigate` and module menu arrays already present in each sidebar.
- Produces:

```ts
export interface PelegriniSidebarItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
}

export interface PelegriniModuleSidebarProps {
  theme: PelegriniTheme;
  items: PelegriniSidebarItem[];
  futureItems?: PelegriniSidebarItem[];
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  homeLabel?: string;
}
```

- [ ] **Step 1: Write the failing structural tests**

```tsx
it('renders only icons in the collapsed desktop rail', () => {
  renderSidebar();
  const sidebar = screen.getByTestId('module-sidebar');
  expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  expect(sidebar).toHaveClass('w-[72px]');
  expect(screen.getByText('Dashboard')).toHaveClass('sidebar-label');
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard');
});

it('uses explicit compact brand and label wrappers', () => {
  renderSidebar();
  expect(screen.getByTestId('sidebar-brand-compact')).toBeInTheDocument();
  expect(screen.getAllByTestId('sidebar-label').length).toBeGreaterThan(0);
  expect(screen.getByTestId('sidebar-home-label')).toHaveTextContent('Voltar aos modulos');
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run src/components/pelegrini/PelegriniModuleSidebar.test.tsx`

Expected: FAIL because `PelegriniModuleSidebar` and its explicit compact elements do not exist.

- [ ] **Step 3: Implement the shared component**

```tsx
export function PelegriniModuleSidebar({
  theme,
  items,
  futureItems = [],
  mobileOpen,
  onMobileOpenChange,
  homeLabel = 'Voltar aos modulos',
}: PelegriniModuleSidebarProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <aside
        data-testid="module-sidebar"
        data-state="collapsed"
        className={cn(
          'pelegrini-module-sidebar fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <PelegriniBrandMark theme={theme} compact tone="sidebar" data-testid="sidebar-brand-compact" />
        <SidebarAction icon={ChevronLeft} label={homeLabel} labelTestId="sidebar-home-label" onClick={() => navigate('/')} />
        <nav>{items.map((item) => <SidebarLink key={item.path} item={item} />)}</nav>
      </aside>
    </TooltipProvider>
  );
}
```

Implement `SidebarAction` and `SidebarLink` in the same file. Both must render a fixed 48 px action area, a `.sidebar-label` wrapper, `aria-label`, `title`, tooltip content and a stable icon container.

- [ ] **Step 4: Replace module-specific markup with wrappers**

Each existing sidebar keeps only menu calculation and mobile state:

```tsx
return (
  <PelegriniModuleSidebar
    theme={theme}
    items={menuItems}
    futureItems={futureItems}
    mobileOpen={isMobileOpen}
    onMobileOpenChange={setIsMobileOpen}
  />
);
```

- [ ] **Step 5: Replace fragile descendant CSS**

```css
@media (min-width: 768px) {
  .pelegrini-module-sidebar {
    width: 72px;
    overflow: hidden;
    transition: width 200ms ease, box-shadow 200ms ease;
  }

  .pelegrini-module-sidebar:hover,
  .pelegrini-module-sidebar:focus-within {
    width: 248px;
  }

  .pelegrini-module-sidebar .sidebar-label {
    width: 0;
    opacity: 0;
    overflow: hidden;
    white-space: nowrap;
    transition: opacity 120ms ease;
  }

  .pelegrini-module-sidebar:hover .sidebar-label,
  .pelegrini-module-sidebar:focus-within .sidebar-label {
    width: auto;
    opacity: 1;
    transition-delay: 80ms;
  }
}
```

Remove `.pelegrini-sidebar-collapsible` rules that target generic `button > span`, `:last-child` or bare DOM structure.

- [ ] **Step 6: Run sidebar tests**

Run: `npm test -- --run src/components/pelegrini/PelegriniModuleSidebar.test.tsx src/components/layout/ComercialSidebar.test.ts src/components/layout/FinanceiroSidebar.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the sidebar task**

```bash
git add src/components/pelegrini/PelegriniModuleSidebar.tsx src/components/pelegrini/PelegriniModuleSidebar.test.tsx src/components/pelegrini/index.ts src/components/layout/ComercialSidebar.tsx src/components/layout/OperacionalSidebar.tsx src/components/layout/FinanceiroSidebar.tsx src/index.css
git commit -m "fix: rebuild shared module sidebar"
```

### Task 2: Shell responsivo e navegacao movel

**Files:**
- Modify: `src/components/pelegrini/PelegriniModuleShell.tsx`
- Modify: `src/components/pelegrini/PelegriniVisuals.test.tsx`
- Modify: `src/components/layout/ComercialMobileHeader.tsx`
- Modify: `src/components/layout/ComercialMobileBottomNav.tsx`

**Interfaces:**
- Consumes: `PelegriniModuleShellProps` and the shared sidebar from Task 1.
- Produces: a desktop content inset of 72 px, `min-w-0`, page-level overflow protection and a mobile top offset owned by the shell.

- [ ] **Step 1: Add failing shell containment tests**

```tsx
it('reserves the collapsed rail and constrains page content', () => {
  render(<PelegriniModuleShell sidebar={<div />} moduleKey="comercial"><div>Dados</div></PelegriniModuleShell>);
  const main = screen.getByRole('main');
  expect(main).toHaveClass('md:ml-[72px]', 'min-w-0', 'overflow-x-clip');
});
```

- [ ] **Step 2: Verify the new assertion fails**

Run: `npm test -- --run src/components/pelegrini/PelegriniVisuals.test.tsx`

Expected: FAIL because the shell still uses `overflow-x-hidden` and does not expose the finalized containment contract.

- [ ] **Step 3: Implement the shell contract**

```tsx
<main className={cn(
  'pelegrini-page-surface relative min-w-0 flex-1 overflow-x-clip',
  !usesHeader && 'md:ml-[72px]',
)}>
  <div className="min-w-0">{children}</div>
</main>
```

Ensure mobile controls have stable 44 px hit targets and do not duplicate desktop labels.

- [ ] **Step 4: Run shell and navigation tests**

Run: `npm test -- --run src/components/pelegrini/PelegriniVisuals.test.tsx src/components/layout/ComercialSidebar.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the shell task**

```bash
git add src/components/pelegrini/PelegriniModuleShell.tsx src/components/pelegrini/PelegriniVisuals.test.tsx src/components/layout/ComercialMobileHeader.tsx src/components/layout/ComercialMobileBottomNav.tsx
git commit -m "fix: stabilize responsive module shell"
```

### Task 3: Modal de filial acionado pelo modulo

**Files:**
- Create: `src/pages/HomeBranchFlow.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomeMobilePage.tsx`
- Modify: `src/components/common/FilialSelectorDialog.tsx`
- Modify: `src/components/common/FilialSelectorDialog.test.tsx`

**Interfaces:**
- Consumes: `FilialSelectorDialog`, `useFilialSelecionada`, `useEmpresaSelecionada`, module permissions and module destination paths.
- Produces:

```ts
interface PendingModuleNavigation {
  path: string;
  moduleKey: PelegriniModuleKey;
}
```

The Home stores `PendingModuleNavigation | null`. The dialog is open exactly when this value is non-null.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('does not open the filial dialog on initial render', () => {
  renderHome();
  expect(screen.queryByText('Escolha a unidade')).not.toBeInTheDocument();
});

it('opens the filial dialog only after clicking an allowed module', async () => {
  renderHome();
  await userEvent.click(screen.getByRole('button', { name: /comercial/i }));
  expect(screen.getByText('Escolha a unidade')).toBeInTheDocument();
});

it('navigates to the pending module after branch selection', async () => {
  renderHome();
  await userEvent.click(screen.getByRole('button', { name: /operacional/i }));
  await userEvent.click(screen.getByRole('button', { name: /casa da transmissao/i }));
  await userEvent.click(screen.getByRole('button', { name: /^acessar$/i }));
  expect(navigateMock).toHaveBeenCalledWith('/operacional/estoque');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/pages/HomeBranchFlow.test.tsx src/components/common/FilialSelectorDialog.test.tsx`

Expected: FAIL because the current authentication effect opens the dialog immediately.

- [ ] **Step 3: Replace automatic state with pending navigation**

```tsx
const [pendingNavigation, setPendingNavigation] = useState<PendingModuleNavigation | null>(null);

const handleModuleClick = (module: ModuleItem) => {
  if (!canEnterModule(module)) return showModuleDetails(module);
  const path = resolveModulePath(module);
  setPendingNavigation({ path, moduleKey: module.moduloKey as PelegriniModuleKey });
};

<FilialSelectorDialog
  open={pendingNavigation !== null}
  onOpenChange={(open) => { if (!open) setPendingNavigation(null); }}
  codEmpresa={codEmpresaParaFilial}
  required={false}
  onConfirm={() => {
    const path = pendingNavigation?.path;
    setPendingNavigation(null);
    if (path) navigate(path);
  }}
/>
```

Remove the effect that calls `setFilialDialogOpen(true)` on authentication from desktop and mobile Home.

- [ ] **Step 4: Run branch-flow tests**

Run: `npm test -- --run src/pages/HomeBranchFlow.test.tsx src/components/common/FilialSelectorDialog.test.tsx src/components/comercial/ClientesExperience.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the modal-flow task**

```bash
git add src/pages/HomeBranchFlow.test.tsx src/pages/HomePage.tsx src/pages/HomeMobilePage.tsx src/components/common/FilialSelectorDialog.tsx src/components/common/FilialSelectorDialog.test.tsx src/components/comercial/ClientesExperience.test.tsx
git commit -m "fix: open branch selection from module clicks"
```

### Task 4: Home tecnica e primitives visuais

**Files:**
- Create: `src/components/pelegrini/PelegriniPageHeader.tsx`
- Create: `src/components/pelegrini/PelegriniFilterBar.tsx`
- Create: `src/components/pelegrini/PelegriniDataPanel.tsx`
- Create: `src/components/pelegrini/PelegriniFoundation.test.tsx`
- Modify: `src/components/pelegrini/PelegriniOperationalCard.tsx`
- Modify: `src/components/pelegrini/PelegriniResponsiveValue.tsx`
- Modify: `src/components/pelegrini/index.ts`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomeMobilePage.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: current CT/CCH theme tokens and module identity configuration.
- Produces:

```ts
interface PelegriniPageHeaderProps {
  title: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}

interface PelegriniFilterBarProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
}

interface PelegriniDataPanelProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
```

- [ ] **Step 1: Write failing primitive and Home tests**

```tsx
it('renders compact page chrome without decorative template classes', () => {
  render(<PelegriniDataPanel title="Estoque"><div>Dados</div></PelegriniDataPanel>);
  const panel = screen.getByText('Dados').closest('[data-pelegrini-panel]');
  expect(panel).toHaveClass('min-w-0');
  expect(panel).not.toHaveClass('premium-card');
});

it('keeps module cards concise', () => {
  renderHome();
  expect(screen.getByRole('heading', { name: 'Modulos' })).toBeInTheDocument();
  expect(screen.queryByText(/painel modular|experiencia pelegrini/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/components/pelegrini/PelegriniFoundation.test.tsx src/config/pelegriniHome.test.ts`

Expected: FAIL because the new primitives do not exist.

- [ ] **Step 3: Implement primitives with restrained visual rules**

Use rectangular surfaces with radius at most 8 px, one border, no nested card, no decorative gradient and no fixed value widths. `PelegriniResponsiveValue` must retain tabular numerals and use `clamp()` only between fixed minimum and maximum sizes, never viewport-width font scaling.

- [ ] **Step 4: Recompose desktop and mobile Home**

Render a compact header, a two-column module grid on tablet/desktop, a single-column mobile list and a quiet settings row. Module cards use one icon, title, one concise operational label and at most two tags. Remove redundant hero copy and decorative backgrounds.

- [ ] **Step 5: Run foundation tests**

Run: `npm test -- --run src/components/pelegrini/PelegriniFoundation.test.tsx src/config/pelegriniHome.test.ts src/config/pelegriniTheme.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the visual foundation task**

```bash
git add src/components/pelegrini/PelegriniPageHeader.tsx src/components/pelegrini/PelegriniFilterBar.tsx src/components/pelegrini/PelegriniDataPanel.tsx src/components/pelegrini/PelegriniFoundation.test.tsx src/components/pelegrini/PelegriniOperationalCard.tsx src/components/pelegrini/PelegriniResponsiveValue.tsx src/components/pelegrini/index.ts src/pages/HomePage.tsx src/pages/HomeMobilePage.tsx src/index.css
git commit -m "feat: establish CT and CCH visual foundation"
```

### Task 5: Integracao, regressao e auditoria visual

**Files:**
- Modify only files proven necessary by failing tests or visual evidence from the routes below.

**Interfaces:**
- Consumes: shared sidebar, shell, branch flow and primitives from Tasks 1-4.
- Produces: a verified foundation ready for module-specific migration plans.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test -- --run`

Expected: all test files pass.

- [ ] **Step 2: Run scoped lint**

Run: `npx eslint src/components/pelegrini src/components/layout src/pages/HomePage.tsx src/pages/HomeMobilePage.tsx src/components/common/FilialSelectorDialog.tsx`

Expected: no errors in modified files.

- [ ] **Step 3: Build production assets**

Run: `npm run build`

Expected: exit code 0. Existing bundle-size and Browserslist notices may remain, but no new compilation error is allowed.

- [ ] **Step 4: Audit desktop routes at 1440 and 1024 px**

Check:

```text
/
/comercial/dashboard
/comercial/clientes
/operacional/estoque
/financeiro/resumo
/financeiro/dre
/whatsapp
/configuracoes/empresas
```

For each route assert:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

For sidebar routes assert collapsed width 72, `scrollWidth <= clientWidth`, expansion width 248 and zero visible `.sidebar-label` elements while collapsed.

- [ ] **Step 5: Audit mobile routes at 390 and 768 px**

Verify no horizontal page overflow, no desktop sidebar visible, stable 44 px controls, single-column module cards and modal content fully inside the viewport.

- [ ] **Step 6: Verify the branch flow manually**

Open `/`, confirm the modal is absent, click Comercial, select CT, enter `/comercial/dashboard`, return, click Operacional, select CCH and enter `/operacional/estoque`.

- [ ] **Step 7: Inspect console and final diff**

Run: `git diff --check`

Expected: no whitespace errors. Browser console must contain no new runtime exception.

Verification is read-only. Any defect found returns to the task that owns the affected component, receives a failing regression test there and is committed with that task rather than as an unscoped integration fix.
