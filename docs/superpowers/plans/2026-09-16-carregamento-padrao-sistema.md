# Carregamento Padrao do Sistema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Padronizar todos os carregamentos visiveis com o arco azul central da gravacao, mantendo o escopo correto e a fluidez da interface.

**Architecture:** `LoadingIndicator` sera a primitiva visual sem layout, e `LoadingState` controlara os escopos `screen`, `content` e `inline`. Guardas e carregamentos bloqueantes usarao o componente central; atualizacoes com dados validos e acoes curtas preservarao o conteudo e usarao apenas o indicador inline.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-09-16-carregamento-padrao-sistema-design.md`

## Global Constraints

- Nao adicionar biblioteca nova.
- Nao exibir texto nos carregamentos bloqueantes; manter rotulo acessivel.
- Nao adicionar cartao, borda, sombra ou arredondamento ao carregamento.
- Preservar dados validos durante atualizacao em segundo plano.
- Suportar temas claro/escuro e `prefers-reduced-motion`.
- Evitar mudanca de tamanho em botoes e regioes de conteudo.

---

### Task 1: Criar a primitiva visual central

**Files:**
- Modify: `src/components/common/LoadingState.tsx`
- Modify: `src/components/pelegrini/PelegriniVisuals.test.tsx`

**Interfaces:**
- Produces: `LoadingIndicator({ size?, className? })`
- Produces: `LoadingState({ message?, className?, size?, variant?, surface? })`
- `variant` aceita `'screen' | 'content' | 'inline'` e usa `'content'` como padrao.

- [ ] **Step 1: Escrever testes que descrevem o novo contrato**

Adicionar testes que renderizam os tres escopos, verificam `role="status"`, rotulo acessivel, ausencia de mensagem visivel, arco decorativo, `motion-reduce:animate-none` e classes de dimensao por variante.

```tsx
it('renders the video-inspired loader without visible copy', () => {
  render(<LoadingState message="Carregando estoque" variant="content" />);
  expect(screen.getByRole('status', { name: 'Carregando estoque' })).toBeInTheDocument();
  expect(screen.queryByText('Carregando estoque')).not.toBeInTheDocument();
  expect(screen.getByTestId('loading-indicator')).toHaveAttribute('aria-hidden', 'true');
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: FAIL porque `variant`, `LoadingIndicator` e `data-testid="loading-indicator"` ainda nao existem.

- [ ] **Step 3: Implementar o arco e os escopos**

Usar um elemento circular com borda tenue e apenas um segmento azul destacado. Manter a prop `surface` temporariamente, sem efeito visual, para compatibilidade durante a migracao.

```tsx
export type LoadingVariant = 'screen' | 'content' | 'inline';

export function LoadingIndicator({ size = 'md', className }: LoadingIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      data-testid="loading-indicator"
      className={cn(
        'block shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none',
        indicatorSizes[size],
        className,
      )}
    />
  );
}
```

O escopo `screen` usa `min-h-screen`; `content` usa `min-h-64 w-full`; `inline` usa somente `inline-flex` sem padding proprio.

- [ ] **Step 4: Executar o teste e validar o resultado**

Run: `npm test -- src/components/pelegrini/PelegriniVisuals.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commitar a primitiva**

```bash
git add src/components/common/LoadingState.tsx src/components/pelegrini/PelegriniVisuals.test.tsx
git commit -m "feat: standardize loading indicator"
```

### Task 2: Padronizar inicializacao, rotas e permissoes

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/auth/RequireRole.tsx`
- Modify: `src/components/auth/RequireModule.tsx`
- Modify: `src/components/auth/ApplicationEntryGate.test.tsx`

**Interfaces:**
- Consumes: `LoadingState` com `variant="screen"` da Task 1.
- Produces: um unico estado visual para auth, empresa, permissoes, redirecionamento financeiro e `Suspense`.

- [ ] **Step 1: Adicionar as expectativas de carregamento global**

Cobrir um guard em espera e confirmar que existe um unico status acessivel sem o spinner duplicado por `border-b-2`.

```tsx
expect(screen.getByRole('status', { name: 'Carregando aplicacao' })).toBeInTheDocument();
expect(document.querySelector('.border-b-2')).not.toBeInTheDocument();
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm test -- src/components/auth/ApplicationEntryGate.test.tsx --run`

Expected: FAIL com o carregamento antigo dos guardas.

- [ ] **Step 3: Substituir os spinners globais**

Importar `LoadingState`, fazer `GuardSpinner` retornar `<LoadingState message="Carregando aplicacao" variant="screen" />` e reutiliza-lo em `FinanceiroIndexRedirect`, `RequireRole` e `RequireModule`.

- [ ] **Step 4: Executar os testes de autenticacao**

Run: `npm test -- src/components/auth/ApplicationEntryGate.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commitar a camada global**

```bash
git add src/App.tsx src/components/auth/RequireRole.tsx src/components/auth/RequireModule.tsx src/components/auth/ApplicationEntryGate.test.tsx
git commit -m "refactor: unify application loading guards"
```

### Task 3: Migrar carregamentos bloqueantes do Comercial

**Files:**
- Modify: `src/pages/comercial/MetasVendedoresPage.tsx`
- Modify: `src/pages/comercial/MetasDiariasPage.tsx`
- Modify: `src/pages/comercial/ProdutosPage.tsx`
- Modify: `src/pages/comercial/ClientesPage.tsx`
- Modify: `src/pages/comercial/ComissaoPage.tsx`
- Modify: `src/pages/comercial/CotacoesAbertasPage.tsx`
- Modify: `src/pages/comercial/VendasPerdidasPage.tsx`
- Modify: `src/pages/comercial/VendedoresPage.tsx`
- Modify: `src/components/comercial/ReceitaDetalheDialog.tsx`
- Modify: `src/pages/comercial/MetasVendedoresPage.test.tsx`
- Modify: `src/pages/comercial/ProdutosPage.test.tsx`
- Modify: `src/pages/comercial/ClientesPage.test.tsx`
- Modify: `src/pages/comercial/ComissaoPage.test.tsx`
- Modify: `src/pages/comercial/CotacoesComerciaisPages.test.tsx`

**Interfaces:**
- Consumes: `LoadingState variant="content"` e `LoadingIndicator size="sm"`.
- Produces: carregamentos iniciais sem texto e atualizacoes de filtro sem dados antigos.

- [ ] **Step 1: Atualizar testes das paginas principais**

Trocar expectativas de texto visivel por status acessivel. Preservar as assercoes que confirmam que o estado desaparece depois da resposta.

```tsx
expect(screen.getByRole('status', { name: 'Carregando produtos' })).toBeInTheDocument();
expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument();
```

- [ ] **Step 2: Executar os testes do Comercial e confirmar as falhas**

Run: `npm test -- src/pages/comercial --run`

Expected: FAIL nas paginas que ainda exibem texto ou spinners personalizados.

- [ ] **Step 3: Migrar estados bloqueantes e fallbacks de abas**

Usar `LoadingState` nas areas completas. Substituir `LazyTabFallback`, `RefreshCw` ou `Loader2` usados como espera de conteudo por `LoadingIndicator`; manter atualizacoes com dados existentes restritas ao botao de atualizar.

- [ ] **Step 4: Executar novamente os testes do Comercial**

Run: `npm test -- src/pages/comercial --run`

Expected: PASS.

- [ ] **Step 5: Commitar o modulo Comercial**

```bash
git add src/pages/comercial src/components/comercial
git commit -m "refactor: apply standard loader to commercial"
```

### Task 4: Migrar Operacional e Financeiro

**Files:**
- Modify: `src/pages/operacional/EstoquePage.tsx`
- Modify: `src/pages/operacional/DistribuidoresPage.tsx`
- Modify: `src/pages/operacional/EstoqueRetroativoPage.tsx`
- Modify: `src/components/operacional/EstoqueRelatorioNovosClientesTab.tsx`
- Modify: `src/components/operacional/EstoqueAssistantTab.tsx`
- Modify: `src/components/operacional/estoque/DistributorEvolutionTab.tsx`
- Modify: `src/components/financeiro/SaldoAVencerTab.tsx`
- Modify: `src/components/variacao/DfcConfigTab.tsx`
- Modify: `src/pages/operacional/EstoquePage.test.tsx`
- Modify: `src/pages/operacional/DistribuidoresPage.test.tsx`
- Modify: `src/pages/operacional/EstoqueRetroativoPage.test.tsx`
- Modify: `src/components/operacional/EstoqueAssistantTab.test.tsx`
- Modify: `src/components/operacional/estoque/DistributorEvolutionTab.test.tsx`

**Interfaces:**
- Consumes: componentes da Task 1.
- Produces: estados de pagina e painel consistentes, sem bloquear a tela inteira durante refresh local.

- [ ] **Step 1: Atualizar os testes de Estoque, Distribuidores e Assistente**

Em cada fixture que mantem a consulta pendente, confirmar o status acessivel e a ausencia de texto visivel. No teste de refetch com dados existentes, confirmar que a tabela continua montada.

```tsx
expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
expect(screen.queryByText(/^carregando/i)).not.toBeInTheDocument();
```

```tsx
await user.click(screen.getByRole('button', { name: /atualizar/i }));
expect(screen.getByRole('table')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /atualizar/i })).toHaveAttribute('aria-busy', 'true');
```

- [ ] **Step 2: Executar os testes dos dois modulos e confirmar as falhas**

Run: `npm test -- src/pages/operacional src/components/operacional src/components/financeiro src/components/variacao --run`

Expected: FAIL nos carregamentos personalizados ainda nao migrados.

- [ ] **Step 3: Substituir carregamentos de conteudo e inline**

Aplicar `LoadingState` em consultas iniciais e `LoadingIndicator` em botoes, assistente e atualizacoes locais. Nao esconder graficos ou tabelas durante refetch quando seus dados atuais ainda forem validos.

- [ ] **Step 4: Executar novamente os testes dos modulos**

Run: `npm test -- src/pages/operacional src/components/operacional src/components/financeiro src/components/variacao --run`

Expected: PASS.

- [ ] **Step 5: Commitar Operacional e Financeiro**

```bash
git add src/pages/operacional src/components/operacional src/components/financeiro src/components/variacao
git commit -m "refactor: standardize operational and financial loading"
```

### Task 5: Migrar WhatsApp e Configuracoes

**Files:**
- Modify: `src/components/whatsapp/reports/ClientsReportTab.tsx`
- Modify: `src/components/whatsapp/reports/AgentsReportTab.tsx`
- Modify: `src/components/whatsapp/settings/agents/AgentConnection.tsx`
- Modify: `src/components/whatsapp/input/AIComposer.tsx`
- Modify: `src/components/whatsapp/input/AudioRecorder.tsx`
- Modify: `src/components/whatsapp/input/SmartReplies.tsx`
- Modify: `src/pages/configuracoes/EmpresasPage.tsx`
- Modify: `src/components/configuracoes/UserList.tsx`
- Modify: `src/components/configuracoes/UserFormDialog.tsx`
- Modify: `src/components/configuracoes/EstoqueAssistantSettings.tsx`
- Create: `src/components/whatsapp/reports/ReportsLoading.test.tsx`
- Modify: `src/components/configuracoes/EstoqueAssistantSettings.test.tsx`

**Interfaces:**
- Consumes: componentes da Task 1.
- Produces: carregamentos consistentes em relatorios, conexoes, composicao de mensagens e administracao.

- [ ] **Step 1: Adicionar testes de relatorio e configuracao**

No novo teste de relatorios, mockar a consulta pendente e confirmar `LoadingState` sem mensagem visivel. No teste do assistente, iniciar o salvamento e confirmar que o botao mantem o nome acessivel e recebe o indicador pequeno.

```tsx
expect(screen.getByRole('status', { name: 'Carregando dados de clientes...' })).toBeInTheDocument();
expect(screen.queryByText('Carregando dados de clientes...')).not.toBeInTheDocument();
```

```tsx
await user.click(screen.getByRole('button', { name: /salvar/i }));
expect(screen.getByRole('button', { name: /salvar/i })).toHaveAttribute('aria-busy', 'true');
expect(within(screen.getByRole('button', { name: /salvar/i })).getByTestId('loading-indicator')).toBeInTheDocument();
```

- [ ] **Step 2: Executar os testes e confirmar as falhas**

Run: `npm test -- src/components/whatsapp src/pages/configuracoes src/components/configuracoes --run`

Expected: FAIL nos indicadores legados.

- [ ] **Step 3: Migrar os indicadores**

Usar `LoadingState` em corpos vazios e `LoadingIndicator` em botoes e campos. Preservar rotulos de estado necessarios, como `Conectando`, sem usar mensagem extra no centro do painel.

- [ ] **Step 4: Executar novamente os testes**

Run: `npm test -- src/components/whatsapp src/pages/configuracoes src/components/configuracoes --run`

Expected: PASS.

- [ ] **Step 5: Commitar WhatsApp e Configuracoes**

```bash
git add src/components/whatsapp src/pages/configuracoes src/components/configuracoes
git commit -m "refactor: standardize remaining loading states"
```

### Task 6: Auditoria e validacao visual final

**Files:**
- Modify: arquivos residuais apontados pela auditoria somente quando exibirem carregamento ao usuario.
- Modify: testes afetados pela auditoria.

**Interfaces:**
- Consumes: todo o padrao implementado nas Tasks 1-5.
- Produces: sistema sem spinners bloqueantes divergentes.

- [ ] **Step 1: Auditar indicadores residuais**

Run: `rg -n "Loader2|LoaderCircle|animate-spin|Carregando" src --glob "*.tsx"`

Classificar cada resultado como bloqueante, inline ou texto de negocio. Migrar os indicadores visuais restantes e manter somente casos justificados de animacao inline.

- [ ] **Step 2: Executar lint, suite e build**

Run: `npm run lint`

Expected: sem novos erros.

Run: `npm test -- --run`

Expected: PASS.

Run: `npm run build`

Expected: build concluido.

- [ ] **Step 3: Validar visualmente os breakpoints**

Iniciar o servidor local e conferir carregamento inicial, troca de modulo e filtro em 1440, 1024, 768 e 390 px, nos temas claro e escuro. Confirmar arco central, fundo estavel, ausencia de texto, layout shift, sobreposicao e rolagem horizontal.

- [ ] **Step 4: Commitar ajustes finais**

```bash
git add src
git commit -m "fix: complete system loading standardization"
```
