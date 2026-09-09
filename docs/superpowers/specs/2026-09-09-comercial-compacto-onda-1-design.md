# Comercial Compacto CT/CCH - Onda 1

## Objetivo

Reformular a experiencia visual do modulo Comercial para remover a aparencia generica ou associada a interfaces de IA, reduzir espaco desperdicado e tornar as telas operacionais mais densas, consistentes e claras.

A primeira onda cobre:

- fundacao visual compacta compartilhada;
- Comissoes;
- Cotacoes Abertas;
- Vendas Perdidas.

Dashboard, Produtos e Clientes serao migrados em ondas posteriores usando os mesmos componentes e tokens.

## Restricoes

- Nao alterar endpoints, parametros, normalizadores, permissoes, calculos, exportacoes ou regras de negocio.
- Preservar as alteracoes locais existentes em autenticacao e em `useComissaoVendedores`.
- Manter os fluxos atuais de CT e CCH e a identidade visual definida pela filial ativa.
- Nao introduzir uma nova biblioteca de componentes.
- Usar React, Tailwind, shadcn/ui, Lucide e Framer Motion ja presentes no projeto.
- Animacoes devem ser curtas, funcionais e respeitar `prefers-reduced-motion`.

## Direcao Visual

O Comercial adotara uma linguagem de mesa operacional:

- superficies planas e hierarquia por borda, contraste e espacamento;
- raio de borda de ate 8 px;
- sombras discretas apenas em sobreposicoes e estados de foco;
- sem brilhos, gradientes decorativos, fundos animados ou cards flutuantes;
- cores de filial usadas como acento, nunca como preenchimento dominante;
- cor verde para resultado positivo, amarela para atencao e vermelha para risco ou perda;
- tipografia compacta, com numeros tabulares e sem escala de titulo de pagina desnecessaria.

## Estrutura Compartilhada

### Shell da pagina

Cada tela usara um container flexivel com altura baseada na area disponivel do modulo. O documento nao deve ganhar rolagem vertical no desktop quando houver espaco suficiente. A tabela ou lista principal ocupa o restante da altura e controla sua propria rolagem.

Ordem visual:

1. barra de contexto e acoes;
2. barra de filtros;
3. faixa de indicadores;
4. conteudo principal com rolagem interna;
5. drawers e dialogs sob demanda.

### Barra de contexto

- Altura aproximada de 44 px.
- Titulo curto da tela, identificacao discreta do periodo aplicado e estado de atualizacao.
- Exportacao e acoes principais alinhadas a direita.
- Remover subtitulos explicativos permanentes quando a funcao da tela ja estiver clara pelo titulo e pelos controles.

### Filtros

- Altura de controles entre 32 e 36 px.
- Busca, periodo e filtro primario permanecem visiveis.
- Filtros secundarios ficam em popover ou painel recolhivel.
- Aplicar filtros e limpar filtros permanecem acessiveis por teclado e possuem tooltip quando representados apenas por icone.
- No mobile, os filtros abrem em painel e nao comprimem os campos ate cortar rotulos.
- O periodo pendente continua separado do periodo aplicado, preservando o comportamento atual das consultas.

### Indicadores

- Uma faixa unica no desktop, com quatro celulas nas telas de cotacoes e vendas perdidas.
- Altura entre 60 e 68 px.
- Rotulo em ate duas linhas; valor nunca deve ser truncado.
- Valores monetarios usam tamanho responsivo controlado pelo comprimento.
- No tablet, grade de duas colunas; no mobile, grade de duas colunas compactas.
- Tooltip explica indicadores que contenham siglas ou conceitos nao evidentes.

### Conteudo principal

- Cabecalho da tabela permanece fixo durante a rolagem interna.
- Linhas entre 40 e 44 px no desktop.
- Colunas numericas alinhadas a direita e dados textuais alinhados a esquerda.
- Hover discreto e selecao clara, sem animacoes decorativas.
- Colunas menos importantes podem ser ocultadas em larguras menores, mantendo acesso aos detalhes pelo drawer.

## Tela de Comissoes

### Composicao

- Unificar titulo, periodo e acao Buscar na barra superior.
- Manter Ano, Mes e Vendedor como filtros primarios.
- Mover Codigo da Meta, Operacao Fiscal Inicial, Operacao Fiscal Final, Deduzir Devolucao, Calcular ST e Exibir Margem para o painel `Mais filtros`.
- Exibir chips discretos para filtros avancados ativos.
- Manter a faixa padrao de operacao fiscal `0` a `62` ja existente.

### Indicadores

Apos a consulta, mostrar uma faixa compacta com:

- objetivo mensal;
- faturado ate hoje;
- valor total;
- pedidos em aberto.

Quando pedidos em aberto nao estiverem disponiveis, mostrar `Indisponivel` sem converter para zero.

### Tabela

