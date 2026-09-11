# Identidade Visual Quadrada do Comercial

## Objetivo

Atualizar o modulo Comercial para a mesma linguagem tecnica, administrativa e direta aprovada no Operacional. A interface deve perder a aparencia de composicao gerada por inteligencia artificial, mantendo a paleta atual, as identidades das filiais, os dados, as permissoes e todas as regras comerciais.

Fluidez continua sendo requisito central: navegacao, filtros, mudancas de aba e atualizacoes de dados nao podem provocar saltos de layout, telas vazias intermediarias ou animacoes que prejudiquem a leitura.

## Escopo

A etapa contempla o shell e as telas atuais do Comercial:

- Sidebar desktop e navegacao inferior mobile.
- Dashboard e suas visoes: Visao Geral, Detalhes, Metas Diarias, Ranking, Comparativos, Insights IA e Campanhas.
- Produtos.
- Clientes e Analise de Clientes.
- Comissao.
- Cotacoes Abertas.
- Vendas Perdidas.
- Selecao de filial apresentada ao entrar por link direto.
- Filtros, indicadores, tabelas, graficos, popovers, dialogos e drawers usados por essas telas.

As diferencas existentes entre empresas e filiais, incluindo `1004`, `10041` e demais contextos suportados, serao preservadas.

## Estrategia

O shell existente ja fornece `data-module-shell="comercial"`; esse atributo sera a fronteira principal da identidade. A nova camada visual refinara os componentes compactos existentes, principalmente `ComercialCompactPage`, `ComercialCommandBar`, `ComercialFilterBar`, `ComercialMetricStrip` e `ComercialDataViewport`.

Alteracoes em componentes compartilhados serao expostas por classes ou variantes explicitas. Nenhuma regra global podera modificar Operacional, Financeiro, WhatsApp, Configuracoes ou a central de modulos.

O trabalho sera executado sobre o branch `codex/identidade-comercial-quadrada`, criado a partir da versao publicada no commit `9dca177`.

## Linguagem Visual

### Geometria E Superficies

- Paineis, celulas de indicadores, tabelas e secoes enquadradas usarao raio de `2px`.
- Campos, botoes, menus, popovers, dialogos e drawers usarao raio maximo de `4px`.
- Badges, avatares, indicadores de status e elementos cuja forma circular comunica significado continuarao arredondados.
- Bordas finas substituirao sombras profundas, halos, blur e efeitos de vidro.
- Gradientes decorativos serao removidos; gradientes que representam valores em graficos poderao permanecer.
- As secoes serao organizadas como faixas e grades continuas, sem cartoes aninhados.

### Tipografia E Densidade

- Preservar fonte, cores e contraste atuais.
- Titulos serao compactos, sem escala heroica dentro das telas de trabalho.
- Valores monetarios, quantidades e percentuais usarao numeros tabulares e alinhamento consistente.
- Espacamento seguira uma grade de `4px` e `8px`, com linhas de tabela e barras de ferramentas densas, mas legiveis.

## Navegacao

### Desktop

- A sidebar permanecera minimizada por padrao e expandira pelo comportamento atual.
- O modo expandido usara composicao linear, numeracao auxiliar e marcador lateral solido para a rota ativa.
- A expansao sera sobreposta ao conteudo: a area principal mantera a largura reservada e nao sofrera deslocamento.
- Rotas, permissoes, itens futuros e regras de disponibilidade por empresa permanecerao iguais.

### Mobile

- A navegacao inferior existente sera preservada, com dimensoes estaveis e destaque ativo sem brilho.
- Acoes adicionais continuarao acessiveis pelo menu atual.
- Conteudo, overlays e barras fixas respeitarao as areas seguras e nao criarao rolagem horizontal da pagina.

## Estrutura Das Telas

### Cabecalhos E Filtros

- Cabecalhos serao faixas compactas com titulo, contexto e acoes alinhadas.
- Filtros seguirao o padrao recolhivel ja adotado no sistema, com botao de funil e painel portado quando a largura nao comportar os campos.
- Filtros aplicados continuarao visiveis por contagem ou resumo compacto, sem ocupar uma faixa excessiva.
- Abertura de filtros nao podera ultrapassar a sidebar nem os limites do viewport.

