# Redesign Pelegrini V2 - Identidade real das filiais

Data: 2026-08-27
Projeto: Pelegrini 1004
Branch de trabalho: codex/fundacao-pelegrini

## Objetivo

Transformar o sistema Pelegrini para deixar de parecer um template generico e passar a parecer um painel proprio do Grupo Pelegrini, com presenca clara das duas filiais:

- Casa da Transmissao: foco em pecas tecnicas, cambio, diferencial, motor, oleos e marcas como ZF, Eaton, MWM e Meritor.
- Casa do Chevrolet: foco em pecas originais Chevrolet, tradicao desde 1992, entrega rapida e atendimento especializado.

O trabalho e visual, interativo e de acabamento. Nao deve alterar endpoints, autenticacao, permissoes, filtros, regras comerciais, calculos financeiros ou tratamento de dados.

## Problema atual

A versao publicada trocou cores e adicionou alguns elementos de marca, mas ainda conserva muitos sinais de layout generico:

- Cards grandes com bordas muito arredondadas.
- Efeito glass, blur e gradientes genericos.
- Icones e microinteracoes sem relacao com autopecas.
- Texto residual como "Powered by React" e "BI Reports".
- Home com pouca presenca de produto, oficina, balcão, estoque ou pecas.
- Modulos internos ainda com composicao visual padrao.
- Dialogo de filial ainda parece uma lista generica, apesar das logos.
- Estados vazios, erro e carregamento ainda parecem componentes de template.

## Direcao visual

### Linguagem geral

O sistema deve parecer uma central de operacao automotiva: util, precisa, tecnica e bem acabada. A interface deve continuar escaneavel para gestor, mas com textura visual propria.

Decisoes:

- Reduzir arredondamento excessivo: cards e paineis em 8px a 12px quando possivel.
- Diminuir glass/blur e gradientes decorativos.
- Usar superficies mais solidas, linhas tecnicas, divisorias, trilhos e indicadores.
- Trocar "sparkles" e efeitos de template por microinteracoes ligadas a pecas, movimento mecanico, esteira, engrenagem, estoque e atendimento.
- Evitar fundos com orbes ou blobs.
- Manter densidade gerencial, sem virar landing page.

### Casa da Transmissao

Sinais visuais:

- Azul profundo e ciano tecnico.
- Linhas de transmissao, dentes de engrenagem, trilhos mecanicos e barras de torque.
- Copy: cambio, diferencial, motor, oleos/aditivos, ZF, Eaton, MWM, Meritor.
- Modulos devem parecer ligados a operacao de autopecas tecnicas.

### Casa do Chevrolet

Sinais visuais:

- Azul Chevrolet institucional com branco limpo.
- Faixas horizontais inspiradas no logo.
- Indicadores de pecas originais, entrega rapida, balcão e historico desde 1992.
- Microinteracoes mais limpas, com foco em selo, catalogo, pedido e atendimento.

## Escopo de telas

### Home desktop e mobile

Substituir a composicao atual por uma tela executiva Pelegrini:

- Header mais proprietario, com marca Pelegrini e filial ativa em destaque.
- Hero operacional, nao marketing: "central de operacao das filiais".
- Bloco interativo das duas filiais com logos grandes, estado ativo, indicadores e troca rapida.
- Animacao sutil no fundo:
  - Casa da Transmissao: engrenagens/linhas tecnicas em movimento lento.
  - Casa do Chevrolet: faixa/velocidade e selo original em movimento leve.
- Cards de modulos com formato mais industrial e menos "template":
  - WhatsApp: atendimento e fila.
  - Comercial: pedidos, cotacoes, clientes e produtos.
  - Operacional: estoque, giro e disponibilidade.
  - Financeiro: caixa, DRE e cobranca.
- Remover "Powered by React".
- Remover qualquer texto residual de "BI Reports" na home.

### Sidebars e shell dos modulos

Todas as sidebars devem ganhar identidade de painel Pelegrini:

- Logo da filial com melhor proporcao.
- Rodape sem "BI Reports"; usar "Pelegrini" e nome do modulo.
- Indicador de filial ativa, com botao para trocar filial quando aplicavel.
- Item ativo com sinal visual tecnico, sem gradiente chamativo.
- Separadores mais objetivos.
- Reduzir blur, glow e efeitos genericos.
- Mobile deve preservar abertura/fechamento sem sobrepor texto ou ficar atras do conteudo.

### Dialogo de filiais

Transformar em seletor de filial mais interativo:

- Cards lado a lado no desktop e empilhados no mobile.
- Logos maiores e clicaveis.
- Estado ativo forte.
- Microindicadores:
  - CT: "Cambio", "Diferencial", "ZF".
  - CCH: "Original GM", "Desde 1992", "Entrega rapida".
- Visual proprio de cada filial, nao apenas as mesmas cores.
- Textos devem caber em 320px sem clipping.

### Estados comuns

Atualizar:

- EmptyState.
- ErrorState.
- LoadingState.

Direcao:

- Erro: linguagem de conexao com endpoint/painel, sem parecer tela generica.
- Vazio: contexto operacional, exemplo "Nenhuma cotacao encontrada para esta filial".
- Carregamento: indicador mecanico/linear, nao spinner generico quando possivel.

### Modulos internos

Aplicar camada visual sem mexer nos dados:

- Comercial: dashboards/cards/tabelas com linguagem de vendas de autopecas.
- Operacional: estoque com linguagem de prateleira, giro e disponibilidade.
- Financeiro: paineis mais executivos, menos gradiente decorativo.
- WhatsApp: atendimento com cara de central de relacionamento Pelegrini.

Prioridade inicial:

1. Home e seletor de filiais.
2. Shell e sidebars.
3. Estados comuns.
4. Cabecalhos e superficies dos principais modulos.

## Bugs visuais a corrigir

- Remover textos residuais: "Powered by React", "BI Reports" e qualquer menção que pareca template.
- Reduzir classes de aparencia generica nas telas novas: glass, backdrop-blur, rounded-3xl, sparkles decorativos e gradientes sem funcao.
- Garantir contraste das marcas nas sidebars.
- Garantir responsividade em 320px, 375px, 768px e desktop.
- Evitar cards dentro de cards.
- Evitar texto fora do container.
- Evitar animacoes pesadas ou que atrapalhem leitura.

## Fora de escopo

Nao alterar:

- Endpoints.
- Proxy/API.
- Login/autenticacao.
- Criacao de usuarios.
- Permissoes.
- Regras de filial.
- Calculos.
- Exportacoes Excel.
- Consultas de dados.

A suite completa ja tem falhas conhecidas em `ReceitaDetalheDialog.test.tsx`. Essas falhas devem continuar registradas como externas ao redesign, a menos que o trabalho visual toque diretamente esse arquivo.

## Criterios de aceite

- A home publicada nao pode parecer um template generico com cores novas.
- Deve ficar claro, no primeiro olhar, que o sistema e do Grupo Pelegrini.
- Deve ficar claro que existem duas filiais com personalidades diferentes.
- Nenhum texto residual de Lovable/template/React/BI Reports deve aparecer na experiencia principal.
- O usuario deve conseguir trocar filial de forma visual e intuitiva.
- Todas as telas principais devem manter leitura gerencial e nao ficar poluidas.
- Build de producao deve passar.
- Testes focados de tema, home, componentes Pelegrini e sidebar devem passar.
- Validacao visual manual/browser deve cobrir home, seletor de filial e pelo menos uma tela de cada modulo.

