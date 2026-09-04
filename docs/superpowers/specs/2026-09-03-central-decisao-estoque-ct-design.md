# Central de Decisao de Estoque CT

## Objetivo

Evoluir a rota `/operacional/estoque` da Casa da Transmissao para uma central de decisao operacional, mantendo fontes, contratos, autenticacao, permissoes e regras externas. A experiencia deve evidenciar ruptura, estoque baixo, excesso, baixa movimentacao, cobertura e capital parado usando apenas os campos recebidos das APIs configuradas.

## Estrategia

A implementacao reaproveita a fundacao existente em `src/components/operacional/estoque`. A Central de Estoque continua sendo o ponto de consulta e detalhamento, o Giro passa a concentrar analise gerencial e o Assistente organiza perguntas e insights rastreaveis. Nenhum valor sera simulado quando uma fonte estiver ausente.

## Dados E Confiabilidade

- `useEstoqueData` permanece como fonte unica para consolidado, detalhado e giro.
- Falha de uma fonte sera apresentada separadamente, sem transformar indisponibilidade em zero.
- O horario da ultima atualizacao representa a conclusao bem-sucedida da consulta exibida.
- Metricas dependentes de giro mostram `Dados insuficientes` quando a fonte nao estiver disponivel.
- Estimativas, como minimo operacional e cobertura, exibem tooltip com formula, periodo e natureza estimada.
- O modo detalhado usa somente campos reais, como filial, localizacao, custos, referencias, compras, vendas e transferencias. Campos ausentes nao serao inventados.

## Cabecalho E Navegacao

- Cabecalho compacto com titulo, filial ativa, ultima atualizacao e botao de atualizar.
- Aviso discreto para dados desatualizados ou fonte parcial.
- Abas principais: `Central de Estoque`, `Giro de Estoque` e `Assistente`.
- Cor e movimento ficam reservados para estado, selecao e feedback.

## Central De Estoque

### Indicadores

Barra responsiva com produtos, valor do estoque, sem estoque, estoque baixo, criticos e capital em excesso. Indicadores aplicaveis funcionam como filtros e usam `aria-pressed`. Cada indicador explica origem, periodo e regra em tooltip.

### Consolidado E Detalhado

- Consolidado: uma linha por produto, com quantidade e valor agregados e situacao geral.
- Detalhado: composicao do produto por filial e localizacao quando esses campos existirem, incluindo custos, referencias e datas operacionais reais.
- Se o endpoint detalhado devolver a mesma granularidade do consolidado, a interface informa a limitacao da fonte e ainda apresenta as colunas detalhadas disponiveis; nao duplica silenciosamente a tabela.
- Busca, filtros, ordenacao, colunas e exportacao continuam preservados na alternancia.

### Consulta E Acao

- Busca normalizada por codigo, descricao, referencia, fabricante, marca e aplicacao.
- Filtros por situacao, marca, grupo, saldo, movimentacao e valor.
- Chips removiveis e acao para limpar a visao.
- Preferencias de colunas persistidas por filial e modo.
- Drawer do produto com saldo, valor, custos, referencias, datas, cobertura, motivo da classificacao, historico e recomendacao objetiva.

## Giro De Estoque

- Indicadores: atendendo, alerta, ruptura, excesso, capital parado e cobertura media.
- Indicadores e elementos graficos filtram a listagem.
- Painel de analise com distribuicao por situacao, curva ABC, estoque versus vendas, dias sem venda e ranking de capital parado.
- Tabela com codigo, produto, marca, saldo, valor, vendas, giro, cobertura, dias sem venda, tendencia, situacao e acao recomendada quando calculavel.
- Toda classificacao explica sua regra em tooltip.
- Graficos ficam em painel lateral ou secao compacta para nao disputar espaco com a operacao principal.

## Assistente E Insights

- Campo de pergunta sempre acessivel, historico, processamento e falha claros.
- Sugestoes compactas para ruptura, capital parado, itens sem venda, compra e resumo diario.
- Respostas indicam periodo e dados usados.
- Resultados podem abrir um produto ou aplicar um filtro quando houver referencia estruturada.
- A aba Insights usa regras locais deterministicas para ruptura, excesso, estagnacao e divergencia de giro; IA complementa a explicacao, mas nao cria fatos.
- Sem configuracao de IA, os insights locais continuam funcionais e a interface explica como habilitar o chat.

## Direcao Visual

- Azul profundo, ciano funcional, branco, verde, amarelo e vermelho sem efeitos decorativos excessivos.
- Fundo tecnico discreto e baixa interferencia visual.
- Densidade adequada para leitura de tabelas, com hierarquia tipografica e numeros tabulares.
- Sem cards aninhados, brilho, gradientes de template ou grandes areas vazias.
- Componentes com raio de ate 8px, foco visivel e estados identificados por texto e icone.

## Responsividade

- Indicadores: seis, tres, duas ou uma coluna conforme o espaco disponivel.
- A pagina nunca cria rolagem horizontal; somente tabelas podem rolar internamente.
- Em telas pequenas, a tabela vira lista operacional compacta e filtros passam para painel recolhivel.
- Valores longos usam escala responsiva e `min-width: 0`.
- Validacao em 390, 768, 1024 e 1440 pixels.

## Testes E Aceite

- Consolidado e Detalhado produzem apresentacoes e granularidades distintas.
- Alternar modo preserva busca e filtros.
- Indicadores filtram e podem ser desativados pelo mesmo controle.
- Exportacao recebe exatamente a visao filtrada.
- Falha parcial nao zera indicadores de uma fonte saudavel.
- Giro apresenta KPIs e visualizacoes calculados apenas com dados existentes.
- Assistente oferece insights locais mesmo sem IA e identifica a fonte das respostas.
- Nenhum valor ou texto ultrapassa seu componente nas larguras alvo.
- Testes focados, suite completa, lint do escopo, build e verificacao visual devem passar.

## Fora De Escopo

- Novos endpoints ou alteracao de payloads.
- Mudancas de autenticacao, permissoes e configuracao de empresas.
- Persistencia de conversas em novo backend.
- Previsao estatistica sem dados historicos suficientes.
