# Reestruturacao Visual Empresarial Onda 1

## Objetivo

Criar a primeira onda da reestruturacao visual do sistema para substituir a aparencia generica de template por uma interface empresarial madura, compacta e orientada a decisao. A entrega deve estabelecer uma base visual reutilizavel e aplica-la como piloto nas telas de maior valor gerencial dos modulos Comercial, Operacional e Financeiro.

A reforma e prioritariamente visual e de experiencia. Nao deve alterar regras de negocio, consultas, calculos, permissoes, endpoints, payloads, integracoes ou contratos de dados.

## Escopo Da Onda 1

Esta onda cobre a fundacao visual e as telas principais para gestores:

- Comercial: dashboard, vendedores e clientes.
- Operacional: estoque.
- Financeiro: resumo e DRE.

As demais telas permanecem funcionais e serao migradas em ondas posteriores usando os mesmos componentes e contratos visuais criados aqui.

## Auditoria Inicial

O sistema ja possui uma fundacao recente em componentes `Pelegrini*`, incluindo shell, sidebar, header, tabs, paines e cards. Essa fundacao deve ser reaproveitada quando estiver alinhada com a nova linguagem, mas ainda existem padroes concorrentes e inconsistentes espalhados pelas telas.

Padroes atuais que devem ser corrigidos:

- filtros implementados separadamente por modulo e por pagina;
- uso concorrente de `UnifiedFilterBar`, `CollapsibleFilterBar`, `ComercialFilters`, filtros financeiros, filtros de estoque e filtros de cotacoes;
- excesso de `rounded-xl`, `rounded-2xl`, sombras genericas e gradientes decorativos;
- cards brancos independentes usados como unidade visual padrao mesmo quando uma secao ou tabela resolveria melhor;
- icones dentro de caixas coloridas repetidos em muitos indicadores;
- cabecalhos e filtros altos demais para uso em notebook corporativo;
- hierarquia numerica fraca, com muitos valores competindo com o mesmo peso;
- tabelas e listas com densidade, alinhamento numerico e estados visuais diferentes entre telas.

## Direcao Visual

A interface deve parecer uma plataforma empresarial de BI e gestao, com leitura rapida, alto aproveitamento de tela e identidade propria para o grupo Pelegrini.

Principios:

- superficies retangulares com raio maximo de 8 px para paineis e cards de dados;
- sombras raras e discretas, usadas apenas para menus, popovers e overlays;
- bordas e divisorias sutis para organizar informacao sem criar caixas dentro de caixas;
- tipografia compacta, numeros tabulares e contraste claro entre informacao primaria e secundaria;
- menos decoracao e mais densidade util;
- indicadores com contexto, comparacao e leitura executiva sempre que os dados existirem;
- filtros horizontais, compactos e responsivos, sem ocupar uma faixa alta da tela;
- graficos e tabelas como protagonistas das paginas, nao como conteudo escondido dentro de cards decorativos.

Referencias conceituais: Linear, Stripe Dashboard, Notion e ferramentas modernas de BI. A implementacao nao deve copiar layouts especificos dessas ferramentas.

## Arquitetura De Componentes

Criar uma camada compartilhada de componentes empresariais em `src/components/enterprise/`. Esses componentes podem usar primitives shadcn/Radix e podem reaproveitar conceitos dos componentes `Pelegrini*`, mas devem expor uma API neutra e adequada para todos os modulos.

### EnterprisePageHeader

Responsavel pelo topo compacto de cada pagina.

Deve suportar:

- titulo curto;
- contexto ou subtitulo objetivo;
- acao primaria e acoes secundarias;
- metadados como periodo aplicado, empresa/filial ativa e ultima atualizacao;
- densidade consistente em desktop e mobile.

Nao deve renderizar hero, gradiente decorativo ou textos institucionais longos.

### EnterpriseFilterBar

Responsavel pela organizacao dos filtros em todas as telas migradas.

Deve suportar:

- layout horizontal compacto em desktop;
- quebra responsiva em linhas controladas;
- modo colapsavel em telas pequenas;
- contador de filtros ativos;
- resumo dos filtros aplicados;
- botao claro para limpar filtros;
- acao de aplicar/buscar quando a tela usa estado pendente;
- area opcional para contador de resultados;
- sem bordas aninhadas ou paines altos.

A barra deve ser a unica estrutura de filtro usada nas telas migradas. Componentes como `UnifiedFilterBar` e `CollapsibleFilterBar` podem ser adaptados ou substituidos, mas nao devem continuar criando experiencias diferentes nas telas piloto.

### Campos Padronizados De Filtro

Criar componentes padronizados para tipos recorrentes:

