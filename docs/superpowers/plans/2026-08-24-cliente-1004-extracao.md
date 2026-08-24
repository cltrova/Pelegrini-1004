# Cliente 1004 Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `Rsys-1004/` e `C:\Users\Usuario\Downloads\Rsys-1004` como projeto dedicado da Pelegrini, aceitando somente `1004` e `10041`.

**Architecture:** A extracao parte de uma copia limpa do sistema geral, remove dependencias Lovable e secrets reais, e adiciona uma camada de configuracao `cliente1004` para centralizar os codigos permitidos. A UI preserva o seletor de filial da Pelegrini, mas reduz selecao de empresa/rotas para o conjunto `1004` + `10041`; functions e docs sao limpos para o projeto virar repositorio GitHub separado.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Edge Functions, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-cliente-1004-extracao-design.md`

## Global Constraints

- O projeto dedicado deve aceitar somente `cod_empresa_bi=1004` e `cod_empresa_bi=10041`.
- O projeto dedicado deve preservar as regras atuais da Pelegrini para Casa da Transmissao e Casa da Chevrolet.
- O projeto dedicado nao deve depender do Lovable para desenvolvimento, build ou IA.
- O projeto dedicado nao deve conter `.env`, `.lovable`, `node_modules`, `dist`, `.git`, `.pnpm-store` ou `.tmp`.
- O projeto dedicado deve conter `.env.example` com placeholders, nunca secrets reais.
- A copia solta final deve existir em `C:\Users\Usuario\Downloads\Rsys-1004`.

---

## File Structure

- `Rsys-1004/`: pasta fonte dedicada dentro do workspace atual.
- `Rsys-1004/src/config/cliente1004.ts`: constantes e helpers do cliente Pelegrini (`1004` + `10041`).
- `Rsys-1004/src/config/cliente1004.test.ts`: testes unitarios do isolamento de codigos.
- `Rsys-1004/src/contexts/EmpresaSelecionadaContext.tsx`: contexto reduzido para `1004`/`10041`.
- `Rsys-1004/src/hooks/useEmpresaAtiva.ts`: empresa ativa padrao do projeto Pelegrini.
- `Rsys-1004/src/hooks/useEmpresaConfig.ts`: fallback e listagem de empresas limitados a `1004`/`10041`.
- `Rsys-1004/src/App.tsx`: entrada/rotas dedicadas.
- `Rsys-1004/src/components/layout/ComercialSidebar.tsx`: menu Comercial com telas relevantes para Pelegrini.
- `Rsys-1004/src/components/layout/FinanceiroSidebar.tsx`: menu Financeiro sem rotas exclusivas de outros clientes.
- `Rsys-1004/supabase/functions/**`: functions preservadas/limpas para Pelegrini; Lovable trocado por envs genericas.
- `Rsys-1004/.env.example`: placeholders de frontend e Supabase functions.
- `Rsys-1004/docs/cliente-1004-dados.md`: guia operacional do projeto dedicado.
- `Rsys-1004/README.md`: instrucoes de desenvolvimento Codex + GitHub.

---

### Task 1: Criar copia limpa do projeto

**Files:**
- Create: `Rsys-1004/**`

**Interfaces:**
- Consumes: sistema geral na raiz do workspace.
- Produces: arvore inicial `Rsys-1004/` sem artefatos proibidos.

- [ ] **Step 1: Verificar que o destino nao existe**

Run:

```powershell
Test-Path Rsys-1004
```

Expected: `False`. If `True`, stop and ask before replacing.

- [ ] **Step 2: Copiar arquivos fonte com robocopy**

Run:

```powershell
robocopy . Rsys-1004 /E /XD .git node_modules dist .lovable .pnpm-store .tmp .agents .codex .codex-rpa1002-push tmp-auditoria-1004 Rsys-1001 Rsys-1004 /XF *.log
```

Expected: Robocopy exit code `1` or another success code below `8`; `Rsys-1004/src` and `Rsys-1004/supabase` exist.

- [ ] **Step 3: Remover secrets reais caso tenham sido copiados**

Run:

```powershell
Test-Path Rsys-1004\.env
```

If output is `True`, remove exactly `Rsys-1004\.env`.

- [ ] **Step 4: Verificar estrutura limpa**

Run:

```powershell
Test-Path Rsys-1004\src
Test-Path Rsys-1004\supabase
Test-Path Rsys-1004\.env
Test-Path Rsys-1004\.lovable
Test-Path Rsys-1004\node_modules
Test-Path Rsys-1004\dist
```

Expected: `True`, `True`, `False`, `False`, `False`, `False`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- Rsys-1004
git commit -m "chore: scaffold cliente 1004 project"
```

---

### Task 2: Remover Lovable do projeto dedicado

**Files:**
- Modify: `Rsys-1004/package.json`
- Modify: `Rsys-1004/package-lock.json`
- Modify: `Rsys-1004/vite.config.ts`
- Modify: `Rsys-1004/index.html`
- Modify: `Rsys-1004/README.md`
- Delete: `Rsys-1004/bun.lock`
- Delete: `Rsys-1004/bun.lockb`

**Interfaces:**
- Consumes: copia inicial criada na Task 1.
- Produces: projeto Vite sem dependencias ou metadados Lovable.

- [ ] **Step 1: Editar package.json**

Set:

```json
{
  "name": "rsys-cliente-1004",
  "version": "1.0.0"
}
```

Remove dependency/devDependency entries whose key contains `lovable` or starts with `@lovable.dev/`.

Add script if missing:

```json
"test": "vitest"
```

- [ ] **Step 2: Limpar package-lock.json por JSON estruturado**

Run a Node script that parses `Rsys-1004/package-lock.json`, removes package entries containing `lovable` or `@lovable.dev`, removes matching root dependencies/devDependencies, and writes JSON with two-space indentation.

- [ ] **Step 3: Editar vite.config.ts**

Remove imports/usages of `componentTagger` or any Lovable plugin. Keep:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
```

Ensure `plugins: [react()]`.

- [ ] **Step 4: Editar index.html**

Set title/description to Pelegrini:

```html
<title>Rsys Pelegrini</title>
<meta name="description" content="Sistema dedicado Pelegrini" />
```

Remove Lovable author/twitter metadata.

- [ ] **Step 5: Remover locks Bun**

Delete `Rsys-1004/bun.lock` and `Rsys-1004/bun.lockb` if present.

- [ ] **Step 6: Verificar remocao Lovable em arquivos de build**

Run:

```powershell
rg -n "@lovable|lovable-tagger|componentTagger|@lovable.dev" Rsys-1004\package.json Rsys-1004\package-lock.json Rsys-1004\vite.config.ts Rsys-1004\index.html
```

Expected: no output.

- [ ] **Step 7: Commit**

Run:

```powershell
git add -- Rsys-1004/package.json Rsys-1004/package-lock.json Rsys-1004/vite.config.ts Rsys-1004/index.html Rsys-1004/README.md Rsys-1004/bun.lock Rsys-1004/bun.lockb
git commit -m "chore: remove lovable from cliente 1004"
```

---

### Task 3: Fixar contexto do cliente Pelegrini

**Files:**
- Create: `Rsys-1004/src/config/cliente1004.ts`
- Create: `Rsys-1004/src/config/cliente1004.test.ts`
- Modify: `Rsys-1004/src/contexts/EmpresaSelecionadaContext.tsx`
- Modify: `Rsys-1004/src/hooks/useEmpresaAtiva.ts`
- Modify: `Rsys-1004/src/hooks/useEmpresaConfig.ts`
- Modify: `Rsys-1004/src/pages/configuracoes/UsuariosPage.tsx`

**Interfaces:**
- Consumes: existing hooks/components expecting `empresaSelecionada`, `codEmpresaAtiva`, `useEmpresas`.
- Produces: helpers `CLIENTE_COD_EMPRESA_BI_PADRAO`, `CLIENTE_COD_EMPRESA_BI_CHEVROLET`, `CLIENTE_CODIGOS_EMPRESA_BI`, `isCliente1004`, `assertCliente1004`.

- [ ] **Step 1: Criar teste do cliente**

Create `Rsys-1004/src/config/cliente1004.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CLIENTE_COD_EMPRESA_BI_CHEVROLET,
  CLIENTE_COD_EMPRESA_BI_PADRAO,
  assertCliente1004,
  isCliente1004,
} from './cliente1004';

describe('cliente1004 config', () => {
  it('aceita os codigos da Pelegrini', () => {
    expect(CLIENTE_COD_EMPRESA_BI_PADRAO).toBe('1004');
    expect(CLIENTE_COD_EMPRESA_BI_CHEVROLET).toBe('10041');
    expect(isCliente1004('1004')).toBe(true);
    expect(isCliente1004('10041')).toBe(true);
    expect(isCliente1004(1004)).toBe(true);
    expect(isCliente1004(10041)).toBe(true);
  });

  it('bloqueia codigos fora da Pelegrini', () => {
    expect(isCliente1004('1001')).toBe(false);
    expect(isCliente1004('1005')).toBe(false);
    expect(() => assertCliente1004('1004')).not.toThrow();
    expect(() => assertCliente1004('10041')).not.toThrow();
    expect(() => assertCliente1004('1001')).toThrow('Projeto dedicado aceita apenas cod_empresa_bi=1004 ou 10041');
  });
});
```

- [ ] **Step 2: Criar config do cliente**

Create `Rsys-1004/src/config/cliente1004.ts`:

```ts
export const CLIENTE_COD_EMPRESA_BI_PADRAO = '1004' as const;
export const CLIENTE_COD_EMPRESA_BI_CHEVROLET = '10041' as const;
export const CLIENTE_CODIGOS_EMPRESA_BI = [
  CLIENTE_COD_EMPRESA_BI_PADRAO,
  CLIENTE_COD_EMPRESA_BI_CHEVROLET,
] as const;
export const CLIENTE_NOME = 'Pelegrini' as const;

export type Cliente1004Codigo = typeof CLIENTE_CODIGOS_EMPRESA_BI[number];

export function normalizeCliente1004(value: unknown): string {
  return String(value ?? '').trim();
}

export function isCliente1004(value: unknown): value is Cliente1004Codigo {
  const normalized = normalizeCliente1004(value);
  return CLIENTE_CODIGOS_EMPRESA_BI.some((codigo) => codigo === normalized);
}

export function assertCliente1004(value: unknown): void {
  if (!isCliente1004(value)) {
    throw new Error('Projeto dedicado aceita apenas cod_empresa_bi=1004 ou 10041');
  }
}

export function resolveCliente1004(value: unknown): Cliente1004Codigo {
  return isCliente1004(value) ? value : CLIENTE_COD_EMPRESA_BI_PADRAO;
}
```

- [ ] **Step 3: Fixar EmpresaSelecionadaContext**

Modify `EmpresaSelecionadaContext.tsx` to default to `1004`, accept only `1004` or `10041` in setter, and store the selected Pelegrini code in localStorage. If a stored value is invalid, use `1004`.

- [ ] **Step 4: Fixar useEmpresaAtiva**

Modify `useEmpresaAtiva.ts` so `codEmpresaAtiva = resolveCliente1004(empresaSelecionada)`, independent of profile `codEmpresa`. Keep `isMaster` from auth for permissions display.

- [ ] **Step 5: Limitar useEmpresaConfig/useEmpresas**

Modify `useEmpresaConfig.ts` so fallback code is `1004`, and `useEmpresas()` returns only rows where `cod_empresa_bi` is in `['1004', '10041']`.

- [ ] **Step 6: Limitar UsuariosPage**

Modify `UsuariosPage.tsx` to use `CLIENTE_COD_EMPRESA_BI_PADRAO` as `filterByCompany` and default company, unless a later UI explicitly supports creating users for `10041`.

- [ ] **Step 7: Rodar teste do config**

Run:

```powershell
npm test -- --run src/config/cliente1004.test.ts
```

If local `npm install` is unavailable inside `Rsys-1004`, run Vitest from parent using the parent `node_modules` or document the environment limitation and validate via final build.

- [ ] **Step 8: Commit**

Run:

```powershell
git add -- Rsys-1004/src/config/cliente1004.ts Rsys-1004/src/config/cliente1004.test.ts Rsys-1004/src/contexts/EmpresaSelecionadaContext.tsx Rsys-1004/src/hooks/useEmpresaAtiva.ts Rsys-1004/src/hooks/useEmpresaConfig.ts Rsys-1004/src/pages/configuracoes/UsuariosPage.tsx Rsys-1004/package.json
git commit -m "chore: isolate cliente 1004 context"
```

---

### Task 4: Reduzir rotas e menus para Pelegrini

**Files:**
- Modify: `Rsys-1004/src/App.tsx`
- Modify: `Rsys-1004/src/components/layout/ComercialSidebar.tsx`
- Modify: `Rsys-1004/src/components/layout/FinanceiroSidebar.tsx`
- Optionally modify: `Rsys-1004/src/components/common/EmpresaSelectorDialog.tsx`

**Interfaces:**
- Consumes: `useEmpresaAtiva`, `EmpresaSelecionadaContext`, `RequirePelegrini`.
- Produces: entrada e navegacao dedicadas para `1004`/`10041`.

- [ ] **Step 1: Root direto para Comercial**

In `App.tsx`, replace root route with:

```tsx
<Route path="/" element={<Navigate to="/comercial/dashboard" replace />} />
```

- [ ] **Step 2: Remover rotas exclusivas de outros clientes**

In `App.tsx`, redirect these routes away from other-client pages:

```tsx
<Route path="/mobile" element={<Navigate to="/comercial/dashboard" replace />} />
```

For Comercial:

- Keep `dashboard`, `clientes`, `produtos`, `marcas`, `comissao`.
- Redirect `progresso-vendedor`, `metas-diarias`, `autenticacao` to `/comercial/dashboard`.

For Financeiro:

- Keep routes whose module permissions are enabled by Supabase config.
- Redirect `duplicatas` and `fluxo-caixa` if they remain 1002-only.

For Operacional:

- Keep `estoque` and `estoque/retroativo` because `estoque/retroativo` is protected by `RequirePelegrini`.

- [ ] **Step 3: Ajustar ComercialSidebar**

Ensure the visible menu for `1004`/`10041` includes Pelegrini-relevant entries:

- Dashboard
- Clientes
- Produtos
- Marcas
- Comissao

Do not show:

- Progresso Vendedor 1001
- Auditoria 1003
- Metas 1005-only

- [ ] **Step 4: Ajustar FinanceiroSidebar**

Remove Master demo behavior and 1002-only inheritance. Keep only items available for Pelegrini through module flags and generic routes.

- [ ] **Step 5: Limitar EmpresaSelectorDialog**

If `EmpresaSelectorDialog` remains reachable, filter its company list to `1004` and `10041` only.

- [ ] **Step 6: Verificar imports mortos**

Run:

```powershell
rg -n "HomePage|MobileMetasPage|ProgressoVendedor1001Page|AutenticacaoPedidosPage|RequireEmpresa1001|RequireEmpresa1002|RequireEmpresa1003|RequireNot1003|RequireNot1005" Rsys-1004\src\App.tsx Rsys-1004\src\components\layout
```

Expected: no import/use that would break lint/build.

- [ ] **Step 7: Commit**

Run:

```powershell
git add -- Rsys-1004/src/App.tsx Rsys-1004/src/components/layout/ComercialSidebar.tsx Rsys-1004/src/components/layout/FinanceiroSidebar.tsx Rsys-1004/src/components/common/EmpresaSelectorDialog.tsx
git commit -m "chore: reduce cliente 1004 navigation"
```

---

### Task 5: Trocar Lovable AI Gateway nas Edge Functions

**Files:**
- Modify: `Rsys-1004/supabase/functions/**/index.ts`

**Interfaces:**
- Consumes: functions copied from general system.
- Produces: functions using `AI_GATEWAY_URL`, `AI_GATEWAY_API_KEY`, or `OPENAI_API_KEY`.

- [ ] **Step 1: Localizar referencias Lovable**

Run:

```powershell
rg -n "LOVABLE_API_KEY|ai\.gateway\.lovable|Lovable AI Gateway|Lovable Cloud" Rsys-1004\supabase\functions Rsys-1004\src
```

- [ ] **Step 2: Trocar endpoint e key**

For each Edge Function using Lovable gateway, add:

```ts
const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");
```

Replace fetch URL with `AI_GATEWAY_URL` and bearer token with `AI_GATEWAY_API_KEY`.

- [ ] **Step 3: Atualizar mensagens de erro**

Replace errors like `LOVABLE_API_KEY não configurada` with:

```ts
"AI_GATEWAY_API_KEY ou OPENAI_API_KEY não configurada"
```

- [ ] **Step 4: Verificar zero Lovable executavel**

Run:

```powershell
rg -n "LOVABLE_API_KEY|ai\.gateway\.lovable|Lovable AI Gateway|Lovable Cloud|@lovable|componentTagger|lovable-tagger" Rsys-1004\src Rsys-1004\supabase\functions Rsys-1004\package.json Rsys-1004\package-lock.json Rsys-1004\vite.config.ts Rsys-1004\index.html
```

Expected: no output.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- Rsys-1004/supabase/functions Rsys-1004/src Rsys-1004/package.json Rsys-1004/package-lock.json Rsys-1004/vite.config.ts Rsys-1004/index.html
git commit -m "chore: replace lovable ai gateway in cliente 1004"
```

