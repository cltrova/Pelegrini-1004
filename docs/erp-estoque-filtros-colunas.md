# Ajuste necessário na API do ERP: filtros por coluna do estoque

## Situação confirmada em 06/11/2026

A interface deve organizar o estoque por **Grupo → Marca → Produto** e permitir filtros combinados nos cabeçalhos. A produção está na versão web 2.6.13, com a API `pelegrini-estoque-empresas-20261106-r11`.

A versão R11 já oferece paginação, opções e totalizadores globais. Ela precisa ser preservada: filtrar ou ordenar somente as 50 linhas recebidas não atende ao pedido.

Verificações realizadas na API, sem alterar dados:

- `/operacional/estoque/fontes/versao` informa formatos `legado`, `resumo` e `pagina`, página máxima de 500 e cache de 30 segundos.
- `GET /operacional/estoque/consolidado?cod_empresa_bi=1004&formato=pagina&pagina=1&tamanho_pagina=2&ordem=grupo_marca_produto` retorna HTTP 400: `ordem invalida para esta consulta`.
- `formato=legado` retornou 59.050 registros, aproximadamente 54 MB, em 17,18 segundos em uma medição. Não usar esse formato como solução para os novos filtros.
- O OpenAPI publicado ainda descreve a rota como R7 e omite os parâmetros da paginação R11. Atualizar o contrato junto com a implementação.

## Contrato proposto — parâmetros novos, ainda não disponíveis

Aplicar a mesma implementação em `/operacional/estoque/consolidado` e `/operacional/estoque/detalhado`. Preservar os parâmetros existentes `cod_empresa_bi`, `formato`, `pagina`, `tamanho_pagina`, `busca`, `grupo`, `marca`, `linha` e `ordem`.

| Coluna | Proposta de filtro |
| --- | --- |
| Grupo | `grupo` repetido, seleção por igualdade; devolver marcas disponíveis nesses grupos |
| Marca | `marca` repetido, seleção por igualdade dentro dos grupos selecionados |
| Produto | `produto_busca`, texto em nome, código e referências; combinar com a busca geral |
| Quantidade | `quantidade_min`, `quantidade_max`, limites inclusivos |
| Valor em estoque | `valor_min`, `valor_max`, limites inclusivos |
| Custo médio | `custo_medio_min`, `custo_medio_max`, limites inclusivos |
| Filial | `filial` repetido, somente origens autorizadas para a empresa BI |
| Localização | `localizacao` repetido, seleção por igualdade |
| Última movimentação | `movimentacao_de`, `movimentacao_ate`, `movimentacao_data=qualquer\|informada\|ausente` |
| Última compra | `compra_de`, `compra_ate`, `compra_data=qualquer\|informada\|ausente` |
| Última venda | `venda_de`, `venda_ate`, `venda_data=qualquer\|informada\|ausente` |
| Situação | Expor códigos e regras oficiais em `opcoes.situacoes`, com filtro `situacao` repetido; não inferir estoque baixo/crítico a partir de apenas uma página |

Números trafegam como decimal com ponto, sem separador de milhar. Datas usam `AAAA-MM-DD`, comparadas como dias civis, incluindo os limites. Filtros de colunas distintas combinam com AND; múltiplas opções da mesma coluna com OR. Definir uma opção explícita para valores ausentes sem confundi-la com um nome real de grupo ou marca.

### Ordenação e paginação

Adicionar `ordem=grupo_marca_produto`: Grupo crescente, Marca crescente, Produto crescente e código do produto como desempate. No detalhado, acrescentar a origem autorizada, a localização e uma chave única persistente do registro quando ainda houver empate. Aplicar uma chave final única também às ordenações individuais, garantindo uma ordem total e estável entre páginas. Usar comparação textual consistente em português.

Manter as ordenações atuais e oferecer ascendente/descendente para as demais colunas filtráveis. O terceiro clique no cabeçalho volta à hierarquia padrão. Não aceitar parâmetros de ordenação como SQL livre.

A sequência obrigatória é: **validar a empresa e as origens → consolidar quando solicitado → calcular campos derivados → aplicar filtros → calcular totais → ordenar → paginar**. Calcular as opções por faceta, conforme a regra abaixo, antes da paginação. No consolidado, quantidade e valor devem ser filtrados após a consolidação, não por saldo individual.

### Resposta e cache

Preservar `total_registros`, `total_itens`, `total_paginas`, `totais`, `opcoes` e `itens` da R11. Os totais e a contagem devem representar o resultado completo filtrado.

As opções precisam permitir acrescentar alternativas à multisseleção: `opcoes.grupos` deve abranger todos os grupos do escopo autorizado, sem restringir ao próprio filtro de grupo; `opcoes.marcas` deve considerar os grupos selecionados, ignorando o próprio filtro de marca. Incluir `opcoes.filiais` e `opcoes.localizacoes` do conjunto autorizado completo, nunca só dos 50 itens da página. Para outras facetas que sejam reduzidas pelos filtros, ignorar o filtro da própria faceta. Ao trocar de grupo, a interface remove marcas que deixaram de estar disponíveis.

Informar as capacidades suportadas em `/operacional/estoque/fontes/versao`, por exemplo `capacidades.ordenacao_grupo_marca_produto` e `capacidades.filtros_colunas`, para a interface habilitar somente recursos efetivamente disponíveis. Estes nomes são proposta de contrato a confirmar com o mantenedor.

Manter o cache separado por empresa BI, origem, visão, filtros normalizados, ordenação, página e tamanho. Deduplicar consultas idênticas simultâneas e invalidar conforme a atualização do ERP. Nunca usar o resultado de uma empresa como fallback de outra.

## Isolamento obrigatório

- 1004: banco `RSYS2003_CT`, origem 1.
- 10041: banco `RSYS2003_PELEGRINI`, origens 2 e 3.
- Preservar os bloqueios de Força P e as restrições já existentes. Validar origens solicitadas, linhas retornadas, opções, contagens e totais; os filtros não podem ampliar o escopo autorizado.

## Critérios de aceite

1. Com mais de 50 produtos, a ordenação respeita Grupo → Marca → Produto entre páginas, sem repetições ou omissões em dados estáveis.
2. Grupo e Marca combinados restringem todas as páginas; trocar o grupo atualiza as marcas disponíveis.
3. Limites numéricos, datas ausentes e combinações de filtros retornam contagem e totais globais corretos, inclusive zero resultados.
4. 10041 nunca retorna dados, opções ou totais da 1004 ou de Força P, mesmo com parâmetros inválidos ou cache aquecido pela outra empresa.
5. Nenhuma interação normal exige o download dos 59 mil registros. Medir primeira consulta e cache, consolidado e detalhado, nas duas empresas.

Após a confirmação deste contrato e a disponibilização da API, integrar os parâmetros e a detecção de capacidades ao fluxo paginado da web 2.6.13, testar ponta a ponta e publicar os filtros.
