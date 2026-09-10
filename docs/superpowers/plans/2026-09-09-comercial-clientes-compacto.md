# Comercial Clientes Compacto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a tela Clientes compacta, com busca visivel, totalizadores padronizados e uma unica apresentacao de ranking.

**Architecture:** `ClientesPage` continua proprietaria de estado e calculos, mas passa a compor `ComercialCompactPage`, `ComercialCommandBar`, `ComercialMetricStrip` e `ComercialDataViewport`. O hook `useComercialData` e todos os dados derivados permanecem intactos.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Lucide, Recharts, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-09-comercial-clientes-compacto-design.md`

## Global Constraints

- Nao alterar hooks, endpoints, parametros, normalizadores ou calculos.
- Preservar alteracoes locais existentes e a fundacao compacta da Onda 1.
- Nao adicionar dependencias.
- Nao criar rolagem horizontal no documento.
- Manter a busca restrita ao ranking.

---

### Task 1: Contrato visual da tela Clientes

**Files:**
- Create: `src/pages/comercial/ClientesPage.test.tsx`
- Modify: `src/pages/comercial/ClientesPage.tsx`

**Interfaces:**
- Consumes: `useComercialData(appliedFilters)` e componentes de `src/components/comercial/compact`.
- Produces: composicao acessivel da rota `/comercial/clientes`.

- [ ] **Step 1: escrever testes falhando para a composicao compacta**

Criar mocks deterministas de `useComercialData` com dois clientes e verificar:

```tsx
expect(screen.getByRole('main')).toHaveClass('comercial-compact-page');
expect(screen.getByRole('searchbox', { name: 'Buscar clientes' })).toBeVisible();
expect(screen.getByLabelText('Indicadores da carteira')).toHaveAttribute('data-density', 'compact');
expect(screen.getAllByRole('table')).toHaveLength(1);
expect(screen.queryByText(/Insights IA|Analisado por IA|Insights Inteligentes/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: executar o teste e confirmar falha estrutural**

Run: `npm test -- --run src/pages/comercial/ClientesPage.test.tsx`

Expected: FAIL porque a pagina ainda usa o shell enterprise, busca oculta e ranking triplicado.

- [ ] **Step 3: migrar shell, busca e indicadores**

Usar:

```tsx
<ComercialCompactPage>
  <ComercialCommandBar title="Clientes" actions={searchControl} />
  <EnterpriseComercialFilters {...existingFilterProps} />
  <ComercialMetricStrip ariaLabel="Indicadores da carteira" metrics={clientMetrics} />
  {tabs}
</ComercialCompactPage>
```

Remover `EnterprisePageHeader` e `EnterpriseMetricCard` do caminho principal.

- [ ] **Step 4: executar teste e lint**

Run: `npm test -- --run src/pages/comercial/ClientesPage.test.tsx`

Run: `npx eslint src/pages/comercial/ClientesPage.tsx src/pages/comercial/ClientesPage.test.tsx`

Expected: PASS sem saida de lint.

---

### Task 2: Ranking unico e viewport interna

**Files:**
- Modify: `src/pages/comercial/ClientesPage.tsx`
- Modify: `src/pages/comercial/ClientesPage.test.tsx`

**Interfaces:**
- Preserves: `clientesFiltrados`, ordenacao recebida do hook e formatadores atuais.
- Produces: uma tabela de ranking dentro de `ComercialDataViewport`.

- [ ] **Step 1: adicionar teste falhando de ranking unico**

```tsx
expect(screen.queryByText('Concentração Top 10 Clientes')).not.toBeInTheDocument();
expect(screen.queryByText('Líder')).not.toBeInTheDocument();
expect(screen.getByTestId('comercial-data-viewport')).toContainElement(screen.getByRole('table'));
```

- [ ] **Step 2: remover podio e grafico duplicados**

Excluir apenas a apresentacao Top 5/Top 10. Manter a tabela, seus dados e a busca local.

- [ ] **Step 3: compactar tabela**

Aplicar cabecalho fixo, altura de linha entre 40 e 44 px, valores tabulares e `title` nos nomes truncados.

- [ ] **Step 4: executar o teste focado**

Run: `npm test -- --run src/pages/comercial/ClientesPage.test.tsx -t "ranking"`

Expected: PASS.

---

### Task 3: Linguagem operacional e abas

**Files:**
- Modify: `src/pages/comercial/ClientesPage.tsx`
- Modify: `src/pages/comercial/ClientesPage.test.tsx`

**Interfaces:**
- Preserves: estados `ranking`, `evolucao`, `insights` e `geografico` para nao quebrar logica interna.
- Produces: rotulos visuais `Ranking`, `Evolucao`, `Carteira` e `Geografico`.

- [ ] **Step 1: escrever teste dos rotulos operacionais**

```tsx
expect(screen.getByRole('tab', { name: 'Carteira' })).toBeInTheDocument();
expect(screen.queryByText(/IA/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: substituir textos e icones promocionais**

Manter `value="insights"`, trocar o texto por `Carteira`, o painel por `Alertas e oportunidades` e remover o selo da evolucao.

- [ ] **Step 3: limitar rolagem a uma unica viewport**

Cada `TabsContent` deve preencher `min-h-0 flex-1`; o conteudo rolavel fica em `ComercialDataViewport`, sem `overflow-auto` concorrente no documento.

- [ ] **Step 4: executar testes da pagina**

Run: `npm test -- --run src/pages/comercial/ClientesPage.test.tsx`

Expected: PASS.

---

### Task 4: Validacao final

**Files:**
- Verify: `src/pages/comercial/ClientesPage.tsx`
- Verify: `src/pages/comercial/ClientesPage.test.tsx`

- [ ] **Step 1: executar regressao relacionada**

Run: `npm test -- --run src/pages/comercial/ClientesPage.test.tsx src/components/comercial/ClientesExperience.test.tsx src/components/comercial/compact/ComercialCompactLayout.test.tsx`

- [ ] **Step 2: executar lint e build**

Run: `npx eslint src/pages/comercial/ClientesPage.tsx src/pages/comercial/ClientesPage.test.tsx`

Run: `npm run build`

- [ ] **Step 3: verificar visualmente**

Conferir `/comercial/clientes` em 390, 768, 1024 e 1440 px. Confirmar busca visivel, ausencia de overflow global e rolagem interna do ranking.