---

### Task 6: Limpar functions e arquivos fora do escopo

**Files:**
- Delete: `Rsys-1004/supabase/functions/audit-1001-*`
- Delete: `Rsys-1004/supabase/functions/audit-1005-*`
- Delete: functions `inspect-*` or `debug-*` tied only to other clients.
- Keep or evaluate: `Rsys-1004/supabase/functions/audit-*1004*`, `Rsys-1004/supabase/functions/reconcile-1004-*`, `Rsys-1004/supabase/functions/inspect-*1004*`.

**Interfaces:**
- Consumes: copied Supabase functions.
- Produces: functions directory focused on Pelegrini and shared production features.

- [ ] **Step 1: Listar functions**

Run:

```powershell
Get-ChildItem -Directory Rsys-1004\supabase\functions | Select-Object -ExpandProperty Name | Sort-Object
```

- [ ] **Step 2: Remover auditorias claramente de outros clientes**

Delete directories matching:

```text
audit-1001-*
audit-1005-*
audit-leandro-1005
debug-servicos
```

- [ ] **Step 3: Avaliar auditorias 1004**

Keep `audit-*1004*`, `inspect-*1004*`, `reconcile-1004-*`, `audit-mwm-*`, and `audit-eaton-*` only if they support Pelegrini. If kept, mention them in `docs/cliente-1004-dados.md` as support/audit tools; if removed, ensure no frontend route depends on them.

