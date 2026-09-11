# Task 3 Report

## RED

Comando:

`node ..\..\node_modules\vitest\vitest.mjs --run src/components/comercial/compact/ComercialCompactLayout.test.tsx src/components/comercial/EnterpriseComercialFilters.test.tsx src/styles/comercial-square.test.ts`

Resultado esperado: 3 arquivos executados, 7 testes falhando e 10 passando. As falhas confirmaram a ausencia das cinco classes semanticas, da largura intrinseca por metrica, das regras CSS semanticas e de `commercial-overlay` nos conteudos portados de select e multi-select.

## Implementacao

- Adicionadas via `cn` as classes `commercial-workspace`, `commercial-toolbar`, `commercial-filter-control`, `commercial-metric-strip` e `commercial-data-viewport`, sem alterar assinaturas publicas.
- Valores textuais agora derivam `valueLength` e aplicam `minWidth: max(9rem, calc(Nch + 3rem))` somente no item da metrica; o strip continua sem largura inline e permite rolagem horizontal.
- Geometria, remocao de efeitos e transicoes de cor/opacidade foram vinculadas as primitivas comerciais semanticas, preservando `rounded-full` e os limites de 2px/4px.
- Os controles locais de select e multi-select mantem campos, gatilhos e callbacks existentes e aplicam `commercial-overlay` diretamente aos conteudos portados.
- Reduced motion existente continua cobrindo o shell comercial e `commercial-overlay`.

## GREEN

Comando focado: 3 arquivos aprovados, 17 testes aprovados.

Lint focado: aprovado sem erros ou avisos.

## Preocupacoes

- Os wrappers comerciais de select e multi-select repetem a composicao visual das primitivas enterprise para permitir classificar os portais sem mudar a API compartilhada; futuras mudancas internas nessas primitivas devem ser avaliadas tambem aqui.
