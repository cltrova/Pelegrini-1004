# Central de Estoque CT/CCH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a experiencia fragmentada de Visao Geral e Detalhes por uma Central de Estoque responsiva, filtravel e orientada a atencao para CT e CCH.

**Architecture:** Manter `useEstoqueData` como unica fonte de dados e construir uma camada pura de inteligencia que relaciona estoque e giro. Componentes focados consomem o resultado calculado, enquanto `EstoqueCommandCenter` concentra busca, filtros, ordenacao, colunas, produto selecionado e exportacao. `EstoquePage` preserva as abas Giro e Assistente e apenas troca as duas abas antigas pela nova central.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/Radix, Recharts, TanStack Query, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-central-estoque-ct-cch-design.md`

## Global Constraints

- Nao alterar endpoints, payloads, permissoes, rotas protegidas ou o contrato de `useEstoqueData`.
- Aplicar a mesma estrutura a CT (`1004`) e CCH (`10041`) usando os temas existentes.
- Chamar o valor calculado de `Minimo operacional estimado`; nunca apresenta-lo como minimo oficial do ERP.
- Toda situacao deve combinar texto, icone e indicador visual, sem depender apenas de cor.
- A pagina nao pode apresentar rolagem horizontal em `390`, `768`, `1024` ou `1440px`.
- Busca e filtros rapidos sao imediatos; exportacao respeita exatamente a visao corrente.
- Sem dados de giro, manter quantidade, valor, zerados, busca e listagem; metricas de movimento mostram dados insuficientes.
- Alteracoes manuais devem seguir TDD: teste vermelho, implementacao minima, teste verde e commit.

---

## File Structure

- `src/components/operacional/estoque/estoqueIntelligence.ts`: calculos puros, busca, filtros, ordenacao e evolucao.
- `src/components/operacional/estoque/estoqueIntelligence.test.ts`: cobertura das regras de negocio visuais.
- `src/components/operacional/estoque/estoqueFixtures.ts`: fixtures deterministicas compartilhadas pelos testes.
- `src/components/operacional/estoque/EstoqueCommandCenter.tsx`: estado e composicao da central.
- `src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`: fluxos integrados da central.
- `src/components/operacional/estoque/EstoqueSummaryCards.tsx`: indicadores clicaveis.
- `src/components/operacional/estoque/EstoqueAttentionPanel.tsx`: alertas priorizados.
- `src/components/operacional/estoque/EstoqueSmartFilters.tsx`: busca, chips e acoes.
- `src/components/operacional/estoque/EstoqueMovementHighlights.tsx`: mais movimentados e parados.
- `src/components/operacional/estoque/EstoqueProductsTable.tsx`: tabela desktop, lista mobile, ordenacao e colunas.
- `src/components/operacional/estoque/EstoqueProductDrawer.tsx`: painel lateral do produto.
- `src/components/operacional/estoque/EstoqueMovementTimeline.tsx`: historico recente.
- `src/components/operacional/estoque/EstoqueEvolutionChart.tsx`: saldo estimado e tendencia.
- `src/pages/operacional/EstoquePage.tsx`: integracao da central e preservacao das abas existentes.
- `src/pages/operacional/EstoquePage.test.tsx`: contrato de integracao da pagina.

---

### Task 1: Stock Intelligence Foundation

**Files:**
- Create: `src/components/operacional/estoque/estoqueIntelligence.ts`
- Create: `src/components/operacional/estoque/estoqueIntelligence.test.ts`
- Create: `src/components/operacional/estoque/estoqueFixtures.ts`

**Interfaces:**
- Consumes: `EstoqueRecord` e `GiroRecord` de `src/types/estoque.ts`.
- Produces: `StockStatus`, `StockQuickFilter`, `StockProductInsight`, `StockEvolutionPoint`, `buildStockInsights`, `buildStockEvolution`, `filterStockInsights`, `sortStockInsights` e `normalizeStockSearch`.

- [ ] **Step 1: Criar fixtures deterministicas**

```ts
export const NOW = new Date('2026-09-01T12:00:00-03:00');