- [ ] **Step 4: Buscar referencias a clientes fora do escopo em functions**

Run:

```powershell
rg -n "1001|1002|1003|1005|MASTER|Cyft Master|Armo|Ideal" Rsys-1004\supabase\functions
```

Expected: only shared code/comments that are intentionally retained, or no output.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- Rsys-1004/supabase/functions
git commit -m "chore: clean cliente 1004 functions"
```

---

### Task 7: Documentar env, dados e GitHub

**Files:**
- Create: `Rsys-1004/.env.example`
- Create: `Rsys-1004/docs/cliente-1004-dados.md`
- Modify: `Rsys-1004/README.md`

**Interfaces:**
- Consumes: final project structure.
- Produces: onboarding docs for Codex + GitHub.

- [ ] **Step 1: Criar .env.example**

Create:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel

SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role

OPENAI_API_KEY=sua-chave-openai
AI_GATEWAY_URL=https://api.openai.com/v1/chat/completions
AI_GATEWAY_API_KEY=sua-chave-do-gateway
```

- [ ] **Step 2: Criar docs/cliente-1004-dados.md**

Document:

- Projeto Pelegrini dedicado.
- Codigos aceitos: `1004` e `10041`.
- Filiais: Casa da Transmissao e Casa da Chevrolet.
- Regras preservadas: Comissao, Forca P, vendedores ocultos, Chevrolet, Estoque Retroativo.
- Secrets Supabase/IA.
- Processo GitHub separado.

