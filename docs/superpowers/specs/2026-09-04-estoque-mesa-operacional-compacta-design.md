# Estoque: Mesa Operacional Compacta

## Objetivo

Reestruturar as telas de estoque da Casa da Transmissao e da Casa do Chevrolet como uma mesa operacional compacta, clara e funcional. Em desktop, o modulo deve ocupar exatamente a altura visivel da janela e manter apenas uma area de rolagem vertical controlada dentro da tabela, lista ou conversa ativa.

A reforma preserva contratos de API, calculos e permissoes. Correcoes de composicao dos dados ficam limitadas a remover duplicidades indevidas no Giro e impedir mistura entre CT e CCH.

## Direcao Visual

O estoque deixa de usar uma sequencia de cards e faixas independentes e passa a funcionar como uma superficie operacional continua. Bordas finas e alinhamentos substituem caixas decorativas. O padrao tecnico de fundo aparece apenas em espacos livres, sem atravessar tabelas, filtros ou indicadores.

- CT usa azul tecnico e ciano como acento de selecao.
- CCH usa azul profundo e amarelo como acento de selecao.
- Estados operacionais mantem verde, amarelo e vermelho com contraste acessivel.
- Valores usam numerais tabulares e escala responsiva.
- Textos explicativos ficam em tooltips, drawers ou estados de erro, nunca ocupando altura permanente.

## Estrutura da Viewport

O conteudo do modulo usa `height: 100dvh`, `min-height: 0` nos containers flexiveis e `overflow: hidden` no documento em desktop. A sidebar permanece independente e compacta.

### Barra superior

Altura alvo de 44 pixels. Reune:

- identificacao visual da filial por logo e cor;
- abas Central, Giro e Assistente;
- indicador discreto da fonte de dados;
- horario da ultima atualizacao;
- comando de atualizar.

Os titulos "Gestao de Estoque", "Estoque recuperado" e subtitulos de filial deixam de ocupar faixas proprias. O status da fonte vira um icone com tooltip. Erros ou fonte parcial continuam visiveis em um aviso compacto e dispensavel, sem esconder os dados preservados.

### Barra de comandos

Altura alvo de 44 pixels. A barra se adapta ao contexto da aba e mantem busca, filtros e acoes na mesma linha em desktop. Controles secundarios usam icones com tooltip.

Na Central, contem Consolidado/Detalhado, busca, filtros, Atencao, Colunas e Exportar. No Giro, contem busca, filtros e Analise de giro. No Assistente, contem Chat/Insights e o consumo de creditos.

### Indicadores

Uma faixa unica de aproximadamente 52 pixels apresenta ate seis indicadores. Cada item tem largura minima zero, rotulo curto, valor responsivo e tooltip com definicao. Indicadores aplicaveis funcionam como filtros da tabela.

Nao ha quebra vertical para acomodar valores monetarios no desktop. Em larguras intermediarias, a faixa usa rolagem horizontal discreta. No mobile, os indicadores prioritarios aparecem primeiro e os demais ficam em um painel de resumo.

### Conteudo principal

O conteudo principal usa todo o espaco restante. Tabelas possuem cabecalho fixo e rolagem interna. Paginacao ou carregamento incremental permanece fixo no rodape da area de dados. A pagina nao deve acumular uma segunda barra de rolagem.

## Central de Estoque

A Central prioriza consulta e acao rapida.

- Consolidado apresenta uma linha por produto no contexto ativo.
- Detalhado apresenta a granularidade real recebida pela API, incluindo filial ou localizacao quando existirem.
- Quando as duas fontes possuirem a mesma granularidade, o sistema explica a indisponibilidade do detalhe em vez de simular uma mudanca.
- Os indicadores Produtos, Valor, Sem estoque, Estoque baixo, Criticos e Capital em excesso ficam na mesma linha e podem aplicar filtros.
- O nome do produto abre o drawer existente com dados cadastrais, movimentos e recomendacoes.
- Colunas, ordenacao e exportacao continuam funcionando sobre a visao filtrada.
- A informacao de fonte parcial ou recuperada permanece acessivel, mas deixa de ocupar uma linha permanente quando os dados estao utilizaveis.

## Giro de Estoque

O Giro usa o mesmo esqueleto visual da Central e corrige inconsistencias que hoje prejudicam a leitura.

- A composicao produz uma linha por `cod_empresa_bi + cod_empresa + cod_produto`.
- Registros de saldo e movimento do mesmo produto sao combinados antes da classificacao.
- A filial ativa filtra tanto estoque quanto movimento; dados CT nao aparecem em CCH e vice-versa.
- A coluna Filial fica oculta quando todos os resultados pertencem ao mesmo contexto.
- O texto isolado de quantidade de produtos e removido; a contagem fica junto da busca.
- Os indicadores Atendendo, Alerta, Ruptura, Excesso, Capital parado e Cobertura media usam a mesma faixa compacta da Central.
- A tabela prioriza Produto, Marca, Status, Estoque, Valor, Vendas, Cobertura e Acao.
- Explicacoes de status ficam em tooltip, sem texto oculto ocupando celulas.
- A Analise de giro abre em drawer lateral e nao redimensiona a tabela.

