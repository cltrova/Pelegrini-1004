# Estoque Mesa Operacional Compacta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar Central, Giro, Assistente e Estoque Retroativo em uma mesa operacional compacta de altura fixa, com uma unica area rolavel e dados corretamente isolados por filial e produto.

**Architecture:** Um `EstoqueWorkspace` compartilhado controla `100dvh`, barras fixas e o viewport rolavel. Dados de giro sao normalizados por uma funcao pura antes de alimentar indicadores e tabela; as telas existentes passam a fornecer toolbars, metricas e conteudo para as primitivas comuns sem alterar hooks de API.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Radix UI, TanStack Query, Vitest, Testing Library e Playwright/browser local.

**Spec:** `docs/superpowers/specs/2026-09-04-estoque-mesa-operacional-compacta-design.md`

## Global Constraints

- Preservar contratos de API, permissoes, calculos comerciais e configuracoes de empresa.
- Nao inventar valores ausentes; falha de fonte continua diferente de estoque zerado.
- Em desktop, o documento nao possui rolagem vertical; somente o viewport de dados rola.
- CT usa azul/ciano e CCH usa azul/amarelo sem depender apenas da cor para comunicar estado.
- Central, Giro, Assistente e Retroativo compartilham alinhamentos e dimensoes.
- Icones possuem nomes acessiveis e siglas/expressoes tecnicas possuem tooltip.
- Implementar por TDD e criar um commit pequeno ao final de cada tarefa.

---

### Task 1: Normalizar Giro e Isolar Filiais

**Files:**
- Create: `src/components/operacional/estoque/normalizeGiroProducts.ts`
- Create: `src/components/operacional/estoque/normalizeGiroProducts.test.ts`
- Modify: `src/components/operacional/GiroEstoqueTab.tsx:130`
- Modify: `src/pages/operacional/EstoquePage.tsx:73`
- Modify: `src/hooks/useEstoqueData.ts:264`
- Modify: `src/hooks/useEstoqueData.test.ts`

**Interfaces:**
- Consumes: `GiroRecord[]`, `EstoqueRecord[]` e `activeCompanyCode?: string | null`.
- Produces: `normalizeGiroProducts(giroRows, stockRows, activeCompanyCode, months, now): GiroProductSummary[]`.
- Produces: `giroProductKey(companyCode, branchCode, productCode): string`.
- Produces: `useEstoqueData().activeCompanyCode: string`, usando o mesmo codigo aplicado nas consultas.

- [ ] **Step 1: Escrever testes que reproduzem duplicidade e mistura CT/CCH**

```ts
it('combina saldo e vendas em uma linha por filial e produto', () => {
  const result = normalizeGiroProducts(
    [saleRow({ cod_empresa_bi: 1004, cod_empresa: 1, cod_produto: 99, saida_venda: 4 })],
    [stockRow({ cod_empresa_bi: 1004, cod_empresa: 1, cod_produto: 99, quantidade_estoque: 8 })],
    '1004',
    3,
    new Date('2026-09-04T12:00:00'),
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ cod_produto: 99, quantidade_estoque: 8, total_vendas: 4 });
});

it('remove registros CT quando CCH esta ativa', () => {
  const result = normalizeGiroProducts(
    [
      saleRow({ cod_empresa_bi: 1004, cod_produto: 1 }),
      saleRow({ cod_empresa_bi: 10041, cod_produto: 2 }),
    ],
    [],
    '10041',
    3,
    new Date('2026-09-04T12:00:00'),
  );
  expect(result.map(item => item.cod_produto)).toEqual([2]);
});
```

- [ ] **Step 2: Executar o teste e confirmar falha**

Run: `npm test -- --run src/components/operacional/estoque/normalizeGiroProducts.test.ts`

Expected: FAIL porque `normalizeGiroProducts` ainda nao existe.

- [ ] **Step 3: Implementar normalizacao pura**