export const estoqueFixture: EstoqueRecord[] = [
  {
    cod_empresa_bi: 1004,
    cod_empresa: 1,
    empresa: 'CASA DA TRANSMISSAO',
    cod_produto: 101,
    produto: 'KIT EMBREAGEM PESADA',
    cod_fabricante: 'ZF-101',
    cod_fornecedor: '10',
    cod_grupo_produto: 5,
    grupo: 'EMBREAGEM',
    cod_marca_produto: 'ZF',
    marca: 'ZF',
    cod_linha: 'PESADA',
    linha: 'Linha pesada',
    nr_fabricante: '101-A',
    nr_original: 'GM-101',
    aplicacao_produto: 'CAMINHOES',
    classe_abc: 'A',
    quantidade_estoque: 10,
    data_ultima_compra: '2026-08-20',
    operacao_ultima_compra: 'COMPRA',
    data_ultima_transferencia: null,
    operacao_ultima_transferencia: null,
    data_ultima_venda: '2026-08-31',
    cod_cliente_ultima_venda: '1',
    cliente_ultima_venda: 'CLIENTE TESTE',
    quantidade_compra_produto: 20,
    valor_estoque: 5000,
    custo: 450,
    custo_fornecedor: 440,
    custo_medio: 500,
    custo_ultima_compra: 460,
    tipo_relatorio: 'FILIAL CONSOLIDADA',
  },
];
```

- [ ] **Step 2: Escrever testes vermelhos das regras principais**

```ts
it('calcula minimo de 30 dias e classifica cobertura inferior a 15 dias como critica', () => {
  const insights = buildStockInsights(estoqueFixture, giroFixture, NOW);
  expect(insights[0]).toMatchObject({
    operationalMinimum: 30,
    coverageDays: 10,
    status: 'critical',
  });
});

it('da precedencia a sem estoque mesmo quando existe consumo', () => {
  const zero = [{ ...estoqueFixture[0], quantidade_estoque: 0 }];
  expect(buildStockInsights(zero, giroFixture, NOW)[0].status).toBe('out');
});

it('busca sem acento por codigo, aplicacao e referencia', () => {
  const insight = buildStockInsights(estoqueFixture, giroFixture, NOW)[0];
  expect(filterStockInsights([insight], { search: 'caminhoes', quickFilter: 'all' })).toHaveLength(1);
  expect(filterStockInsights([insight], { search: 'GM-101', quickFilter: 'all' })).toHaveLength(1);
});
```

- [ ] **Step 3: Executar o teste e confirmar falha pelas funcoes ausentes**

Run: `npm test -- --run src/components/operacional/estoque/estoqueIntelligence.test.ts`

Expected: FAIL com importacoes ou funcoes ainda inexistentes.

- [ ] **Step 4: Implementar tipos e agregacao minima**

```ts
export type StockStatus = 'available' | 'low' | 'critical' | 'out';
export type StockQuickFilter = 'all' | StockStatus | 'stagnant' | 'with-stock';

export interface StockProductInsight extends EstoqueRecord {
  status: StockStatus;
  operationalMinimum: number;
  coverageDays: number | null;
  totalInbound: number;
  totalOutbound: number;
  totalMovement: number;
  lastMovementDate: string | null;
  stagnantDays: number;
  movementDataAvailable: boolean;
  movements: GiroRecord[];
}

