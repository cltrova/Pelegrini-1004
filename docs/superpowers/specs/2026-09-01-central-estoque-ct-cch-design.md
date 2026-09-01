# Central de Estoque CT/CCH

## Objetivo

Transformar a tela de Estoque em uma central de acompanhamento operacional para Casa da Transmissao e Casa do Chevrolet, mantendo as fontes, regras de acesso, rotas e contratos existentes. A experiencia deve responder rapidamente o que esta disponivel, acabando, zerado, parado, mais movimentado e precisando de atencao.

## Escopo

- Aplicar a mesma estrutura funcional a CT (`1004`) e CCH (`10041`).
- Variar identidade, vocabulario e acentos por filial usando o tema Pelegrini existente.
- Manter as abas secundarias Giro e Assistente.
- Consolidar Visao Geral e Detalhes em uma experiencia principal chamada Central de Estoque.
- Nao alterar endpoints, payloads, permissoes, rotas protegidas ou calculos externos ao modulo.

## Direcao Visual

- Layout claro tecnico, limpo e denso o suficiente para operacao recorrente.
- Hierarquia visual forte, espaco em branco controlado, bordas suaves e sombras discretas.
- Cor reservada para estados e prioridades; nenhum estado depende somente de cor.
- Sem gradientes decorativos, brilhos, cards aninhados ou animacoes invasivas.
- Microinteracoes curtas em hover, filtros, selecao de produto, carregamento e estados vazios.

## Arquitetura Da Tela

### Barra Principal

- Busca inteligente sempre visivel.
- Alternancia entre filial consolidada e separada preservada.
- Acoes de colunas e exportacao agrupadas no lado direito.
- Busca imediata por codigo, descricao, marca, grupo, linha, aplicacao, referencia original e codigo do fabricante.
- Aplicar normalizacao sem acentos e sem diferenca entre maiusculas e minusculas.

### Indicadores

Exibir seis indicadores clicaveis:

1. Total de produtos.
2. Valor estimado do estoque.
3. Produtos criticos.
4. Estoque baixo.
5. Sem estoque.
6. Produtos parados.

Cada indicador aplica ou remove um filtro rapido na listagem. O estado ativo deve ser reconhecivel por texto, icone, borda e indicador visual.

### Atencao No Estoque

- Mostrar apenas produtos zerados, criticos, baixos ou parados.
- Priorizar sem estoque, critico, baixo e parado, nesta ordem.
- Permitir abrir o produto diretamente no painel lateral.
- Manter a secao compacta; quando nao houver alertas, mostrar um estado positivo discreto.

### Filtros

- Filtros de marca, grupo, linha, disponibilidade, estoque baixo, sem estoque, com estoque e sem movimentacao.
- Chips ativos removiveis individualmente.
- Acao unica para limpar filtros.
- Busca e filtros rapidos aplicam imediatamente; filtros dimensionais podem reutilizar os seletores existentes.
- Exportacao deve respeitar busca, filtros dimensionais e filtros rapidos.

### Listagem

Colunas iniciais:

- Produto e codigo.
- Marca.
- Grupo.
- Quantidade atual.
- Minimo operacional estimado.
- Ultima movimentacao.
- Situacao.

Colunas opcionais:

- Filial.
- Curva ABC.
- Valor em estoque.
- Custo medio.
- Linha.
- Aplicacao.
- Referencia original.
- Localizacao.

A ordenacao deve aceitar produto, marca, maior estoque, menor estoque e ultima movimentacao. As preferencias de colunas serao persistidas em `localStorage` por filial. A tabela usara cabecalho fixo, destaque suave no hover e carregamento incremental.

Em telas menores que `768px`, usar uma listagem compacta com produto, quantidade, situacao e marca. Informacoes secundarias permanecem no painel de detalhe.

## Inteligencia De Estoque

### Agregacao

- Relacionar `EstoqueRecord` e `GiroRecord` por empresa e codigo do produto.
- Considerar por padrao os ultimos 90 dias de `GiroRecord`.
- Somar saidas de venda, transferencia e outras saidas para consumo operacional.
- Manter compras, transferencias e outras entradas separadas no historico.

### Minimo Operacional

```text
media_diaria_saidas = total_saidas_90_dias / dias_com_cobertura
minimo_operacional = teto(media_diaria_saidas * 30)
cobertura_dias = quantidade_atual / media_diaria_saidas
```

- `dias_com_cobertura` deve ficar entre 1 e 90 e respeitar o intervalo real retornado.
- Produto sem saida recente tera minimo operacional zero e cobertura indeterminada.
- A interface deve usar o texto "Minimo operacional estimado" e nunca apresenta-lo como valor oficial do ERP.

### Situacao

Ordem de precedencia:

1. `sem_estoque`: quantidade atual menor ou igual a zero.
2. `critico`: cobertura determinada e inferior a 15 dias.
3. `baixo`: cobertura determinada entre 15 e menos de 30 dias.
4. `disponivel`: cobertura igual ou superior a 30 dias, ou produto com estoque sem consumo recente.

Cada estado combina texto, icone e marcador visual. Produtos com dados insuficientes de giro continuam classificados como disponiveis quando possuem saldo, mas exibem cobertura como indisponivel.