```ts
export function giroProductKey(
  companyCode: string | number | null | undefined,
  branchCode: string | number | null | undefined,
  productCode: string | number,
) {
  return `${String(companyCode ?? '')}:${String(branchCode ?? '')}:${String(productCode)}`;
}

export function normalizeGiroProducts(
  giroRows: GiroRecord[],
  stockRows: EstoqueRecord[],
  activeCompanyCode: string | null | undefined,
  months: number,
  now: Date,
): GiroProductSummary[] {
  const company = String(activeCompanyCode ?? '');
  const allowed = (value: unknown) => !company || String(value ?? '') === company;
  const stockByKey = new Map(
    stockRows.filter(row => allowed(row.cod_empresa_bi)).map(row => [
      giroProductKey(row.cod_empresa_bi, row.cod_empresa, row.cod_produto),
      row,
    ]),
  );
  const movementByKey = new Map<string, GiroRecord[]>();
  giroRows.filter(row => allowed(row.cod_empresa_bi)).forEach(row => {
    const key = giroProductKey(row.cod_empresa_bi, row.cod_empresa, row.cod_produto);
    movementByKey.set(key, [...(movementByKey.get(key) ?? []), row]);
  });

  const keys = new Set([...stockByKey.keys(), ...movementByKey.keys()]);
  return [...keys].map(key => {
    const stock = stockByKey.get(key);
    const movements = movementByKey.get(key) ?? [];
    const latest = [...movements].sort((a, b) => b.data_movimento.localeCompare(a.data_movimento))[0];
    const totalVendas = movements.reduce((sum, row) => sum + Number(row.saida_venda || 0), 0);
    const totalCompras = movements.reduce((sum, row) => sum + Number(row.entrada_compra || 0), 0);
    const ultimaVenda = movements
      .filter(row => Number(row.saida_venda || 0) > 0)
      .map(row => row.data_movimento)
      .sort()
      .at(-1) ?? stock?.data_ultima_venda ?? null;
    const quantidade = Number(stock?.quantidade_estoque ?? latest?.quantidade_estoque ?? 0);
    const valor = Number(stock?.valor_estoque ?? latest?.valor_estoque ?? 0);
    const mediaMensal = months > 0 ? totalVendas / months : 0;
    const cobertura = mediaMensal > 0 ? quantidade / mediaMensal : null;
    return {
      cod_empresa_bi: Number(stock?.cod_empresa_bi ?? latest?.cod_empresa_bi ?? company),
      cod_empresa: Number(stock?.cod_empresa ?? latest?.cod_empresa ?? 0),
      cod_produto: Number(stock?.cod_produto ?? latest?.cod_produto ?? 0),
      produto: String(stock?.produto ?? latest?.produto ?? ''),
      marca: String(stock?.marca ?? latest?.marca ?? ''),
      grupo: String(stock?.grupo ?? latest?.grupo ?? ''),
      empresa: String(stock?.empresa ?? latest?.empresa ?? ''),
      quantidade_estoque: quantidade,
      valor_estoque: valor,
      total_vendas: totalVendas,
      total_compras: totalCompras,
      giro: quantidade > 0 ? totalVendas / quantidade : totalVendas,
      status: calculateGiroStatus(quantidade, totalVendas, months),
      dias_sem_venda: daysSince(ultimaVenda, now),
      ultima_venda: ultimaVenda,
      total_saida_venda: totalVendas,
      total_entrada_compra: totalCompras,
      total_saida_transferencia: movements.reduce((sum, row) => sum + Number(row.saida_transferencia || 0), 0),
      total_entrada_transferencia: movements.reduce((sum, row) => sum + Number(row.entrada_transferencia || 0), 0),
      cobertura_meses: cobertura,
      classe_abc: stock?.classe_abc ?? null,
    };
  }).sort((a, b) => b.valor_estoque - a.valor_estoque || a.cod_produto - b.cod_produto);
}
```

Mover `calcGiroStatus` e `getDaysSinceSale` de `GiroEstoqueTab` para o novo arquivo como `calculateGiroStatus` e `daysSince`, preservando exatamente os limites atuais de cobertura. O normalizador passa a ser o unico lugar que soma movimentos, escolhe saldo e calcula classificacao.

- [ ] **Step 4: Integrar o normalizador**