export function buildStockInsights(
  stock: EstoqueRecord[],
  movement: GiroRecord[],
  now = new Date(),
): StockProductInsight[] {
  const start = new Date(now);
  start.setDate(start.getDate() - 90);
  const byProduct = new Map<string, GiroRecord[]>();
  movement.forEach(row => {
    const date = new Date(row.data_movimento);
    if (!Number.isFinite(date.getTime()) || date < start || date > now) return;
    const key = `${row.cod_empresa}:${row.cod_produto}`;
    byProduct.set(key, [...(byProduct.get(key) ?? []), row]);
  });

  return stock.map(item => {
    const movements = byProduct.get(`${item.cod_empresa}:${item.cod_produto}`) ?? [];
    const totalOutbound = movements.reduce(
      (sum, row) => sum + row.saida_venda + row.saida_transferencia + row.saida_outras + row.saida_devolucao,
      0,
    );
    const totalInbound = movements.reduce(
      (sum, row) => sum + row.entrada_compra + row.entrada_transferencia + row.entrada_outras + row.entrada_devolucao,
      0,
    );
    const firstMovement = movements.reduce(
      (min, row) => Math.min(min, new Date(row.data_movimento).getTime()),
      now.getTime(),
    );
    const coveredDays = movements.length
      ? Math.max(1, Math.min(90, Math.ceil((now.getTime() - firstMovement) / 86_400_000)))
      : 0;
    const dailyOutbound = coveredDays ? totalOutbound / coveredDays : 0;
    const operationalMinimum = Math.ceil(dailyOutbound * 30);
    const coverageDays = dailyOutbound > 0 ? item.quantidade_estoque / dailyOutbound : null;
    const status: StockStatus = item.quantidade_estoque <= 0
      ? 'out'
      : coverageDays !== null && coverageDays < 15
        ? 'critical'
        : coverageDays !== null && coverageDays < 30
          ? 'low'
          : 'available';

    const candidateDates = [
      ...movements.map(row => row.data_movimento),
      item.data_ultima_venda,
      item.data_ultima_compra,
      item.data_ultima_transferencia,
    ].filter((value): value is string => Boolean(value));
    const latestTimestamp = candidateDates.reduce(
      (max, value) => Math.max(max, new Date(value).getTime() || 0),
      0,
    );
    const lastMovementDate = latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
    const stagnantDays = latestTimestamp
      ? Math.max(0, Math.floor((now.getTime() - latestTimestamp) / 86_400_000))
      : 9999;

    return {
      ...item,
      status,
      operationalMinimum,
      coverageDays,
      totalInbound,
      totalOutbound,
      totalMovement: totalInbound + totalOutbound,
      lastMovementDate,
      stagnantDays,
      movementDataAvailable: movements.length > 0,
      movements: [...movements].sort((a, b) => b.data_movimento.localeCompare(a.data_movimento)),
    };
  });
}
```

- [ ] **Step 5: Adicionar testes e implementacao para parados, destaques e evolucao**

```ts
it('reconstroi o saldo anterior desfazendo entrada e saida', () => {
  const insight = buildStockInsights(estoqueFixture, giroFixture, NOW)[0];
  expect(buildStockEvolution(insight)).toEqual([
    { date: '2026-08-30', quantity: 25 },
    { date: '2026-08-31', quantity: 10 },
  ]);
});

it('classifica produto sem data na faixa superior a 180 dias', () => {
  const semDatas = estoqueFixture.map(item => ({
    ...item,
    data_ultima_compra: null,
    data_ultima_venda: null,
    data_ultima_transferencia: null,
  }));
  expect(buildStockInsights(semDatas, [], NOW)[0].stagnantDays).toBeGreaterThan(180);
});
```

- [ ] **Step 6: Testar filtros e ordenacao sem mutar os dados**

```ts
it('ordena por menor estoque sem mutar a entrada', () => {
  const original = buildStockInsights(estoqueFixtureComTresItens, giroFixture, NOW);
  const snapshot = [...original];
  const result = sortStockInsights(original, 'stock-asc');
  expect(result.map(item => item.quantidade_estoque)).toEqual([0, 10, 80]);
  expect(original).toEqual(snapshot);
});
```

- [ ] **Step 7: Executar os testes da camada de inteligencia**

Run: `npm test -- --run src/components/operacional/estoque/estoqueIntelligence.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/operacional/estoque
git commit -m "feat: add stock intelligence foundation"
```

---

### Task 2: Summary, Attention, Filters And Highlights

**Files:**
- Create: `src/components/operacional/estoque/EstoqueSummaryCards.tsx`
- Create: `src/components/operacional/estoque/EstoqueAttentionPanel.tsx`
- Create: `src/components/operacional/estoque/EstoqueSmartFilters.tsx`
- Create: `src/components/operacional/estoque/EstoqueMovementHighlights.tsx`
- Create: `src/components/operacional/estoque/EstoqueDashboardControls.test.tsx`

**Interfaces:**
- Consumes: `StockProductInsight`, `StockQuickFilter` e temas Pelegrini existentes.
- Produces: controles visuais puros com callbacks; nenhum componente possui fonte de dados propria.

- [ ] **Step 1: Escrever testes vermelhos dos indicadores e filtros**

```tsx
it('aplica e remove um filtro rapido pelo mesmo indicador', () => {
  const onFilterChange = vi.fn();
  render(
    <EstoqueSummaryCards
      products={insightsFixture}
      activeFilter="critical"
      onFilterChange={onFilterChange}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Criticos.*1/i }));
  expect(onFilterChange).toHaveBeenCalledWith('all');
});

