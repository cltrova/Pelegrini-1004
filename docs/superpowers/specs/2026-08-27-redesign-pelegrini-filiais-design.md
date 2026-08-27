# Redesign Pelegrini por Filial

## Objetivo

Transformar o painel Pelegrini de um layout universal para uma experiencia visual proprietaria, inspirada nos sites oficiais da Casa da Transmissao e da Casa do Chevrolet. O sistema deve continuar sendo um painel de gestao denso, rapido e claro, mas com identidade automotiva, marcas das filiais e microinteracoes consistentes.

## Referencias observadas

### Casa da Transmissao

Site: https://casadatransmissao.com.br/

Sinais de marca e negocio:

- Azul escuro forte, branco e visual tecnico.
- Produtos e categorias ligados a caminhoes/onibus: Cambio, Diferencial, Motor, Oleos e aditivos.
- Marcas e autoridade tecnica: ZF, Eaton, MWM e Meritor.
- Linguagem visual de movimento no logo CT, com tracos laterais e sensacao de velocidade/forca.

Direcao para o sistema:

- Tema tecnico-industrial, com linhas de transmissao, engrenagens discretas, movimento horizontal e azul profundo.
- Cards e headers com acentos mecanicos, sem parecer landing page.
- Animacao principal na home: linhas/engrenagem/transmissao em movimento leve.

### Casa do Chevrolet

Site: https://casadochevrolet.com.br/

Sinais de marca e negocio:

- Azul Chevrolet, branco, tradicao e atendimento direto.
- Mensagens fortes: pecas originais Chevrolet, entrega rapida, atendimento especializado, referencia desde 1992.
- Categorias recorrentes: Freio, Arrefecimento, Motor e pecas originais.

Direcao para o sistema:

- Tema mais limpo, automotivo e de varejo especializado.
- Acentos azul Chevrolet, superficies brancas/azuladas e icones de peca original, freio, motor e entrega.
- Destaques de confianca: "Pecas originais", "Desde 1992", "Entrega rapida", usados como detalhes visuais na home e nos headers.

## Escopo

O redesign deve atingir primeiro as superficies globais, porque elas aparecem em todos os modulos:

1. Tema base Pelegrini.
2. Tema visual por filial.
3. Home/tela de modulos.
4. Headers internos.
5. Sidebars e navegacao dos modulos.
6. Seletor de filial e badges.
7. Cards, filtros e estados comuns.
8. Ajuste visual inicial dos modulos Comercial, Operacional, Financeiro e WhatsApp.

Nao faz parte desta primeira fase redesenhar profundamente cada tabela, grafico e fluxo especifico de dados. Esses refinamentos podem vir depois, tela por tela.

## Arquitetura visual

Criar uma camada central de tema Pelegrini, evitando espalhar cores e textos por arquivos soltos.

Unidades previstas:

- `src/config/pelegriniTheme.ts`: tokens de tema, identidade das filiais, textos curtos, categorias e elementos visuais.
- Componentes compartilhados:
  - `PelegriniBrandMark`
  - `PelegriniBranchHero`
  - `PelegriniLayoutShell`
  - `PelegriniBranchBadge`
  - `PelegriniMotionBackdrop`
- CSS utilitario em `src/index.css` para animacoes e superficies reutilizaveis.

O tema ativo deve ser resolvido pela filial ativa:

- `transmissao`: Casa da Transmissao.
- `chevrolet`: Casa do Chevrolet.
- sem filial definida: Pelegrini neutro, com CT e CCH apresentados juntos.

## Home de modulos

A home deve deixar de parecer generica e virar a entrada executiva da Pelegrini.

Comportamento esperado:

- Header com marca Pelegrini e destaque das duas filiais.
- Area hero compacta, sem pagina de marketing longa.
- Composicao visual automotiva com pecas/movimento:
  - Transmissao: tracos de velocidade, engrenagem ou eixo tecnico.
  - Chevrolet: pecas originais, selo "Desde 1992" e entrega rapida.
- Cards dos quatro modulos mantendo leitura rapida.
- Selector/atalho de filial com logos CT e CCH.
- Animacoes leves e profissionais:
  - linhas em movimento na home;
  - hover nos cards;
  - brilho discreto nos logos;
  - respeitar `prefers-reduced-motion`.