Em `useEstoqueData`, incluir `activeCompanyCode: String(estoqueCompanyCode ?? '')` no retorno. Em `GiroEstoqueTab`, substituir os mapas independentes de estoque e giro por:

```ts
const summaries = useMemo(
  () => normalizeGiroProducts(giroData, estoqueData, activeCompanyCode, filters.periodoMeses, referenceNow),
  [activeCompanyCode, estoqueData, filters.periodoMeses, giroData, referenceNow],
);
```

Definir `referenceNow` uma vez por montagem com `useState(() => new Date())[0]`. Garantir que `EstoquePage` envie `activeCompanyCode={activeCompanyCode}` recebido do hook, sem derivar filial pelo nome.

- [ ] **Step 5: Executar testes de dados e regressao**

Run: `npm test -- --run src/components/operacional/estoque/normalizeGiroProducts.test.ts src/components/operacional/GiroEstoqueTab.test.tsx src/pages/operacional/EstoquePage.test.tsx`

Expected: PASS, sem produtos duplicados e sem mistura de filial.

- [ ] **Step 6: Commit**

```bash
git add src/components/operacional/estoque/normalizeGiroProducts.ts src/components/operacional/estoque/normalizeGiroProducts.test.ts src/components/operacional/GiroEstoqueTab.tsx src/pages/operacional/EstoquePage.tsx src/hooks/useEstoqueData.ts src/hooks/useEstoqueData.test.ts
git commit -m "fix: normalizar produtos e filiais no giro de estoque"
```

### Task 2: Criar o Workspace Compacto

**Files:**
- Create: `src/components/operacional/estoque/EstoqueWorkspace.tsx`
- Create: `src/components/operacional/estoque/EstoqueWorkspace.test.tsx`
- Create: `src/components/operacional/estoque/EstoqueMetricStrip.tsx`
- Create: `src/components/operacional/estoque/EstoqueMetricStrip.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `EstoqueWorkspace`, `EstoqueWorkspaceHeader`, `EstoqueToolbar` e `EstoqueDataViewport`.
- Produces: `EstoqueMetricStrip({ metrics, activeKey, onMetricClick })`.
- `EstoqueMetric` possui `key: string`, `label: string`, `value: string`, `description: string`, `icon: LucideIcon`, `tone: 'neutral' | 'information' | 'attention' | 'danger'` e `interactive: boolean`.

- [ ] **Step 1: Escrever testes de estrutura e acessibilidade**

```tsx
it('mantem barras fixas e apenas o viewport de dados rolavel', () => {
  render(
    <EstoqueWorkspace>
      <EstoqueWorkspaceHeader>Abas</EstoqueWorkspaceHeader>
      <EstoqueToolbar>Comandos</EstoqueToolbar>
      <EstoqueDataViewport>Tabela</EstoqueDataViewport>
    </EstoqueWorkspace>,
  );
  expect(screen.getByRole('region', { name: 'Mesa operacional de estoque' }))
    .toHaveClass('h-[calc(100dvh-var(--estoque-shell-offset))]', 'overflow-hidden');
  expect(screen.getByRole('region', { name: 'Dados do estoque' }))
    .toHaveClass('min-h-0', 'overflow-auto');
});

it('explica a metrica e aplica seu filtro', async () => {
  const onMetricClick = vi.fn();
  const criticalMetric: EstoqueMetric = {
    key: 'critical',
    label: 'Criticos',
    value: '1.624',
    description: 'Cobertura menor que 15 dias',
    icon: TriangleAlert,
    tone: 'danger',
    interactive: true,
  };
  render(<EstoqueMetricStrip metrics={[criticalMetric]} onMetricClick={onMetricClick} />);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Cobertura menor que 15 dias');
  await userEvent.click(screen.getByRole('button', { name: /Criticos/ }));
  expect(onMetricClick).toHaveBeenCalledWith('critical');
});
```

- [ ] **Step 2: Executar testes e confirmar falha**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx`

Expected: FAIL porque as primitivas nao existem.

- [ ] **Step 3: Implementar o workspace**