it('identifica status com texto e icone acessivel', () => {
  render(<EstoqueAttentionPanel products={insightsFixture} onSelectProduct={vi.fn()} />);
  expect(screen.getByText('Sem estoque')).toBeInTheDocument();
  expect(screen.getByLabelText('Situacao: sem estoque')).toBeInTheDocument();
});
```

- [ ] **Step 2: Executar o teste e confirmar falha pelos componentes ausentes**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueDashboardControls.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementar indicadores com seis botoes estaveis**

```tsx
const summaries = [
  { key: 'all', label: 'Produtos', value: products.length, icon: Package },
  { key: 'value', label: 'Valor estimado', value: totalValue, icon: CircleDollarSign },
  { key: 'critical', label: 'Criticos', value: counts.critical, icon: Siren },
  { key: 'low', label: 'Estoque baixo', value: counts.low, icon: TriangleAlert },
  { key: 'out', label: 'Sem estoque', value: counts.out, icon: CircleOff },
  { key: 'stagnant', label: 'Parados', value: counts.stagnant, icon: PauseCircle },
] as const;
```

O card `value` nao altera o filtro. Os demais usam `onFilterChange(activeFilter === key ? 'all' : key)`.

- [ ] **Step 4: Implementar busca e chips ativos**

```tsx
<Input
  value={search}
  onChange={event => onSearchChange(event.target.value)}
  placeholder="Buscar codigo, produto, marca, grupo, aplicacao ou referencia"
  aria-label="Buscar no estoque"
/>
```

Usar `FilterDropdownChip` para marca, grupo e linha. Renderizar chips removiveis para busca, filtro rapido e dimensoes ativas.

- [ ] **Step 5: Implementar painel de atencao e destaques**

Priorizar `out`, `critical`, `low` e `stagnant`. Limitar o painel inicial a seis itens e os rankings a cinco itens. Cada linha e um botao que chama `onSelectProduct(product)`.

- [ ] **Step 6: Testar ausencia de giro**

```tsx
it('mostra dados insuficientes nos destaques sem esconder saldo e valor', () => {
  render(<EstoqueMovementHighlights products={insightsWithoutMovement} onSelectProduct={vi.fn()} />);
  expect(screen.getByText('Dados insuficientes para movimentacao')).toBeInTheDocument();
  expect(screen.getByText('10 em estoque')).toBeInTheDocument();
});
```

- [ ] **Step 7: Executar testes dos controles**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueDashboardControls.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/operacional/estoque
git commit -m "feat: add actionable stock dashboard controls"
```

---

### Task 3: Responsive Product List And Column Preferences

