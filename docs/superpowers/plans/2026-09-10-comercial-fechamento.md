# Fechamento do Comercial CT/CCH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concluir a reforma visual do modulo Comercial com telas compactas, consistentes, responsivas e com estados de carregamento confiaveis.

**Architecture:** Reutilizar `ComercialCompactPage`, `ComercialCommandBar`, `ComercialMetricStrip` e `ComercialDataViewport` como fundacao. Manter hooks, filtros, calculos, permissoes e callbacks atuais; as mudancas ficam na composicao visual e na finalizacao dos estados de consulta.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Recharts, TanStack Query, Vitest e Testing Library.

**Spec:** Requisitos aprovados nesta tarefa e `docs/superpowers/plans/2026-09-09-comercial-compacto-onda-1.md`.

## Global Constraints

- Nao alterar endpoints, parametros, calculos, permissoes ou integracoes.
- Preservar as alteracoes locais existentes.
- Nao introduzir novas dependencias.
- Remover aparencia de template/IA, brilhos e textos auxiliares sem valor operacional.
- Conter rolagem nas tabelas e paineis de dados, sem rolagem horizontal no documento.
- Manter CT e CCH coerentes nos temas claro e escuro.

---

### Task 1: Estado de carregamento do Dashboard

**Files:**
- Modify: `src/pages/comercial/MetasVendedoresPage.tsx`
- Test: `src/components/pelegrini/PelegriniFoundation.test.tsx`

- [x] Criar teste cobrindo shell visivel durante carregamento e estado de erro recuperavel.
- [x] Identificar qual sinal agregado mantem `isLoading` ativo sem dados.
- [x] Manter cabecalho, filtros e abas montados; restringir skeleton ao viewport de dados.
- [x] Validar o Dashboard com e sem resposta da API.

### Task 2: Campanhas compactas

**Files:**
- Modify: `src/components/comercial/CampanhasTab.tsx`
- Test: `src/components/pelegrini/PelegriniFoundation.test.tsx`

- [x] Remover cabecalho duplicado, textos de IA e decoracao excessiva.
- [x] Consolidar busca, status, marca e acao de cadastro em uma barra compacta.
- [x] Transformar os totais em uma unica faixa responsiva.
- [x] Conter lista, ranking e detalhes no viewport da aba.

### Task 3: Metas e analises

**Files:**
- Modify: `src/pages/comercial/MetasVendedoresPage.tsx`
- Modify: `src/components/comercial/InsightsIATab.tsx`
- Test: `src/components/pelegrini/PelegriniFoundation.test.tsx`

- [x] Padronizar os paineis de metas, projecoes e detalhes com densidade compacta.
- [x] Substituir rotulos de IA por linguagem operacional.
- [x] Remover explicacoes permanentes e manter ajuda em tooltips.
- [x] Garantir rolagem apenas dentro do conteudo ativo.

### Task 4: Marcas e categorias

**Files:**
- Modify: `src/components/comercial/PremiumMarcasView.tsx`
- Modify: `src/components/comercial/PremiumCategoriasView.tsx`
- Test: `src/pages/comercial/ProdutosPage.test.tsx`
- Test: `src/components/comercial/PremiumMarcasView.test.tsx`

- [x] Remover `premium-card`, titulos redundantes e animacoes decorativas no modo embutido.
- [x] Manter busca, selecao, ranking e drawers funcionais.
- [x] Padronizar cabecalhos de tabela, densidade das linhas e estados vazios.

### Task 5: Auditoria responsiva e homologacao

**Files:**
- Modify: `src/components/comercial/compact/ComercialCompactLayout.css`
- Modify: arquivos comerciais apenas quando a verificacao revelar regressao.

- [x] Verificar Dashboard, Produtos, Clientes, Comissoes, Cotacoes, Vendas Perdidas e Campanhas com contratos responsivos e inspecao visual do viewport disponivel.
- [x] Corrigir overflow, sobreposicao, alturas inconsistentes e valores cortados.
- [x] Executar testes comerciais, lint direcionado, `npm run build` e `git diff --check`.
- [x] Publicar somente mediante pedido explicito do usuario.