- `EnterpriseDateFilter`: periodo, mes, dia unico e intervalo quando necessario;
- `EnterpriseSearchFilter`: busca por texto com icone e atalho visual discreto quando aplicavel;
- `EnterpriseSelectFilter`: selecao unica;
- `EnterpriseMultiSelectFilter`: multiplas selecoes com busca, contador e limpar;
- `EnterpriseSellerFilter`: vendedor com busca, inicial/avatar quando disponivel e contador de selecionados;
- `EnterpriseClientFilter`: cliente por nome/codigo com busca e resultado limitado;
- `EnterpriseBranchFilter`: empresa/filial com label consistente;
- `EnterpriseStatusFilter`: status com badges neutros;
- `EnterpriseCategoryFilter`, `EnterpriseBrandFilter` e `EnterpriseProductFilter`: variantes especializadas sobre multi-select pesquisavel.

Quando um tipo de filtro aparecer em mais de uma tela, deve usar o mesmo componente, o mesmo comportamento e a mesma densidade visual.

### EnterpriseMetricCard

Substitui cards de indicadores dispersos.

Deve suportar:

- rotulo;
- valor principal;
- contexto do valor;
- variacao positiva, negativa ou neutra;
- comparacao com periodo anterior;
- meta e percentual de meta atingida quando disponivel;
- detalhe secundario curto;
- estado vazio ou indisponivel;
- alinhamento numerico tabular.

O componente nao deve depender de icones decorativos. Icone e permitido apenas quando ajuda a reconhecer uma categoria de dado, com tratamento discreto.

### EnterpriseDataPanel

Responsavel por agrupar graficos, listas e blocos de analise.

Deve suportar:

- titulo opcional pequeno;
- acao ou menu secundario;
- densidade compacta;
- conteudo sem padding excessivo quando o filho for tabela ou grafico;
- borda simples;
- sem card dentro de card.

### EnterpriseDataTable

Padrao visual para tabelas migradas.

Deve suportar:

- linhas compactas;
- cabecalho fixo quando o container rolar;
- alinhamento de valores monetarios e percentuais a direita;
- numeros tabulares;
- destaque de totais e subtotais;
- estados de carregamento, vazio e erro;
- rolagem horizontal somente dentro do container da tabela;
- formato consistente de datas, moeda e percentuais.

### EnterpriseBadge E VarianceIndicator

Responsaveis por estados, status e variacoes.

Devem usar cor com parcimonia:

- positivo: verde discreto;
- negativo: vermelho discreto;
- alerta: amarelo contido;
- informativo: azul ou ciano contido;
- neutro: cinza.

O objetivo e facilitar leitura, nao transformar a tela em uma composicao multicolorida.

## Tokens E CSS

Adicionar uma base de tokens empresariais ao CSS global, sem quebrar os tokens shadcn existentes.

Tokens recomendados:

- `--enterprise-surface`;
- `--enterprise-surface-subtle`;
- `--enterprise-border`;
- `--enterprise-border-strong`;
- `--enterprise-text-muted`;
- `--enterprise-positive`;
- `--enterprise-negative`;
- `--enterprise-warning`;
- `--enterprise-info`;
- `--enterprise-row-hover`;

Regras globais:

- reduzir uso de sombras em cards;
- limitar radius de paineis, filtros e metric cards a 8 px;
- manter `letter-spacing: 0` fora de pequenos labels uppercase;
- nao escalar fontes com largura de viewport;
- usar `min-width: 0` em layouts flex/grid;
- impedir overflow horizontal de pagina;
- permitir overflow horizontal apenas dentro de tabelas.

## Aplicacao Nas Telas Piloto

### Comercial Dashboard

Objetivo da tela: mostrar rapidamente desempenho comercial, faturamento, devolucoes, evolucao, ranking e pontos de atencao.

Mudancas:

- substituir filtros comerciais grandes pela nova `EnterpriseFilterBar`;
- organizar KPIs em grid compacto com `EnterpriseMetricCard`;
- remover cards premium/legacy concorrentes onde a tela piloto for migrada;
- reduzir titulos, textos auxiliares e espacos vazios;
- manter graficos em `EnterpriseDataPanel`;
- priorizar faturamento, variacao, meta e ranking com hierarquia clara.

### Comercial Vendedores

Objetivo da tela: comparar desempenho individual e identificar vendedores acima/abaixo da meta.

Mudancas:

- usar `EnterpriseSellerFilter` para vendedor em todas as areas;
- compactar ranking e indicadores;
- alinhar valores monetarios e percentuais;
- reduzir decoracao de podium e gradientes;
- manter detalhes/drilldowns existentes sem mudar regras.

### Comercial Clientes

Objetivo da tela: identificar clientes relevantes, carteira, queda, recompra e oportunidades.

Mudancas:

- usar `EnterpriseClientFilter`, `EnterpriseSellerFilter` e periodo padronizado;
- reduzir cards repetitivos;
- destacar valor, frequencia, recencia e risco;
- padronizar tabelas e listas de clientes.

### Operacional Estoque