**Files:**
- Create: `src/components/operacional/estoque/EstoqueProductsTable.tsx`
- Create: `src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

**Interfaces:**
- Consumes: `StockProductInsight[]`, sort mode, branch key and selection callback.
- Produces: `onSortChange`, `onSelectProduct`, `onVisibleColumnsChange` and a desktop/mobile representation of the same filtered data.

- [ ] **Step 1: Escrever testes vermelhos da tabela**

```tsx
it('prioriza produto, quantidade, situacao e marca na lista compacta', () => {
  render(<EstoqueProductsTable {...baseProps} />);
  const mobileItem = screen.getByTestId('stock-mobile-item-101');
  expect(within(mobileItem).getByText('KIT EMBREAGEM PESADA')).toBeInTheDocument();
  expect(within(mobileItem).getByText('10')).toBeInTheDocument();
  expect(within(mobileItem).getByText('Critico')).toBeInTheDocument();
  expect(within(mobileItem).getByText('ZF')).toBeInTheDocument();
});

it('persiste colunas por filial', () => {
  render(<EstoqueProductsTable {...baseProps} branchKey="transmissao" />);
  fireEvent.click(screen.getByRole('button', { name: 'Escolher colunas' }));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Valor em estoque' }));
  expect(JSON.parse(localStorage.getItem('pelegrini:estoque:columns:transmissao')!)).not.toContain('value');
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementar definicao tipada de colunas**

```ts
export type StockColumnKey =
  | 'product' | 'brand' | 'group' | 'quantity' | 'minimum'
  | 'lastMovement' | 'status' | 'branch' | 'abc' | 'value'
  | 'averageCost' | 'line' | 'application' | 'originalReference' | 'location';

const defaultColumns: StockColumnKey[] = [
  'product', 'brand', 'group', 'quantity', 'minimum', 'lastMovement', 'status',
];
```

- [ ] **Step 4: Implementar tabela desktop e lista mobile**

Usar `hidden md:block` para tabela e `md:hidden` para lista. A tabela deve usar `min-w-0`, cabecalho fixo, rolagem horizontal apenas no proprio container e valores monetarios com `PelegriniResponsiveValue`.

- [ ] **Step 5: Implementar menu de colunas e ordenacao**

Usar `DropdownMenuCheckboxItem` para colunas opcionais e um `Select` para `stock-desc`, `stock-asc`, `product`, `last-movement` e `brand`. Impedir a remocao de `product`, `quantity` e `status`.

- [ ] **Step 6: Executar testes e lint do arquivo**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueProductsTable.test.tsx`

Run: `npx eslint src/components/operacional/estoque/EstoqueProductsTable.tsx`

Expected: ambos PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/operacional/estoque/EstoqueProductsTable.tsx src/components/operacional/estoque/EstoqueProductsTable.test.tsx
git commit -m "feat: add responsive stock product list"
```

---

### Task 4: Product Drawer, Movement Timeline And Evolution

**Files:**
- Create: `src/components/operacional/estoque/EstoqueProductDrawer.tsx`
- Create: `src/components/operacional/estoque/EstoqueMovementTimeline.tsx`
- Create: `src/components/operacional/estoque/EstoqueEvolutionChart.tsx`
- Create: `src/components/operacional/estoque/EstoqueProductDrawer.test.tsx`

**Interfaces:**
- Consumes: `StockProductInsight | null`, `StockEvolutionPoint[]` e `onOpenChange`.
- Produces: painel acessivel sem navegacao e detalhe baseado apenas em dados existentes.

- [ ] **Step 1: Escrever testes vermelhos do painel**

```tsx
it('abre o produto com minimo estimado e historico real', () => {
  render(<EstoqueProductDrawer product={criticalInsight} open onOpenChange={vi.fn()} />);
  expect(screen.getByRole('dialog', { name: /KIT EMBREAGEM PESADA/i })).toBeInTheDocument();
  expect(screen.getByText('Minimo operacional estimado')).toBeInTheDocument();
  expect(screen.getByText('Entrada +20')).toBeInTheDocument();
  expect(screen.getByText('Saida -15')).toBeInTheDocument();
});

it('rotula a evolucao como estimada', () => {
  render(<EstoqueEvolutionChart points={evolutionFixture} movementDataAvailable />);
  expect(screen.getByText('Evolucao estimada do saldo')).toBeInTheDocument();
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueProductDrawer.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementar `Sheet` acessivel**

```tsx
const statusLabels: Record<StockStatus, string> = {
  available: 'Disponivel',
  low: 'Estoque baixo',
  critical: 'Critico',
  out: 'Sem estoque',
};

const formatCoverage = (days: number | null) =>
  days === null ? 'Dados insuficientes' : `${Math.max(0, Math.floor(days))} dias`;

<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
    <SheetHeader>
      <SheetTitle>{product.produto}</SheetTitle>
      <SheetDescription>Codigo {product.cod_produto} · {product.marca}</SheetDescription>
    </SheetHeader>
    <Badge aria-label={`Situacao: ${statusLabels[product.status]}`}>
      {statusLabels[product.status]}
    </Badge>
    <dl className="grid grid-cols-2 gap-3">
      <div><dt>Quantidade</dt><dd>{product.quantidade_estoque} unidades</dd></div>
      <div><dt>Minimo operacional estimado</dt><dd>{product.operationalMinimum}</dd></div>
      <div><dt>Cobertura</dt><dd>{formatCoverage(product.coverageDays)}</dd></div>
      <div><dt>Grupo</dt><dd>{product.grupo || 'Sem grupo'}</dd></div>
      <div><dt>Linha</dt><dd>{product.linha || 'Sem linha'}</dd></div>
      <div><dt>Aplicacao</dt><dd>{product.aplicacao_produto || 'Nao informada'}</dd></div>
    </dl>
    <EstoqueMovementTimeline movements={product.movements} />
    <EstoqueEvolutionChart
      points={buildStockEvolution(product)}
      movementDataAvailable={product.movementDataAvailable}
    />
  </SheetContent>
</Sheet>
```

- [ ] **Step 4: Implementar linha do tempo**

Ordenar movimentos por data decrescente, limitar a 20 e calcular rotulo pela precedencia: compra, entrada por transferencia, outras entradas, venda, saida por transferencia e outras saidas. Exibir sinal `+` ou `-`, data e quantidade.

- [ ] **Step 5: Implementar grafico compacto**

Usar `ResponsiveContainer`, `AreaChart`, `XAxis`, `YAxis`, `Tooltip` e `Area`. Sem gradiente; a linha usa `var(--pelegrini-primary)`. Quando nao houver pontos suficientes, renderizar estado vazio textual.

- [ ] **Step 6: Testar ausencia de movimento e fechamento por Escape**

```tsx
it('mantem dados do produto quando o giro esta indisponivel', () => {
  render(<EstoqueProductDrawer product={insightWithoutMovement} open onOpenChange={vi.fn()} />);
  expect(screen.getByText('10 unidades')).toBeInTheDocument();
  expect(screen.getByText('Historico indisponivel')).toBeInTheDocument();
});
```

- [ ] **Step 7: Executar testes do detalhe**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueProductDrawer.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/operacional/estoque
git commit -m "feat: add stock product detail drawer"
```

---

### Task 5: Command Center Orchestration

**Files:**
- Create: `src/components/operacional/estoque/EstoqueCommandCenter.tsx`
- Create: `src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`

**Interfaces:**
- Consumes: `stockData`, `movementData`, `branchKey`, `viewMode`, `onViewModeChange` e `onExport`.
- Produces: composicao completa e `onExport(filteredRecords)` com a visao corrente.

- [ ] **Step 1: Escrever teste vermelho do fluxo completo**

```tsx
it('busca, filtra por critico, abre produto e exporta a mesma visao', () => {
  const onExport = vi.fn();
  render(<EstoqueCommandCenter {...fixtureProps} onExport={onExport} />);

  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar no estoque' }), {
    target: { value: 'embreagem' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Criticos.*1/i }));
  expect(screen.getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: /Abrir KIT EMBREAGEM PESADA/i }));
  expect(screen.getByRole('dialog', { name: /KIT EMBREAGEM PESADA/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));
  expect(onExport).toHaveBeenCalledWith([expect.objectContaining({ cod_produto: 101 })]);
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implementar estado central**

```ts
const [search, setSearch] = useState('');
const [quickFilter, setQuickFilter] = useState<StockQuickFilter>('all');
const [brands, setBrands] = useState<string[]>([]);
const [groups, setGroups] = useState<string[]>([]);
const [lines, setLines] = useState<string[]>([]);
const [sortMode, setSortMode] = useState<StockSortMode>('stock-desc');
const [selectedProduct, setSelectedProduct] = useState<StockProductInsight | null>(null);

const insights = useMemo(
  () => buildStockInsights(stockData, movementData),
  [stockData, movementData],
);
const filtered = useMemo(
  () => sortStockInsights(filterStockInsights(insights, { search, quickFilter, brands, groups, lines }), sortMode),
  [insights, search, quickFilter, brands, groups, lines, sortMode],
);
```

- [ ] **Step 4: Compor controles, alertas, tabela, destaques e drawer**

Ordem visual: barra principal, indicadores, atencao, tabela/lista, destaques. O drawer fica no fim da arvore e recebe `selectedProduct`.

- [ ] **Step 5: Garantir troca de modo sem perder busca e filtros**

O callback `onViewModeChange` troca apenas a fonte consolidada/detalhada na pagina. Busca e filtros locais permanecem enquanto o componente estiver montado.

- [ ] **Step 6: Executar testes integrados**

Run: `npm test -- --run src/components/operacional/estoque/EstoqueCommandCenter.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/operacional/estoque
git commit -m "feat: compose stock command center"
```

---

### Task 6: Integrate Into Estoque Page

**Files:**
- Modify: `src/pages/operacional/EstoquePage.tsx`
- Create: `src/pages/operacional/EstoquePage.test.tsx`

**Interfaces:**
- Consumes: `EstoqueCommandCenter`, `useEstoqueData`, `GiroEstoqueTab` e `EstoqueAssistantTab`.
- Produces: rota `/operacional/estoque` com abas `central`, `giro` e `assistente`.

- [ ] **Step 1: Escrever teste vermelho de integracao**

```tsx
it('mostra a Central de Estoque e preserva Giro e Assistente', () => {
  render(<EstoquePage />);
  expect(screen.getByRole('tab', { name: 'Central de Estoque' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Giro de Estoque' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Assistente' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Detalhes do Produto' })).not.toBeInTheDocument();
});
```

Mockar apenas `useEstoqueData`; usar os componentes reais da central em um segundo teste para garantir o contrato.

- [ ] **Step 2: Executar e confirmar falha pela estrutura antiga**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx`

Expected: FAIL porque a pagina ainda usa `visao-geral` e `detalhes`.

- [ ] **Step 3: Substituir as duas abas antigas pela central**

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <PelegriniTabs
    value={activeTab}
    onValueChange={setActiveTab}
    items={[
      { value: 'central', label: 'Central de Estoque', icon: LayoutDashboard },
      { value: 'giro', label: 'Giro de Estoque', icon: RefreshCw },
      { value: 'assistente', label: 'Assistente', icon: Bot },
    ]}
  />
  <TabsContent value="central">
    <EstoqueCommandCenter
      stockData={estoqueData}
      movementData={giroData}
      branchKey={filialAtiva || 'transmissao'}
      viewMode={estoqueFilters.viewMode}
      onViewModeChange={handleViewModeChange}
      onExport={exportToExcel}
    />
  </TabsContent>
</Tabs>
```

- [ ] **Step 4: Remover estado e JSX de filtros duplicados da pagina**

Excluir `pendingEstoque`, `UnifiedFilterBar` e busca antiga apenas para a aba central. Preservar integralmente `pendingGiro`, filtros de giro, `GiroEstoqueTab` e `EstoqueAssistantTab`.

- [ ] **Step 5: Preservar loading, modulo desativado e erro**

Manter os guards atuais. Para `isError`, renderizar `EmptyState` com mensagem de falha e acao de recarregar a pagina somente se esse comportamento ja existir no componente; nao mudar o hook.

- [ ] **Step 6: Executar testes da pagina e regressao operacional**

Run: `npm test -- --run src/pages/operacional/EstoquePage.test.tsx src/utils/estoque10041.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/operacional/EstoquePage.tsx src/pages/operacional/EstoquePage.test.tsx
git commit -m "feat: integrate stock command center"
```

---

### Task 7: Regression, Accessibility And Visual Verification

**Files:**
- Modify only files with defects proven by this task's checks.
- Record verification notes in `.superpowers/sdd/2026-09-01-central-estoque-ct-cch/task-7-report.md`.

**Interfaces:**
- Consumes: complete Tasks 1-6 implementation.
- Produces: verified branch ready for integration; no new public interface.

- [ ] **Step 1: Executar toda a suite**

Run: `npm test -- --run`

Expected: all test files and tests PASS.

- [ ] **Step 2: Executar lint do escopo**

Run: `npx eslint src/components/operacional/estoque src/pages/operacional/EstoquePage.tsx src/pages/operacional/EstoquePage.test.tsx`

Expected: PASS sem erros ou avisos novos.

- [ ] **Step 3: Gerar build de producao**

Run: `npm run build`

Expected: exit `0`; avisos preexistentes de bundle ou Browserslist devem ser classificados no relatorio.

- [ ] **Step 4: Verificar CT e CCH no navegador**

Para cada filial, abrir `/operacional/estoque` em `1440x900`, `1024x900`, `768x900` e `390x844`. Registrar:

```js
({
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  hasPageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
})
```

Expected: `hasPageOverflow === false` em todas as combinacoes.

- [ ] **Step 5: Verificar fluxos reais**

Em CT e CCH:

1. Buscar por codigo e limpar.
2. Aplicar Criticos e remover pelo mesmo card.
3. Aplicar marca e grupo; remover chips individualmente.
4. Abrir produto, conferir status, historico e evolucao; fechar com `Escape`.
5. Alterar colunas, recarregar e confirmar persistencia por filial.
6. Ordenar por menor estoque e ultima movimentacao.
7. Exportar e confirmar que a quantidade exportada corresponde a visao filtrada.
8. Conferir estado sem giro com dados insuficientes.

- [ ] **Step 6: Verificar acessibilidade basica**

- Todos os botoes possuem nome acessivel.
- Status exibem texto e icone.
- O `Sheet` prende foco, fecha por `Escape` e devolve foco.
- Indicadores ativos usam `aria-pressed`.
- Menu de colunas usa itens checkbox.
- Nenhum controle oculto permanece na ordem de foco mobile.

- [ ] **Step 7: Corrigir apenas defeitos comprovados com RED/GREEN**

Para cada defeito, adicionar um teste que falha pelo motivo correto, implementar a menor correcao e repetir teste focado, suite e browser check afetado.

- [ ] **Step 8: Verificar integridade do diff**

Run: `git diff --check`

Expected: exit `0`.

- [ ] **Step 9: Commit de correcoes finais, se houver**

```bash
git add src/components/operacional/estoque src/pages/operacional/EstoquePage.tsx src/pages/operacional/EstoquePage.test.tsx
git commit -m "fix: close stock command center audit gaps"
```

Nao criar commit vazio.

---

## Plan Self-Review

- Spec coverage: busca, indicadores, filtros, atencao, tabela, colunas, exportacao, drawer, historico, evolucao, mais movimentados, parados, CT/CCH, ausencia de giro e responsividade estao mapeados para Tasks 1-7.
- Placeholder scan: o plano nao contem marcadores pendentes nem referencias vagas a tarefas anteriores.
- Type consistency: `StockProductInsight`, `StockQuickFilter`, `StockStatus`, `StockEvolutionPoint` e `StockColumnKey` sao produzidos antes de seus consumidores.
- Scope: `useEstoqueData`, endpoints, permissoes e contratos externos permanecem intactos.