### Indicadores

- Indicadores serao celulas de uma grade continua, sem cards flutuantes.
- Valores longos nao poderao cortar ou empurrar celulas vizinhas; em telas estreitas, a faixa podera rolar internamente.
- Tons semanticos atuais serao preservados e nao serao usados para inferir conclusoes que os dados nao sustentam.

### Tabelas

- Cabecalhos discretos, linhas de altura consistente, divisorias finas e hover somente por cor.
- Ordenacao, selecao, paginacao, exportacao e acoes por linha permanecerao funcionais e acessiveis.
- Quando as colunas nao couberem, o overflow ficara confinado ao viewport da tabela; a pagina nunca tera rolagem horizontal.
- Telas que ja possuem apresentacao mobile especifica continuarao usando-a.

### Graficos, Insights E Campanhas

- Dados, escalas e cores dos graficos permanecerao iguais.
- Containers e tooltips adotarao a geometria quadrada e fundo solido.
- Tooltips devem desaparecer ao retirar o ponteiro e nao podem ficar presos sobre o conteudo.
- Insights devem priorizar acao gerencial, com texto integralmente legivel e sem cortes.
- Campanhas preservarao filtros, metas e regras atuais; somente sua composicao visual sera ajustada.

### Dialogos E Drawers

- Manter foco, teclado, fechamento, scroll e hierarquia atuais.
- Overlays portados receberao classe explicita do Comercial para preservar o isolamento de estilos.
- Textos e tabelas internas deverao caber no painel sem sobreposicao.

## Fluidez E Estados

- Transicoes de cor e opacidade entre `120ms` e `180ms`; sidebar com limite de `220ms`.
- Remover escala, elevacao, brilho continuo, fundos animados e movimentos decorativos.
- Hover e foco nao poderao alterar dimensoes, padding ou bordas de forma que mova o layout.
- Durante refetch, manter os dados anteriores montados e indicar a atualizacao localmente.
- Carregamento inicial reservara a geometria final por skeleton ou estado equivalente.
- Erro, vazio, indisponibilidade e recuperacao continuarao distintos; falha de uma fonte nao podera aparecer como valor zero.
- Respeitar `prefers-reduced-motion` em componentes e overlays do Comercial.

## Responsividade

Validar `1440x900`, `1024x768`, `768x1024` e `390x844`, nos modos claro e escuro.

Em todas as larguras:

- `documentElement.scrollWidth` deve permanecer igual a `clientWidth`.
- Nenhum texto pode sobrepor outro elemento ou ficar cortado sem alternativa de acesso.
- Tabelas e faixas de indicadores podem usar scroll interno, sem deslocar a pagina.
- Filtros, drawers e dialogos devem permanecer inteiramente acessiveis no viewport.
- Trocas de aba e atualizacoes nao podem desmontar a estrutura principal.

## Validacao

- Testes de escopo garantirao que a identidade alcance apenas `data-module-shell="comercial"`.
- Testes dos componentes compactos protegerao geometria, acessibilidade, overflow e estabilidade.
- Testes da sidebar cobrirao estados minimizado, expandido, ativo, mobile e permissoes por empresa.
- Testes de pagina cobrirao carregamento inicial, refetch com dados preservados, erro, vazio e recuperacao.
- Executar testes focados, TypeScript, lint e build; falhas preexistentes serao registradas separadamente.
- Realizar inspecao real em navegador nas rotas principais e nos quatro viewports definidos.
- Confirmar explicitamente que Operacional e Financeiro nao receberam classes ou alteracoes visuais do Comercial.

## Fora Do Escopo

- Alterar consultas, endpoints, calculos, metas, comissoes ou regras de campanhas.
- Modificar paleta, logos ou tipografia base.
- Redesenhar outros modulos nesta etapa.
- Introduzir biblioteca nova de componentes, graficos ou animacao.
- Fazer migracao de banco ou alterar contratos da API.