- [ ] **Step 3: Atualizar README**

README must include:

```markdown
# Rsys Cliente 1004 - Pelegrini

Projeto dedicado ao cliente Pelegrini (`1004` e `10041`), mantido via Codex + GitHub.
```

Include `npm install`, `npm run dev`, `npm run build`, env setup, and note that Lovable is not used.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- Rsys-1004/.env.example Rsys-1004/docs/cliente-1004-dados.md Rsys-1004/README.md
git commit -m "docs: document cliente 1004 project"
```

---

### Task 8: Validar build e copiar pasta solta

**Files:**
- Create: `C:\Users\Usuario\Downloads\Rsys-1004`
- No tracked source changes expected unless validation reveals fixes.

**Interfaces:**
- Consumes: completed `Rsys-1004/`.
- Produces: validated project folder and standalone copy.

- [ ] **Step 1: Verificar artefatos proibidos**

Run:

```powershell
Test-Path Rsys-1004\.env
Test-Path Rsys-1004\.lovable
Test-Path Rsys-1004\node_modules
```

Expected: `False`, `False`, `False`.

- [ ] **Step 2: Rodar busca Lovable final**

Run:

```powershell
rg -n "LOVABLE_API_KEY|ai\.gateway\.lovable|@lovable|componentTagger|lovable-tagger|Lovable Cloud|Lovable AI Gateway" Rsys-1004\src Rsys-1004\supabase\functions Rsys-1004\package.json Rsys-1004\package-lock.json Rsys-1004\vite.config.ts Rsys-1004\index.html
```

Expected: no output.

- [ ] **Step 3: Rodar build**

Preferred:

```powershell
npm run build
```

If local dependencies are not installed in `Rsys-1004`, use the parent Vite API with `configFile:false`:

```powershell
node --input-type=module -e "import path from 'node:path'; import { build } from './node_modules/vite/dist/node/index.js'; import react from './node_modules/@vitejs/plugin-react-swc/index.js'; const root=path.resolve('Rsys-1004'); await build({ configFile:false, root, plugins:[react()], resolve:{ alias:{ '@': path.resolve(root,'src') } }, build:{ outDir:path.resolve(root,'dist'), emptyOutDir:true } });"
```

Expected: build exits with code `0`.

- [ ] **Step 4: Remover dist antes da copia solta**

If `Rsys-1004/dist` exists after validation, leave it ignored in the workspace but exclude it from the standalone copy.

- [ ] **Step 5: Criar copia solta em Downloads**

If `C:\Users\Usuario\Downloads\Rsys-1004` exists, stop and ask before replacing. Otherwise run:

```powershell
robocopy C:\Users\Usuario\Downloads\Rsys-main\Rsys-main\Rsys-1004 C:\Users\Usuario\Downloads\Rsys-1004 /E /XD node_modules dist .git /XF *.log
```

Expected: Robocopy success code below `8`.

- [ ] **Step 6: Verificar copia solta**

Run:

```powershell
Test-Path C:\Users\Usuario\Downloads\Rsys-1004
Test-Path C:\Users\Usuario\Downloads\Rsys-1004\.env
Test-Path C:\Users\Usuario\Downloads\Rsys-1004\node_modules
Test-Path C:\Users\Usuario\Downloads\Rsys-1004\src\config\cliente1004.ts
```

Expected: `True`, `False`, `False`, `True`.

- [ ] **Step 7: Commit final if validation fixes changed tracked files**

If validation required source fixes:

```powershell
git add -- Rsys-1004
git commit -m "chore: finalize cliente 1004 project"
```

If no tracked files changed, do not create an empty commit.

---

## Self-Review

- Spec coverage: tasks cover folder creation, Lovable removal, `1004` + `10041` context, filial preservation, navigation reduction, AI gateway replacement, function cleanup, docs, validation, and standalone copy.
- Placeholder scan: no task uses TBD/TODO/later placeholders; each task has explicit commands and expected outputs.
- Type consistency: config helpers are defined in Task 3 and consumed by context/hooks in the same task.