### Produtos Parados

- Ultima movimentacao e a maior data valida entre giro, ultima venda, ultima compra e ultima transferencia.
- Classificar faixas de 30, 60, 90 e 180 dias.
- O indicador principal de parados considera mais de 90 dias.
- Produto sem qualquer data entra na faixa superior a 180 dias com indicacao de data desconhecida.

### Mais Movimentados

- Ordenar pela soma absoluta de entradas e saidas no periodo.
- Exibir quantidade movimentada, saldo atual e principal tipo de movimento.
- Permitir alternar entre todos os movimentos, vendas e retiradas.

### Evolucao Estimada

- Partir do saldo atual.
- Percorrer movimentos em ordem inversa, desfazendo entradas e saidas para reconstruir saldos anteriores.
- Agrupar por dia e limitar ao periodo disponivel.
- Identificar tendencia crescente, decrescente, parada ou irregular.
- Rotular explicitamente o grafico como evolucao estimada quando o endpoint nao fornecer snapshots oficiais.

## Detalhe Do Produto

Abrir um `Sheet` lateral sem navegar para outra rota. Exibir:

- Descricao completa, codigo, marca, grupo, linha, aplicacao e referencias.
- Quantidade disponivel, minimo operacional, cobertura e situacao.
- Valor em estoque, custo medio, filial e localizacao quando disponiveis.
- Ultima venda, compra, transferencia e ultima movimentacao calculada.
- Linha do tempo recente com entrada/saida, tipo, data e quantidade.
- Grafico compacto de evolucao estimada.
- Resumo de entradas, saidas e giro do periodo.

O painel deve manter foco acessivel, fechar por botao ou `Escape` e devolver foco ao produto selecionado.

## Componentes

- `EstoqueCommandCenter`: composicao da experiencia principal.
- `EstoqueSummaryCards`: indicadores e filtros rapidos.
- `EstoqueAttentionPanel`: alertas priorizados.
- `EstoqueSmartFilters`: busca, filtros ativos e acoes.
- `EstoqueProductsTable`: tabela/listagem responsiva.
- `EstoqueProductDrawer`: detalhe lateral.
- `EstoqueMovementTimeline`: historico de movimentos.
- `EstoqueEvolutionChart`: grafico e tendencia.
- `EstoqueMovementHighlights`: mais movimentados e parados.
- `estoqueIntelligence.ts`: funcoes puras de agregacao e classificacao.

Os componentes devem consumir os arrays ja retornados por `useEstoqueData`. O hook e os contratos de API permanecem inalterados.

## Estados E Erros

- Se estoque estiver disponivel e giro falhar ou vier vazio, manter busca, valor, quantidade, zerados e listagem.
- Indicadores dependentes de movimento exibem "Dados insuficientes" sem produzir valores artificiais.
- Erro completo preserva o estado de erro atual e oferece nova tentativa quando a infraestrutura existente permitir.
- Estado vazio deve distinguir ausencia de dados da ausencia de resultados apos filtros.
- Skeletons devem manter dimensoes estaveis e nao provocar deslocamento de layout.

## Responsividade

- `1440px`: indicadores em seis colunas; tabela e paineis laterais completos.
- `1024px`: indicadores em tres colunas; atencao e destaques em grade adaptativa.
- `768px`: controles quebram em linhas, tabela preserva rolagem interna quando necessaria.
- `390px`: lista compacta, indicadores em duas colunas e detalhe ocupando a largura disponivel.
- Nenhuma largura deve gerar rolagem horizontal na pagina.

## Testes E Aceite

### Testes Unitarios

- Agregacao por produto e filial.
- Calculo do minimo operacional e cobertura.
- Precedencia dos quatro estados.
- Faixas de produtos parados.
- Reconstrucao da evolucao.
- Busca normalizada em todos os campos.
- Ordenacao e filtros rapidos.

### Testes De Componentes

- Indicador aplica e remove filtro.
- Filtros ativos podem ser removidos individualmente.
- Clique em produto abre o painel correto.
- Preferencias de coluna persistem por filial.
- Exportacao recebe exatamente a visao filtrada.
- Ausencia de giro mostra dados insuficientes sem quebrar a listagem.
- Estados possuem texto alem de cor.

### Verificacao Visual

Validar CT e CCH em `1440`, `1024`, `768` e `390px` na rota `/operacional/estoque`:

- sem valores escapando de cards;
- sem rolagem horizontal da pagina;
- tabela/lista legivel;
- filtros e painel lateral funcionais;
- identidades CT e CCH reconheciveis;
- estados de carregamento, vazio e dados reais coerentes.

### Criterios De Aceite

- A tela responde as seis perguntas operacionais definidas no objetivo.
- Busca localiza produtos sem configuracao previa.
- Indicadores filtram a listagem.
- Produto abre sem sair da tela.
- Historico e evolucao usam somente dados existentes e deixam estimativas explicitas.
- Exportacao respeita a visao corrente.
- CT e CCH compartilham estrutura sem perder identidade.
- Nenhum endpoint, permissao ou contrato externo e alterado.