```tsx
export function EstoqueWorkspace({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      aria-label="Mesa operacional de estoque"
      className={cn(
        'flex h-[calc(100dvh-var(--estoque-shell-offset))] min-h-0 min-w-0 flex-col overflow-hidden',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function EstoqueDataViewport({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <section aria-label="Dados do estoque" className={cn('min-h-0 min-w-0 flex-1 overflow-auto', className)}>
      {children}
    </section>
  );
}
```

Definir `--estoque-shell-offset` no shell do modulo e usar 0 quando o workspace ja estiver dentro de um container de altura calculada. Nao aplicar `overflow-y-auto` em ancestrais do viewport de dados.

- [ ] **Step 4: Implementar a faixa de metricas**

```tsx
<section aria-label="Indicadores de estoque" className="flex h-[52px] min-w-0 shrink-0 overflow-x-auto border-y">
  {metrics.map(metric => (
    <MetricButton
      key={metric.key}
      metric={metric}
      active={metric.key === activeKey}
      onClick={() => metric.interactive && onMetricClick?.(metric.key)}
    />
  ))}
</section>
```

Cada item usa `min-w-[9rem] flex-1`, valor com `clamp(0.95rem,1.25vw,1.2rem)`, `whitespace-nowrap` e tooltip acessivel por foco e hover.

