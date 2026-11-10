# Integração dos filtros de estoque R15

> Executar inline com superpowers:executing-plans e revisão final independente.

**Objetivo:** concluir os filtros já aprovados, agora com contrato R15 confirmado pelo usuário e consultado na API.
**Arquitetura:** preservar paginação R11, mover contrato/serialização/validação para stockPagedApi.ts; enviar filtros completos à API; usar metadados globais sem ordenar ou filtrar somente a página. Normalizar produtos consolidados usando campos repetidos uma única vez.
**Stack:** React, TypeScript, TanStack Query, Radix, Vitest/Vite.
**Spec:** docs/superpowers/specs/2026-11-06-stock-column-filters-design.md e contrato R15 fornecido em 10/11/2026.

- [x] RED/GREEN contrato: parâmetros repetidos, decimais, datas, capacidades, isolamento, consolidação sem duplicidade, situação oficial e opções globais.
- [x] Restaurar fluxo paginado R11 sobre a base privada sem perder as alterações preexistentes de EstoquePage; integrar R15 e cancelamento das consultas.
- [x] Integrar cabeçalhos, estado/cascata, paginação, totalizadores globais e exportação identificada como página.
- [x] Regressões hook/UI, lint/build, revisão independente; validar API de ambas as filiais.
- [x] Publicar frontend com verificação da versão atual, backup/rollback e conferência visual.

## Decisões

- A API atual é `pelegrini-estoque-colunas-20261109-r15`. Usa `ordem=grupo_marca_produto`, datas `ultima_*_ini/fim/sem_data` e seleção repetida. Limites são aplicados após consolidar.
- Consolidado pagina produtos, mas pode retornar várias linhas de origem para cada produto. Deduplicar por produto; quantidade_consolidada/valor_estoque_consolidado/custo_medio_consolidado não são somados. Detalhado mantém as linhas distintas.
- Situação e última movimentação vêm da API. Não recalcular situação com giro vazio. Não carregar giro completo para abrir Central.
- Ordenações individuais só serão habilitadas quando suportadas pela API; filtros de todas as colunas continuam disponíveis. Não simular ordenação global ordenando uma página.
- Exportação no fluxo paginado permanece limitada à página, explicitamente rotulada, preservando o comportamento R11.
- Preservar os arquivos preexistentes e não enviar código ao GitHub. Publicação do site já foi autorizada na conversa.
- A publicação atual mudou para 2.7.1, manifesto 50effcd, imagem `pelegrini-web:produtividade-d2ca3c1`. Preparar o build a partir de um snapshot local desse commit publicado e aplicar somente os arquivos de estoque desta tarefa; não publicar a base antiga c0de276 inteira, pois isso removeria os ajustes recentes de produtividade/login/e-commerce. O workspace original e seus arquivos preexistentes permanecem intactos.
- Concluído: web2.7.2,115testes e conferência pública das duas filiais. O conteúdo estático usa bind mount; foi atualizado além da imagem. Ver detalhes, caminhos e rollback em `docs/deployment/stock-column-filters-r15-2026-11-10.md`.
