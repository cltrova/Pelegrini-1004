# Comercial Clientes Compacto - Onda 2

## Objetivo

Migrar a tela ativa de Clientes para a fundacao compacta do Comercial, reduzindo repeticao visual e removendo linguagem de IA sem alterar consultas, filtros, calculos ou regras de classificacao.

## Composicao

1. Barra de contexto com o titulo curto `Clientes` e busca sempre visivel.
2. Filtros comerciais existentes, preservando estado pendente, aplicado e acao de limpar.
3. Faixa unica com Total de clientes, Novos em 30 dias, Em risco e Estados atendidos.
4. Abas compactas: Ranking, Evolucao, Carteira e Geografico.
5. Uma unica viewport interna responsavel pela rolagem do conteudo ativo.

## Ranking

- Remover o podio Top 5 e o grafico Top 10, pois repetem a tabela.
- Manter o ranking completo com busca local, faturamento, pedidos, ticket, participacao e ultima compra.
- Cabecalho fixo, linhas compactas e rolagem interna.
- A busca continua afetando apenas a tabela de ranking.

## Carteira

- Renomear `Insights IA` para `Carteira`.
- Renomear `Insights Inteligentes` para `Alertas e oportunidades`.
- Remover `Analisado por IA` da evolucao.
- Manter os calculos existentes de clientes em risco, novos clientes e alertas deterministas.

## Responsividade

- 1440/1024 px: filtros e quatro indicadores em uma linha quando houver espaco.
- 768 px: indicadores em duas colunas e tabela com rolagem interna.
- 390 px: busca e acoes reorganizadas, duas colunas de indicadores e nenhuma rolagem horizontal no documento.

## Restricoes

- Nao alterar `useComercialData`, parametros, endpoints ou calculos.
- Nao mudar o alcance da busca local.
- Nao modificar a pagina legada que nao esta ligada a rota ativa.
- Nao adicionar dependencias.
- Preservar tema claro/escuro e identidade CT/CCH.

## Aceite

- Busca visivel na tela ativa.
- Nenhum texto `IA`, `Insights IA`, `Inteligencia Artificial` ou `Analisado por IA` na tela.
- Um unico ranking de clientes.
- Totalizadores compactos sem truncar valores.
- Sem rolagem horizontal global.
- Loading e erro nao exibem totais como se fossem dados validos.