Objetivo da tela: identificar disponibilidade, giro, excesso, falta e valor em estoque.

Mudancas:

- substituir `UnifiedFilterBar` e chips atuais pela nova barra;
- preservar logica de filtros pendentes/aplicados;
- compactar controles de busca e modo de visualizacao;
- usar metric cards para estoque total, valor, itens criticos e giro;
- padronizar tabela de produtos e paines de movimento.

### Financeiro Resumo

Objetivo da tela: mostrar liquidez, contas a receber, risco, aging e cobranca.

Mudancas:

- mover acoes `Buscar`, `Limpar` e `Atualizar` para o header ou barra de filtros;
- usar filtros financeiros padronizados na aba de duplicatas;
- reorganizar KPIs de liquidez e risco com contexto;
- padronizar funil, aging, top risco e tabelas com paineis empresariais.

### Financeiro DRE

Objetivo da tela: mostrar resultado, margem, despesas e composicao do DRE com leitura executiva.

Mudancas:

- aplicar header e filtro padronizado;
- padronizar indicadores de receita, custo, margem, EBITDA/lucro e ponto de equilibrio quando existirem;
- reduzir hover exagerado e sombras nas linhas;
- manter hierarquia da tabela DRE, mas com densidade e alinhamento consistentes.

## Preservacao Funcional

Nao alterar:

- hooks de dados;
- contratos das APIs;
- payloads;
- migrations;
- permissoes;
- rotas protegidas;
- calculos comerciais, financeiros ou operacionais;
- integracoes Supabase, VPS, WhatsApp ou exportacoes.

Mudancas permitidas:

- reorganizacao de JSX;
- substituicao de componentes visuais;
- classes CSS;
- componentes de apresentacao;
- formatacao visual de valores usando os formatadores existentes;
- melhoria de estados vazios, erro e carregamento.

## Migracao Progressiva

A migracao deve acontecer nesta ordem:

1. Criar tokens e primitives empresariais.
2. Criar testes de contrato visual para filtros, metric cards, paineis e tabelas.
3. Migrar Comercial Dashboard.
4. Migrar Comercial Vendedores.
5. Migrar Comercial Clientes.
6. Migrar Operacional Estoque.
7. Migrar Financeiro Resumo.
8. Migrar Financeiro DRE.
9. Executar validacao automatizada e auditoria visual nas telas piloto.

Cada tela migrada deve manter a mesma logica de estado, busca e filtros que possui hoje.

## Testes Automatizados

Criar testes focados em contratos de apresentacao e preservacao funcional:

- `EnterpriseFilterBar` exibe contador de filtros ativos;
- limpar filtros chama o callback correto;
- aplicar filtros chama o callback correto;
- filtros multi-select exibem busca e quantidade selecionada;
- `EnterpriseMetricCard` renderiza valor principal, contexto, variacao e meta;
- `EnterpriseDataTable` alinha colunas numericas e permite scroll interno;
- telas piloto continuam chamando os mesmos hooks e renderizando dados principais;
- a pagina nao cria rolagem horizontal em containers principais testaveis;
- estados vazios e carregamento continuam acessiveis.

Testes existentes de calculo e dados devem continuar passando sem alteracao de expectativa funcional.

## Validacao Visual

Verificar as telas piloto em larguras:

- 390 px;
- 768 px;
- 1024 px;
- 1440 px.

Rotas de auditoria:

- `/comercial/dashboard`;
- `/comercial/vendedores`;
- `/comercial/clientes`;
- `/operacional/estoque`;
- `/financeiro/resumo`;
- `/financeiro/dre`.

Checklist visual:

- sem overflow horizontal de pagina;
- filtros compactos e consistentes;
- cards sem altura excessiva;
- dados principais aparecem antes de informacoes secundarias;
- tabelas legiveis e compactas;
- graficos sem decoracao desnecessaria;
- botoes e campos sem texto cortado;
- sem gradientes decorativos nas areas migradas;
- sem excesso de sombras;
- sem cards aninhados.

## Fora De Escopo Desta Onda

- migrar todas as telas do sistema;
- alterar comportamento de negocio;
- alterar APIs ou schemas;
- redesenhar WhatsApp, Configuracoes, Cotacoes e telas secundarias fora das rotas piloto;
- criar uma landing page ou nova home institucional;
- trocar biblioteca de UI;
- reescrever hooks de dados.

## Criterios De Aceite

- componentes `Enterprise*` criados e usados nas telas piloto;
- filtros das telas piloto seguem um padrao unico;
- indicadores principais trazem contexto quando os dados ja existem;
- densidade visual melhora sem deixar a interface apertada;
- telas piloto preservam os dados e comportamentos atuais;
- build e testes relevantes passam;
- auditoria visual das larguras definidas nao encontra overflow horizontal;
- a aparencia das telas piloto deixa de parecer template generico e passa a comunicar software empresarial maduro.

