# Task 3 Report - Primitivas quadradas e estaveis para o Estoque

## Resultado

Task 3 implementada exclusivamente nos arquivos autorizados. Os wrappers de estoque agora expõem classes semanticas estaveis, e a folha do Operacional aplica raios, remocao de sombras/gradientes e transicoes sem afetar outros modulos.

## TDD

### RED

Comando:

```text
npm test -- src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx --run
```

Resultado: 2 arquivos falharam; 3 testes falharam e 3 passaram. As novas assercoes falharam pelas classes `operational-workspace` e `operational-metric-strip` ausentes. O run tambem reproduziu a falha preexistente documentada no ledger: a expectativa de `21ch` nao correspondia mais a implementacao atual.

### GREEN

Comando:

```text
npm test -- src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx src/styles/operacional-square.test.ts --run
```

Resultado: 3 arquivos passaram; 11 testes passaram; 0 falhas.

## Implementacao

- Adicionadas as classes `operational-workspace`, `operational-workspace-header`, `operational-toolbar` e `operational-data-viewport` aos quatro wrappers existentes.
- Adicionada `operational-metric-strip` a raiz da faixa de metricas.
- Adicionadas as regras CSS previstas para paineis, utilitarios de raio, controles, transicoes e neutralizacao de hover decorativo, sempre sob o shell Operacional.
- Preservada `.rounded-full` fora dos seletores amplos.
- Atualizada a expectativa obsoleta de largura por item para o contrato vigente da grade rolavel `min-w-[54rem]`, introduzido anteriormente pelo commit `9a92699`.
- Mantido o seletor estrutural em uma linha para que o teste de isolamento da Task 1 nao interprete itens internos de `:where(...)` como seletores globais.

## Auto-revisao

- Nenhuma prop, role, texto funcional, estado, calculo ou callback foi alterado.
- As classes fornecidas pelo chamador continuam sendo mescladas por `cn` depois das classes estruturais.
- As regras novas nao escapam de `[data-module-shell='operacional']`.
- `git diff --check` nao encontrou whitespace invalido.
- Os arquivos preexistentes protegidos permaneceram fora do diff, do stage e do commit desta task.

## Commit

Mensagem prevista: `feat: add stable operational workspace primitives`.

## Preocupacoes

- A suite completa ja possuia falhas e timeouts anteriores, conforme `progress.md`; esta task foi validada com a suite focada definida no brief.
- O Git informou apenas que alguns arquivos LF serao convertidos para CRLF quando forem tocados futuramente; isso nao gerou erro de whitespace nem alteracao integral de fim de linha no diff.

## Fix Round 1

### Feedback tratado

- A grade fixa `grid-cols-6` nao fazia a largura minima global de `54rem` proteger individualmente um valor longo contra invasao da celula seguinte.
- A regra de transicao dos controles nao neutralizava `transition-transform` e `group-hover:translate` aplicados a descendentes.

### RED

Comando:

```text
npm test -- src/components/operacional/estoque/EstoqueWorkspace.test.tsx src/components/operacional/estoque/EstoqueMetricStrip.test.tsx src/styles/operacional-square.test.ts --run
```

Resultado: 2 arquivos falharam; 2 testes falharam e 10 passaram. O teste da faixa encontrou o agrupador `grid` sem minimo por metrica; o teste CSS nao encontrou neutralizacao para descendentes transformaveis.

### Implementacao

- O agrupador de metricas passou a `flex`, mantendo `min-w-[54rem]` e `overflow-x-auto` na faixa.
- Cada metrica passou a reservar `max(9rem, calc(Nch + 3rem))`, onde `N` e o comprimento do valor renderizado; o espaco adicional cobre icone, gap e padding.
- O teste compara valores curto e longo com expectativas literais, confirma fluxo flexivel, scroll na faixa e ausencia de classes de recorte no valor.
- O CSS escopado substitui `transition-transform` pelas transicoes permitidas de cor/opacidade e neutraliza `group-hover:translate` com `transform: none !important`.
- `.animate-spin` nao aparece nesses seletores e nenhuma propriedade `animation` foi neutralizada, preservando loading semantico.

### Verificacao isolada

- `EstoqueMetricStrip.test.tsx`: 3 testes passaram.
- `operacional-square.test.ts`: 6 testes passaram.

### Verificacao final

- Suite focada da Task 3: 3 arquivos e 12 testes passaram, sem falhas.
- `git diff --check`: exit code 0, sem whitespace invalido.
- Auto-revisao: o minimo dinamico participa do fluxo flexivel, o overflow permanece confinado a faixa e os seletores de transformacao nao incluem loading semantico.
