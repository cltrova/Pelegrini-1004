# Central de estoque — filtros por coluna

O usuário confirmou a sequência Grupo → Marca → Produto, sem prioridade manual entre grupos. A proposta aceita inclui um funil separado da ordenação em cada cabeçalho, filtros combináveis e indicação do recorte aplicado.

## Abordagem

Manter o painel de filtros existente e compartilhar Grupo/Marca com os novos controles de coluna. Comparada a criar outro painel independente, essa opção evita estados divergentes e mantém a tabela compacta. A alternativa de prioridade manual entre nomes de grupos foi descartada pelo usuário.

- Padrão de organização: Grupo A–Z, Marca A–Z, Produto A–Z; mostrar os três níveis. Ordenações individuais continuam disponíveis, com retorno ao padrão.
- Grupo/Marca/Situação/Filial/Localização: seleção múltipla com busca. Marcas disponíveis dependem dos grupos; trocar o grupo remove marcas incompatíveis.
- Produto: busca textual por nome/código/referência; números: mínimo/máximo; datas: início/fim e presença/ausência de data.
- Filtros são aplicados ao conjunto completo antes da paginação e da exportação. Aplicar explicitamente no popover evita recalcular 59 mil itens a cada tecla.
- Cabeçalhos e limpar filtros continuam acessíveis com resultado vazio. No celular, os mesmos controles aparecem em uma faixa compacta, já que a tabela vira cartões.
- Estado compartilhado reinicia ao trocar de filial, preservando a separação entre empresas. Nenhuma alteração de API, cadastro ou permissão.

## Limites

Preservar as alterações preexistentes em EstoquePage.tsx e seu teste, o layout atual, login/e-commerce e os dados de origem. Não enviar código ao GitHub sem autorização. Totalizadores existentes não ganham novas regras de cálculo neste trabalho.

## Descoberta de produção e dependência externa

A produção foi atualizada independentemente para 2.6.13, commit 686e1c2, com paginação R11 no servidor. O protótipo local desta tarefa foi implementado sobre c0de276 com o conjunto completo em memória; não está integrado ao fluxo paginado R11 e não deve ser publicado sobre ele. A API rejeita `ordem=grupo_marca_produto` com HTTP 400. Baixar o formato legado custaria cerca de 54 MB e 17 segundos, por isso essa alternativa foi rejeitada para preservar desempenho.

Antes de publicar, o mantenedor precisa estender a API conforme `docs/erp-estoque-filtros-colunas.md`; depois integrar a interface ao fluxo R11 preservando os ajustes privados de login/e-commerce e a separação de filiais. A publicação permanece pendente dessa dependência. Não afirmar que o protótipo já está disponível no sistema.

Atualização em 10/11/2026: dependência resolvida com a API R15 e o contrato confirmado pelo usuário. A integração paginada foi concluída e publicada na web2.7.2, a partir da base atualmente publicada50effcd, sem publicar toda a branch privada antiga. Registro: `docs/deployment/stock-column-filters-r15-2026-11-10.md`.