## Assistente

O Assistente ocupa o mesmo espaco de trabalho sem cabecalho duplicado.

- Chat/Insights e creditos ficam na barra de comandos.
- O historico possui a unica rolagem vertical da aba.
- O compositor permanece fixo no rodape da area util.
- Sugestoes iniciais sao comandos compactos e desaparecem apos a primeira interacao.
- Insights podem aplicar filtros, abrir o produto na Central ou abrir o painel de Atencao.
- Estados sem configuracao ou sem creditos aparecem junto ao compositor, sem substituir toda a tela.

## Estoque Retroativo

A rota retroativa adota o mesmo shell. A barra de comandos contem data de referencia, filial permitida, comparacao e exportacao. Indicadores e tabela seguem as mesmas dimensoes da Central. A comparacao entre datas abre em painel lateral para preservar a area principal.

## Responsividade

### Desktop: 1024 a 1440 pixels

- Nenhuma rolagem vertical no documento.
- Uma unica linha para abas, uma para comandos e uma para indicadores.
- A tabela ou conversa recebe toda a altura restante.
- Nenhum valor ou rotulo escapa de seu container.

### Tablet: 768 pixels

- Abas continuam em uma linha.
- Acoes menos frequentes entram em menu de overflow.
- Indicadores podem rolar horizontalmente dentro de sua faixa.
- Tabela permite rolagem horizontal somente dentro do painel de dados.

### Mobile: 390 pixels

- A superficie continua presa a `100dvh`.
- Busca e filtros usam painel dedicado.
- Tabelas viram lista compacta, com rolagem interna.
- Apenas um eixo vertical e rolavel por vez.

## Acessibilidade e Interacao

- Tooltips descrevem siglas e expressoes tecnicas.
- Icones possuem nome acessivel.
- Tabs e seletores mantem semantica e navegacao por teclado.
- Estados nao dependem apenas de cor.
- Cabecalhos fixos mantem contraste durante a rolagem.
- O foco retorna ao item de origem ao fechar drawers e paineis.

## Componentes

A implementacao consolida a estrutura existente, sem criar um segundo sistema visual:

- `EstoqueWorkspace`: controla altura, barras e area rolavel.
- `EstoqueWorkspaceHeader`: abas, fonte e atualizacao.
- `EstoqueToolbar`: busca e comandos contextuais.
- `EstoqueMetricStrip`: indicadores compactos e interativos.
- `EstoqueDataViewport`: tabela, lista, chat ou estado operacional.

`EstoqueCommandCenter`, `GiroEstoqueTab` e `EstoqueAssistantTab` passam a consumir essas primitivas. O drawer de produto, filtros inteligentes, painel de Atencao e analise de giro continuam sendo superficies secundarias.

## Fluxo de Dados

`useEstoqueData` permanece como fonte das consultas. Antes de calcular o Giro, um normalizador puro combina saldo e movimentacao pela chave de filial e produto. O filtro da filial ativa e aplicado antes da consolidacao e dos totalizadores. A apresentacao recebe colecoes ja coerentes e nao decide pertencimento de filial dentro da tabela.

Falhas da fonte continuam diferenciadas de estoque zerado. Dados preservados podem permanecer visiveis com um aviso compacto. Nenhum valor ausente e estimado ou inventado.

## Testes

- Renderizacao do workspace sem titulo e subtitulo redundantes.
- Altura e overflow: documento sem rolagem vertical em desktop e viewport de dados rolavel.
- Barra de comandos e indicadores sem quebra em 1024 e 1440 pixels.
- Valores monetarios longos sem overflow.
- Indicadores aplicando e removendo filtros.
- Consolidado e Detalhado refletindo granularidades distintas.
- Giro sem duplicidade pela chave de filial e produto.
- CCH sem registros CT e CT sem registros CCH.
- Coluna Filial oculta em contexto unico.
- Assistente com historico rolavel e compositor fixo.
- Verificacao visual em 390, 768, 1024 e 1440 pixels, nos modos claro e escuro.
- `npm test -- --run` e `npm run build` antes da publicacao.

## Criterios de Aceite

- Nenhum titulo ou subtitulo redundante ocupa area permanente do estoque.
- Nao existe rolagem vertical simultanea na pagina e na tabela em desktop.
- Central, Giro, Assistente e Retroativo compartilham alinhamentos e dimensoes.
- Todos os indicadores permanecem compactos e legiveis.
- CT e CCH nao misturam registros.
- O Giro nao repete o mesmo produto por separar saldo e movimento.
- Busca, filtros, ordenacao, colunas, exportacao, drawers e assistente permanecem funcionais.
- Estados de erro, recuperacao e fonte parcial continuam claros sem dominar a tela.
