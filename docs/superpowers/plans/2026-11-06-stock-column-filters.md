# Filtros por coluna — plano

> Executar inline com superpowers:executing-plans e revisão final independente.

**Objetivo:** filtros nos cabeçalhos, com sequência Grupo → Marca → Produto confirmada pelo usuário.
**Arquitetura:** modelo puro stockColumnFilters.ts, componente de popover StockColumnFilter.tsx, estado no CommandCenter compartilhado com o painel existente, cabeçalhos e fallback móvel na tabela.
**Spec:** docs/superpowers/specs/2026-11-06-stock-column-filters-design.md.
**Stack:** React, TypeScript, Radix Popover, Vitest, Vite.

- [x] Baseline dos testes existentes usando node_modules desta worktree (as dependências foram movidas desde outubro).
- [x] RED: teste de hierarquia, interseção de filtros, limites/datas desconhecidas, cascata de marcas e cabeçalhos acessíveis sem resultados.
- [x] Implementar modelo puro e comparação eficiente usando Intl.Collator único e somente a coluna solicitada.
- [x] Implementar popovers acessíveis com aplicar/limpar e validação; integrar painel, exportação e tabela no protótipo local.
- [ ] Testes direcionados, lint, build e revisão final; preservar arquivos preexistentes sem incluí-los no commit.
- [ ] Publicar sobre a imagem atual, com smoke/backup/rollback e conferência da UI.

## Registro

- Base: c0de276; branch existente codex/restore-ecommerce-connection. Dois arquivos de EstoquePage já modificados antes da tarefa; não pertencem a esta mudança.
- Descoberta posterior: produção 2.6.13/686e1c2 usa paginação R11. Não publicar o protótipo baseado em dados completos sobre ela: a API ainda não oferece a hierarquia ou todos os novos filtros globais.
- Dependência externa documentada em `docs/erp-estoque-filtros-colunas.md`. Primeiro estender o contrato da API; depois integrar os parâmetros/capacidades ao fluxo R11, executar regressões de paginação e isolamento, revisar e publicar.
- Testes do protótipo não validam o fluxo paginado da produção. Nenhuma alteração publicada nesta tarefa.