- [ ] **Step 5: Executar testes e verificar estilos globais**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx`

Run: `npm run lint -- --quiet`

Expected: PASS sem regras globais que escondam overflow fora do modulo.

- [ ] **Step 6: Commit**

```bash
git add src/components/operacional/estoque/EstoqueWorkspace.tsx src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx src/index.css
git commit -m "feat: criar workspace compacto de estoque"
```

### Task 3: Migrar a Central de Estoque

**Files:**
- Modify: `src/pages/operacional/EstoquePage.tsx`
- Modify: `src/components/operacional/estoque/EstoqueCommandCenter.tsx`
- Modify: `src/components/operacional/estoque/EstoqueSummaryCards.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductsTable.tsx`
- Modify: `src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`
- Modify: `src/components/operacional/estoque/EstoqueProductsTable.test.tsx`
- Modify: `src/pages/operacional/EstoquePage.test.tsx`

**Interfaces:**
- Consumes: primitivas da Task 2.
- Produces: Central sem cabecalho redundante, com toolbar, metricas e tabela no mesmo workspace.

- [ ] **Step 1: Escrever testes para remover faixas redundantes e controlar overflow**

```tsx
it('nao renderiza titulo e status em faixas permanentes', () => {
  renderPage();
  expect(screen.queryByRole('heading', { name: 'Gestao de Estoque' })).not.toBeInTheDocument();
  expect(screen.queryByText('Estoque recuperado')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Estado da fonte de estoque')).toBeInTheDocument();
});

it('mantem tabela e paginacao dentro do viewport de dados', () => {
  renderPage();
  const viewport = screen.getByRole('region', { name: 'Dados do estoque' });
  expect(within(viewport).getByRole('table')).toBeInTheDocument();
  expect(within(viewport).getByLabelText('Paginacao dos produtos')).toBeInTheDocument();
});
```

- [ ] **Step 2: Executar testes e confirmar falha**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Expected: FAIL porque o header, a faixa de status e a grade de cards ainda existem.

- [ ] **Step 3: Compor o workspace na pagina**

```tsx
<EstoqueWorkspace>
  <EstoqueWorkspaceHeader
    tabs={stockTabs}
    activeTab={activeTab}
    branch={branchName}
    sourceState={sourceStateLabel}
    updatedAt={displayedUpdate}
    onRefresh={refetch}
  />
  {activeTab === 'central' && <EstoqueCommandCenter {...centralProps} />}
  {activeTab === 'giro' && <GiroEstoqueTab {...giroProps} />}
  {activeTab === 'assistente' && <EstoqueAssistantTab {...assistantProps} />}
</EstoqueWorkspace>
```

Remover `PelegriniModuleHeader`, o wrapper `space-y-3` e a linha permanente de `sourceStateLabel`. Fonte parcial ou erro preservado deve usar o `Alert` ja importado, com `role="status"`, `py-1.5` e posicionamento `sticky top-0` dentro do viewport; o alerta recebe um botao de fechar local e nao cria um novo componente global.

- [ ] **Step 4: Migrar comandos e indicadores da Central**

Fazer `EstoqueCommandCenter` retornar `EstoqueToolbar`, `EstoqueMetricStrip` e `EstoqueDataViewport`. Converter `EstoqueSummaryCards` em um adaptador que gera `EstoqueMetric[]`, preservando os calculos e callbacks existentes.

- [ ] **Step 5: Remover altura fixa concorrente da tabela**

Em `EstoqueProductsTable`, substituir:

```tsx
<div className="max-h-[calc(100vh-20rem)] min-h-[18rem] min-w-max overflow-y-auto">
```

por:

```tsx
<div className="min-h-full min-w-max">
```

O `EstoqueDataViewport` passa a ser o unico dono da rolagem. Manter cabecalho sticky e paginacao sticky no fundo do viewport.

- [ ] **Step 6: Executar testes**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Expected: PASS com busca, filtros, metricas, drawer, colunas e exportacao funcionais.

- [ ] **Step 7: Commit**

```bash
git add src/pages/operacional/EstoquePage.tsx src/components/operacional/estoque/EstoqueCommandCenter.tsx src/components/operacional/estoque/EstoqueSummaryCards.tsx src/components/operacional/estoque/EstoqueProductsTable.tsx src/components/operacional/estoque/EstoqueCommandCenter.test.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx src/pages/operacional/EstoquePage.test.tsx
git commit -m "feat: compactar central de estoque"
```

### Task 4: Migrar o Giro de Estoque

**Files:**
- Modify: `src/components/operacional/GiroEstoqueTab.tsx`
- Modify: `src/components/operacional/GiroEstoqueTab.test.tsx`
- Modify: `src/components/operacional/estoque/GiroManagementPanel.tsx`
- Modify: `src/components/operacional/estoque/GiroManagementPanel.test.tsx`

**Interfaces:**
- Consumes: `normalizeGiroProducts` da Task 1 e workspace/metricas da Task 2.
- Produces: Giro com uma linha por produto/filial, toolbar unica e coluna Filial condicional.

- [ ] **Step 1: Escrever testes da composicao compacta**

```tsx
it('oculta filial quando todos os resultados pertencem ao mesmo contexto', () => {
  renderGiro({ activeCompanyCode: '1004', products: sameBranchProducts });
  expect(screen.queryByRole('columnheader', { name: 'Filial' })).not.toBeInTheDocument();
});

it('mostra uma linha por chave normalizada', () => {
  renderGiro({ giroData: duplicateMovementRows, estoqueData: oneStockRow });
  expect(screen.getAllByRole('row', { name: /produto 99/i })).toHaveLength(1);
});
```

- [ ] **Step 2: Executar testes e confirmar falha**

Run: `npm test -- --run src/components/operacional/GiroEstoqueTab.test.tsx src/components/operacional/estoque/GiroManagementPanel.test.tsx`

Expected: FAIL com coluna Filial sempre visivel e linhas duplicadas.

- [ ] **Step 3: Migrar busca, filtros e analise para `EstoqueToolbar`**

Remover o badge isolado de itens e o botao largo `Clique para filtrar...`. A toolbar deve conter busca, contagem compacta, botao Filtros com badge de filtros ativos e botao Analise de giro.

- [ ] **Step 4: Migrar indicadores para `EstoqueMetricStrip`**

Converter o retorno de `buildGiroManagementSummary` em seis metricas: Atendendo, Alerta, Ruptura, Excesso, Capital parado e Cobertura media. Os quatro status chamam `onStatusFilterChange`.

- [ ] **Step 5: Simplificar a tabela**

Remover altura propria e deixar `EstoqueDataViewport` controlar overflow. Exibir a coluna Filial apenas quando:

```ts
const showBranchColumn = new Set(sorted.map(item => item.empresa)).size > 1;
```

Substituir celula de regra textual por tooltip do badge de status. Usar colunas Produto, Marca, Status, Estoque, Valor, Vendas, Cobertura e Acao como padrao.

- [ ] **Step 6: Executar testes**

Run: `npm test -- --run src/components/operacional/GiroEstoqueTab.test.tsx src/components/operacional/estoque/GiroManagementPanel.test.tsx src/pages/operacional/EstoquePage.test.tsx`

Expected: PASS, incluindo abertura do drawer de analise e filtros por status.

- [ ] **Step 7: Commit**

```bash
git add src/components/operacional/GiroEstoqueTab.tsx src/components/operacional/GiroEstoqueTab.test.tsx src/components/operacional/estoque/GiroManagementPanel.tsx src/components/operacional/estoque/GiroManagementPanel.test.tsx
git commit -m "feat: transformar giro em mesa operacional"
```

### Task 5: Migrar o Assistente

**Files:**
- Modify: `src/components/operacional/EstoqueAssistantTab.tsx`
- Modify: `src/components/operacional/EstoqueAssistantTab.test.tsx`
- Modify: `src/pages/operacional/EstoquePage.test.tsx`

**Interfaces:**
- Consumes: `EstoqueToolbar` e `EstoqueDataViewport` da Task 2.
- Produces: Assistente sem header interno, com Chat/Insights e creditos na toolbar.

- [ ] **Step 1: Escrever testes de altura e hierarquia**

```tsx
it('remove o cabecalho duplicado e mantem compositor no viewport', () => {
  renderAssistant();
  expect(screen.queryByRole('heading', { name: 'Assistente de Estoque' })).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();
  expect(screen.getByTestId('stock-assistant-composer')).toHaveClass('shrink-0');
  expect(screen.getByTestId('stock-assistant-history')).toHaveClass('min-h-0', 'overflow-y-auto');
});
```

- [ ] **Step 2: Executar teste e confirmar falha**

Run: `npm test -- --run src/components/operacional/EstoqueAssistantTab.test.tsx`

Expected: FAIL porque o header e o subtitulo ainda sao renderizados.

- [ ] **Step 3: Reorganizar o Assistente**

```tsx
<div className="flex min-h-0 flex-1 flex-col">
  <EstoqueToolbar>
    <AssistantViewTabs value={activeView} onValueChange={setActiveView} />
    <AssistantCredits used={credits.used} limit={credits.limit} />
  </EstoqueToolbar>
  <EstoqueDataViewport className="flex flex-col overflow-hidden">
    {activeView === 'chat' ? <ChatTab compact /> : <InsightsTab compact />}
  </EstoqueDataViewport>
</div>
```

Remover `Assistente de Estoque`, `Chat e analise local disponiveis` e bordas duplicadas. O historico recebe `data-testid="stock-assistant-history"`; o compositor deixa de ser `sticky` e passa a `shrink-0`, pois o pai ja controla a altura.

- [ ] **Step 4: Executar testes**

Run: `npm test -- --run src/components/operacional/EstoqueAssistantTab.test.tsx src/pages/operacional/EstoquePage.test.tsx`

Expected: PASS com chat, insights, creditos e abertura de produto funcionando.

- [ ] **Step 5: Commit**

```bash
git add src/components/operacional/EstoqueAssistantTab.tsx src/components/operacional/EstoqueAssistantTab.test.tsx src/pages/operacional/EstoquePage.test.tsx
git commit -m "feat: compactar assistente de estoque"
```

### Task 6: Migrar Estoque Retroativo

**Files:**
- Modify: `src/pages/operacional/EstoqueRetroativoPage.tsx`
- Modify: `src/pages/operacional/EstoqueRetroativoPage.test.tsx`

**Interfaces:**
- Consumes: workspace, toolbar, metricas e viewport da Task 2.
- Produces: consulta retroativa com data e acoes em uma barra unica.

- [ ] **Step 1: Escrever testes de estrutura**

```tsx
it('usa a mesma mesa operacional da consulta atual', () => {
  renderRetroactive();
  expect(screen.getByRole('region', { name: 'Mesa operacional de estoque' })).toBeInTheDocument();
  const toolbar = screen.getByRole('toolbar', { name: 'Comandos do estoque retroativo' });
  expect(within(toolbar).getByLabelText('Data do estoque')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Dados do estoque' })).toContainElement(screen.getByRole('table'));
});
```

- [ ] **Step 2: Executar teste e confirmar falha**

Run: `npm test -- --run src/pages/operacional/EstoqueRetroativoPage.test.tsx`

Expected: FAIL porque a pagina ainda usa layout independente.

- [ ] **Step 3: Migrar a composicao**

Remover header e subtitulos proprios. Posicionar data de referencia, comparacao, atualizar e exportar no `EstoqueToolbar`. Converter totalizadores para `EstoqueMetricStrip` e envolver a tabela em `EstoqueDataViewport` sem `max-height` local.

- [ ] **Step 4: Executar testes**

Run: `npm test -- --run src/pages/operacional/EstoqueRetroativoPage.test.tsx src/pages/operacional/EstoquePage.test.tsx`

Expected: PASS e estrutura compartilhada nas duas rotas.

- [ ] **Step 5: Commit**

```bash
git add src/pages/operacional/EstoqueRetroativoPage.tsx src/pages/operacional/EstoqueRetroativoPage.test.tsx
git commit -m "feat: alinhar estoque retroativo ao workspace compacto"
```

### Task 7: Validacao Responsiva e Acabamento

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/operacional/estoque/EstoqueWorkspace.test.tsx`
- Modify: `src/pages/operacional/EstoquePage.test.tsx`
- Modify: `src/pages/operacional/EstoqueRetroativoPage.test.tsx`

**Interfaces:**
- Consumes: todas as entregas anteriores.
- Produces: comportamento verificado em 390, 768, 1024 e 1440 pixels, claro e escuro.

- [ ] **Step 1: Adicionar teste contra textos redundantes**

```tsx
it.each(['central', 'giro', 'assistente'])('nao repete titulo operacional em %s', tab => {
  renderPage({ tab });
  expect(screen.queryByText('Gestao de Estoque')).not.toBeInTheDocument();
  expect(screen.queryByText('Chat e analise local disponiveis')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Executar a suite completa**

Run: `npm test -- --run`

Expected: todos os testes passam.

- [ ] **Step 3: Executar lint e build**

Run: `npm run lint -- --quiet`

Expected: zero erros nos arquivos alterados.

Run: `npm run build`

Expected: build de producao concluido.

- [ ] **Step 4: Verificar visualmente em quatro larguras**

Abrir `/operacional/estoque` e `/operacional/estoque/retroativo` em 390, 768, 1024 e 1440 pixels. Em cada largura, conferir Central, Giro e Assistente nas duas filiais e nos modos claro/escuro.

Para 1024 e 1440, validar no navegador:

```js
({
  viewport: window.innerHeight,
  documentHeight: document.documentElement.scrollHeight,
  bodyHeight: document.body.scrollHeight,
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
})
```

Expected: `documentHeight <= viewport + 1`, `bodyHeight <= viewport + 1` e `horizontalOverflow === false`. A tabela, lista ou chat deve continuar rolando internamente.

- [ ] **Step 5: Conferir fluxos interativos**

Validar busca, abertura/limpeza de filtros, clique em cada indicador, ordenacao, seletor de colunas, drawer do produto, painel de Atencao, Analise de giro, Chat/Insights, atualizacao e exportacao.

Expected: nenhum comando muda a altura das barras ou cria uma segunda rolagem vertical.

- [ ] **Step 6: Commit de acabamento**

```bash
git add src/index.css src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/pages/operacional/EstoquePage.test.tsx src/pages/operacional/EstoqueRetroativoPage.test.tsx
git commit -m "test: validar mesa operacional de estoque"
```

- [ ] **Step 7: Revisar a diferenca final**

Run: `git status --short`

Expected: arvore limpa.

Run: `git log --oneline -8`

Expected: commits das sete tarefas em ordem, sem arquivos de outros modulos.