- Vendedor e Nome ficam fixos no inicio durante a rolagem horizontal.
- Valores de apoio menos usados permanecem disponiveis, mas nao dominam a primeira leitura.
- Rodape de totais permanece fixo na base da area rolavel quando tecnicamente viavel sem duplicar informacao.
- O estado inicial deve ser compacto e orientar a busca sem criar um card vazio de grande altura.

## Tela de Cotacoes Abertas

### Proposito

Funcionar como fila de acompanhamento comercial, destacando quais cotacoes exigem contato primeiro.

### Indicadores

- cotacoes abertas;
- valor em aberto;
- tempo medio em aberto;
- cotacoes vencidas.

### Operacao

- Ordenacao inicial continua priorizando maior tempo em aberto e data mais antiga.
- Busca e periodo permanecem visiveis.
- Vendedor, cliente e faixa de dias ficam em filtros secundarios.
- O painel do gestor deixa de parecer uma segunda dashboard e passa a ser uma faixa operacional compacta com prioridades acionaveis.
- Clicar numa linha abre o drawer atual com os detalhes da cotacao.
- Exportacao usa exatamente a visao filtrada.

## Tela de Vendas Perdidas

### Proposito

Explicar perda comercial e apoiar acao corretiva, sem reutilizar o mesmo enquadramento visual de cotacoes abertas.

### Indicadores

- vendas perdidas;
- valor perdido;
- ticket medio perdido;
- motivo mais frequente.

### Operacao

- Busca e periodo permanecem visiveis.
- Motivo e status recebem maior prioridade que faixa de idade.
- Vendedor e cliente ficam disponiveis no painel de filtros.
- A tabela destaca motivo, valor e responsavel.
- Editar motivo continua disponivel diretamente na linha.
- Clicar na linha abre o drawer atual de detalhes.
- O painel do gestor deve priorizar concentracao de perdas por motivo, vendedor ou cliente, sem usar textos de IA ou recomendacoes genericas.
- Exportacao inclui os motivos consolidados e respeita a visao filtrada.

## Componentes

Criar componentes locais do dominio Comercial para evitar alterar outras areas antes das proximas ondas:

- `ComercialCompactPage`: estrutura vertical e area rolavel.
- `ComercialCommandBar`: titulo curto, contexto e acoes.
- `ComercialFilterBar`: filtros primarios e painel de filtros secundarios.
- `ComercialMetricStrip`: faixa de indicadores responsiva.
- `ComercialDataViewport`: container de tabela/lista com rolagem interna.

Os componentes atuais de cotacoes podem ser adaptados internamente para consumir essa fundacao. Os hooks e tipos continuam inalterados.

## Estados

- Carregamento preserva a altura final e usa skeleton compacto.
- Estado inicial ocupa somente a area de conteudo restante.
- Consulta vazia informa que nenhum registro corresponde aos filtros.
- Erros de API continuam distintos de resultado vazio e mantem a acao de tentar novamente.
- Acoes em andamento ficam desabilitadas e exibem feedback no proprio controle.
- Nenhum estado deve produzir rolagem horizontal na pagina inteira.

## Responsividade

- `1440 px`: filtros e indicadores em uma linha; tabela ocupa a altura restante.
- `1024 px`: filtros secundarios recolhidos; indicadores em uma linha quando os valores couberem.
- `768 px`: indicadores em duas colunas; tabela com rolagem horizontal interna.
- `390 px`: painel de filtros, duas colunas de indicadores e lista/tabela reduzida com detalhes no drawer.

## Acessibilidade

- Controles com nome acessivel e foco visivel.
- Icones decorativos marcados com `aria-hidden`.
- Estados de carregamento, erro e atualizacao anunciados sem interromper a navegacao.
- Contraste minimo mantido nos temas claro e escuro.
- Ordem de tabulacao acompanha a ordem visual.

## Validacao

- Testes dos componentes compartilhados para densidade, rotulos e composicao responsiva.
- Testes de Comissoes preservando os parametros da consulta e a exibicao correta de pedidos em aberto.
- Testes de Cotacoes Abertas preservando filtros, ordenacao, drawer e exportacao.
- Testes de Vendas Perdidas preservando motivos, edicao, drawer e exportacao.
- Executar testes direcionados, lint dos arquivos modificados e build de producao.
- Verificacao visual nas larguras de 390, 768, 1024 e 1440 px.

## Criterios de Aceite

- As tres telas compartilham dimensoes, barras, indicadores e estados coerentes.
- Cotacoes Abertas e Vendas Perdidas possuem hierarquia e informacoes especificas ao seu objetivo.
- Totalizadores nao truncam valores nem ocupam altura excessiva.
- No desktop, a rolagem vertical fica restrita ao conteudo principal quando necessaria.
- A pagina nao possui rolagem horizontal global.
- Nao aparecem referencias a IA, copilot, insights inteligentes ou textos promocionais nessas telas.
- Nenhuma regra de negocio, contrato de API ou exportacao e alterada.
