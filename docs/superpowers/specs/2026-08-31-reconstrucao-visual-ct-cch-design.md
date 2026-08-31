# Reconstrucao Visual CT/CCH

## Objetivo

Reconstruir a camada de apresentacao do sistema para entregar uma interface limpa, tecnica, responsiva e reconhecivel como Casa da Transmissao ou Casa do Chevrolet. A reforma deve remover a aparencia de template sem alterar consultas, calculos, permissoes, endpoints, payloads ou regras de negocio.

## Evidencias da auditoria

- A sidebar recolhida tem 72 px de largura, mas possui conteudo interno com ate 93 px de largura.
- O texto `Voltar aos modulos` e um no de texto direto do botao, enquanto a regra atual oculta apenas elementos `span`.
- O nome da filial esta aninhado dentro do componente de marca e nao e ocultado corretamente no estado recolhido.
- A regra CSS global tenta inferir quais elementos devem desaparecer pela estrutura do DOM, tornando a sidebar fragil.
- O modal de filiais e aberto automaticamente por um efeito executado ao autenticar ou entrar na Home.
- As rotas nao apresentam overflow horizontal geral no desktop auditado, mas ainda usam componentes e classes visuais diferentes, incluindo cards legados, larguras fixas e densidades inconsistentes.

## Direcao visual

O sistema usara uma linguagem de painel automotivo tecnico, com superficies claras, contraste alto, bordas precisas, poucos efeitos decorativos e hierarquia compacta.

### Casa da Transmissao

- Azul profundo, ciano tecnico e branco.
- Referencias discretas a transmissao, motor, diferencial e linha pesada.
- Indicadores com linguagem de aplicacao, giro, disponibilidade e performance.

### Casa do Chevrolet

- Azul Chevrolet, branco e amarelo usado apenas como acento.
- Referencias a catalogo original, procedencia, estoque, entrega e atendimento.
- Indicadores com linguagem de disponibilidade, pedidos, clientes e velocidade de atendimento.

As duas filiais compartilharao a mesma arquitetura visual, mas terao tokens, marca, acentos e vocabulario proprios. A diferenciacao nao dependera somente do logotipo.

## Arquitetura visual

### Shell compartilhado

Criar uma estrutura unica para os modulos com:

- sidebar desktop recolhida em 72 px;
- expansao para 248 px ao passar o mouse ou receber foco;
- area principal reservando apenas os 72 px fixos;
- camada expandida sobre o conteudo, com sombra discreta;
- header movel proprio;
- superficie principal com largura minima zero e sem overflow de pagina.

### Sidebar

Substituir as quatro implementacoes duplicadas por um componente compartilhado configurado por modulo.

Cada item tera estrutura explicita de icone, rotulo e indicador. No estado recolhido:

- apenas icones permanecem visiveis;
- cada item recebe tooltip e nome acessivel;
- nenhum texto e apenas comprimido ou cortado;
- divisorias ocupam somente a largura interna;
- o estado ativo usa barra lateral e fundo contido dentro da largura disponivel;
- a marca usa uma variante compacta real, sem depender de seletores CSS estruturais.

No estado expandido, rotulos e controles aparecem com transicao de opacidade posterior a expansao da largura, evitando texto quebrado durante a animacao.

### Entrada de modulos e filial

A Home nunca abrira o modal automaticamente.

Fluxo:

1. O usuario visualiza os modulos disponiveis.
2. Ao clicar em um modulo permitido, o sistema abre o modal com Casa da Transmissao e Casa do Chevrolet, respeitando as permissoes existentes.
3. Ao escolher a filial, o contexto ativo e atualizado e o usuario entra no modulo clicado.
4. Cancelar fecha o modal e mantem o usuario na Home.
5. Configuracoes continuam acessiveis diretamente, sem selecao de filial quando ela nao for necessaria.

O modal nao tera opcao Pelegrini e nao sera exibido ao carregar, atualizar ou retornar para a Home.

### Componentes de dados

Consolidar primitives compartilhadas para:

- titulos de pagina e acoes;
- barra de filtros responsiva;
- cards KPI;
- valores monetarios e numericos responsivos;
- paineis de grafico;
- tabelas e estados vazios;
- tabs longas;
- loading, erro e ultima atualizacao.

Valores devem usar `min-width: 0`, numeros tabulares, escala responsiva limitada e quebra controlada. Grades devem mudar de uma a quatro colunas conforme o espaco real. Scroll horizontal sera permitido apenas dentro de tabelas que precisem dele.

## Migracao por ondas

### Onda 1: fundacao

- shell, sidebar, navegacao movel e tokens CT/CCH;
- fluxo do modal sob clique;
- Home de modulos;
- primitives de pagina, KPI, painel, filtro e tabela.

### Onda 2: Comercial

- dashboard, produtos, clientes, comissao, cotacoes, vendas perdidas e campanhas;
- remocao de titulos e textos repetidos;
- responsividade de KPIs, filtros, graficos e tabelas.

### Onda 3: Operacional

- estoque e retroativo;
- substituicao dos cards legados e larguras fixas;
- reorganizacao dos filtros extensos no mobile.

### Onda 4: Financeiro

- resumo, DRE, variacao, duplicatas, saldo a vencer e fluxo de caixa;
- hierarquia consistente para valores, tabelas e detalhamentos.

### Onda 5: WhatsApp e Configuracoes

- conversas, relatorios, agentes e configuracoes do WhatsApp;
- empresas e usuarios com linguagem administrativa neutra;
- consistencia final dos estados de erro, vazio e carregamento.

## Preservacao funcional

Nao serao alterados:

- hooks de dados;
- contratos de API;
- endpoints ou configuracoes de VPS;
- schemas e payloads;
- permissoes e rotas protegidas;
- calculos e regras comerciais;
- integracoes existentes.

A unica mudanca de comportamento sera o momento de abertura do modal de filial, conforme o fluxo aprovado.

## Validacao

### Testes automatizados

- sidebar compacta sem rotulos visiveis ou overflow;
- expansao por hover e foco;
- navegacao por teclado e tooltips;
- modal ausente ao carregar a Home;
- modal presente apos clique em cada modulo;
- selecao de filial preservando o modulo de destino;
- permissoes de filial e modulo mantidas;
- valores longos contidos em cards;
- ausencia de termos Lovable e BI Reports na interface.

### Verificacao visual

Auditar CT e CCH nas larguras 390, 768, 1024 e 1440 px nas rotas principais de todos os modulos.

### Criterios de aceite

- nenhum texto ou icone cortado na sidebar;
- nenhum texto visivel no estado recolhido;
- nenhuma rolagem horizontal na pagina;
- nenhum valor escapando de card;
- modal de filial exibido somente apos clique em modulo;
- CT e CCH visualmente distintas;
- titulos, filtros, cards e tabelas consistentes;
- funcionalidades e dados existentes preservados;
- testes e build aprovados.

## Entrega

A execucao sera feita sobre as alteracoes locais existentes, sem descartar trabalho anterior. Cada onda sera validada antes da seguinte. Publicacao no GitHub e Cloudflare sera realizada somente quando solicitada apos a validacao visual final.