## Layout interno

Dentro dos modulos, o usuario deve perceber qual filial esta ativa sem perder espaco util.

Padrao esperado:

- Sidebar com logo da filial ativa, acento de cor e textura sutil.
- Header com nome do modulo, filial ativa e chips de contexto.
- Conteudo com fundo levemente tematico:
  - CT: azul profundo, linhas tecnicas, acentos cyan/azul.
  - CCH: azul Chevrolet, branco, acentos limpos e selo de originalidade.
- Cards e filtros com hover mais refinado, mas sem aumentar demais o tamanho.
- Estado sem filial selecionada deve usar os logos e cards interativos ja criados.

## Modulos

### Comercial

Primeiro modulo a receber mais personalidade, porque e a area mais usada e mais ligada a produtos/clientes.

- Dashboard com header tematico da filial.
- Produtos e Clientes devem manter densidade, mas ganhar filtros/cards mais alinhados a autopecas.
- Cotações e Vendas Perdidas devem ganhar visual de "mesa de decisao", sem poluir.

### Operacional

- Identidade ligada a estoque, giro e pecas.
- Para CT, reforcar visual tecnico/pesado.
- Para CCH, reforcar disponibilidade, entrega e peca original.

### Financeiro

- Manter visual serio e limpo.
- Usar tema de filial apenas nos acentos, header e badges, sem excesso de elementos automotivos.

### WhatsApp

- Visual de atendimento especializado por filial.
- Header pode mostrar filial ativa e status de atendimento.

## Dados e regras

O redesign nao deve alterar:

- endpoints;
- calculos;
- regras de filial;
- permissoes;
- autenticação;
- filtros comerciais/financeiros;
- rotas existentes.

Qualquer mudanca visual deve preservar os testes atuais e o comportamento dos modulos.

## Acessibilidade e responsividade

Requisitos:

- Texto sem sobreposicao em desktop e mobile.
- Contraste suficiente entre fundo, cards e textos.
- Animacoes com fallback para `prefers-reduced-motion`.
- Logos com `alt` quando forem informativos.
- Componentes clicaveis com estados hover/focus/active.
- Layout mobile sem hero grande demais.

## Etapas de implementacao

### Fase 1: Fundacao de tema

- Criar `pelegriniTheme.ts`.
- Mapear tema neutro, tema CT e tema CCH.
- Adicionar testes para resolucao de tema por filial.
- Criar utilitarios CSS de superficies/movimento.

### Fase 2: Home de modulos

- Redesenhar a home desktop.
- Redesenhar a home mobile.
- Adicionar animacao automotiva leve na tela de modulos.
- Manter cards de modulo funcionais.

### Fase 3: Layout shell dos modulos

- Criar padrao compartilhado para fundo/header/sidebar.
- Aplicar nos modulos Comercial, Operacional, Financeiro e WhatsApp.
- Garantir que filial ativa muda acentos visuais.

### Fase 4: Componentes comuns

- Ajustar `FilialBadge`, `FilialSelectorDialog`, filtros, cards comuns e estados vazios.
- Criar linguagem visual consistente para CT/CCH.

### Fase 5: Refinamento por modulo

- Comercial primeiro.
- Operacional segundo.
- Financeiro terceiro.
- WhatsApp quarto.

## Validacao

Comandos esperados:

- `npm test -- src/config/brandAssets.test.ts src/config/pelegriniTheme.test.ts --run`
- testes existentes impactados por layout/configuracao;
- `npm run build`

Validacao visual:

- localhost em desktop.
- localhost em mobile.
- home de modulos.
- troca de filial.
- pelo menos uma tela interna de cada modulo.

## Criterios de aceite

- A home de modulos deve parecer claramente Pelegrini, nao um template universal.
- A filial CT deve ter visual proprio e coerente com Casa da Transmissao.
- A filial CCH deve ter visual proprio e coerente com Casa do Chevrolet.
- Os modulos internos devem mostrar a filial ativa de forma elegante.
- Nenhuma regra de dados ou permissao deve mudar.
- O sistema deve continuar buildando e os testes principais devem passar.
