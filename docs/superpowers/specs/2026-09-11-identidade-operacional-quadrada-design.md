# Identidade Visual Quadrada do Operacional

## Objetivo

Atualizar a identidade visual do módulo Operacional para uma linguagem mais técnica, administrativa e direta, inspirada nas referências fornecidas. A mudança deve retirar a aparência excessivamente associada a interfaces de inteligência artificial sem alterar cores, dados, navegação ou regras de negócio.

Fluidez é um requisito central: a interface deve responder imediatamente, não produzir saltos de layout e não utilizar efeitos visuais que prejudiquem renderização, leitura ou interação.

## Escopo

A primeira etapa contempla exclusivamente:

- Sidebar do módulo Operacional, nos estados minimizado e expandido.
- Estoque: Visão geral, Central de Estoque, Giro de Estoque e Assistente.
- Estoque Retroativo.
- Evolução de Distribuidores.
- Filtros, tabelas, painéis, indicadores, gráficos, diálogos e drawers usados nessas telas.

Comercial, Financeiro, WhatsApp, Configurações e a tela inicial não serão alterados nesta etapa.

## Estratégia De Isolamento

A identidade será aplicada por uma camada visual específica do Operacional. O shell do módulo receberá um identificador estável que permita selecionar a sidebar e o conteúdo sem modificar os componentes globais do sistema.

Os componentes compartilhados continuarão com o comportamento atual fora do Operacional. Quando um componente precisar de alteração estrutural, ela será exposta por uma variante ou classe explícita, nunca por uma regra global que alcance outros módulos acidentalmente.

## Linguagem Visual

### Geometria

- Painéis, cartões funcionais, tabelas e seções enquadradas usarão raio de `2px`.
- Botões, campos, menus, popovers, diálogos e drawers usarão raio máximo de `4px`.
- Badges semânticos, indicadores circulares, avatares e pontos de legenda poderão permanecer arredondados quando a forma comunica estado ou identidade.
- Seções principais serão organizadas como faixas e grades contínuas, evitando conjuntos de cartões flutuantes.

### Superfícies

- Preservar as cores atuais das filiais e os modos claro e escuro.
- Usar fundos sólidos ou levemente diferenciados por luminosidade.
- Remover blur, glassmorphism, brilhos, halos, gradientes decorativos e sombras profundas no Operacional.
- Manter bordas de `1px` como principal recurso de separação.
- Sombras serão reservadas para elementos temporários sobrepostos, como popovers e diálogos, e deverão ser discretas.

### Tipografia E Densidade

- Preservar a família tipográfica atual.
- Usar títulos compactos e hierarquia por peso, caixa e espaçamento, sem tipografia heroica dentro das telas operacionais.
- Manter números tabulares e alinhamento consistente em indicadores e tabelas.
- Trabalhar em uma grade de espaçamento de `4px` e `8px`, com densidade semelhante às referências.

### Navegação

- Preservar o comportamento atual da sidebar: minimizada por padrão e expandida conforme a interação existente.
- O estado expandido adotará estrutura linear, separadores simples, numeração auxiliar dos itens e destaque ativo por faixa lateral, sem glow.
- O estado minimizado continuará usando ícones centralizados e dimensões estáveis.
- A expansão não poderá deslocar ou redimensionar o conteúdo da página durante a animação.

## Fluidez E Movimento

- Transições de cor e opacidade terão duração entre `120ms` e `180ms`.
- A abertura visual da sidebar poderá permanecer até `220ms`, priorizando `transform` e `opacity`; a largura reservada para o conteúdo não mudará durante a animação.
- Remover animações de escala, elevação, rotação decorativa, brilho contínuo e fundos animados do Operacional.
- Estados de hover não poderão alterar dimensões, padding, borda ou fluxo do documento.
- Elementos com tamanho previsível terão dimensões estáveis para evitar layout shift durante carregamento, hover ou atualização de dados.
- Atualizações de filtros e dados preservarão o conteúdo anterior ou um espaço equivalente até a nova resposta, evitando telas que colapsam e reaparecem.
- Respeitar `prefers-reduced-motion`, desativando transições não essenciais.
- Gráficos manterão interação e animação apenas quando ela ajuda a leitura; entradas longas ou repetitivas serão eliminadas.

## Componentes

### Shell E Sidebar

O shell fornecerá o escopo visual do módulo. A sidebar manterá largura, rotas, permissões, logos e comportamento atuais, recebendo apenas a nova composição visual. O item ativo será uma linha sólida com indicador lateral na cor de destaque da filial.

### Cabeçalhos E Barras De Ferramentas

Cabeçalhos serão faixas horizontais compactas, separadas por borda inferior. Filtros e ações manterão ícones familiares, dimensões estáveis e alinhamento em uma única linha quando houver espaço.

### Indicadores E Painéis

Indicadores serão células de uma grade contínua. Painéis terão cabeçalho simples, corpo sem camadas decorativas e bordas compartilhadas sempre que possível. Não haverá cartões aninhados.

### Tabelas

Tabelas usarão cabeçalho discreto, linhas de altura consistente, divisórias finas e hover por mudança de fundo. Ações continuarão acessíveis por ícones e tooltips. A responsividade não poderá criar rolagem horizontal na página; quando a quantidade de colunas exigir, a rolagem ficará confinada à própria tabela ou haverá uma visualização móvel alternativa.

### Filtros E Sobreposições

Popovers, diálogos e drawers manterão foco, teclado e comportamento atuais. A geometria será reduzida para `4px`, com fundo sólido e sombra curta. Camadas continuarão respeitando a sidebar e não poderão causar sobreposição incoerente.

### Gráficos

As cores e os dados permanecerão iguais. Containers, tooltips e seletores adotarão a nova geometria. Gradientes que representam área de dados podem permanecer quando melhoram a leitura; gradientes puramente decorativos serão removidos.

## Estados E Responsividade

- Preservar carregamento, erro, vazio, atualização e indisponibilidade já existentes.
- Skeletons e spinners terão espaço reservado para evitar mudanças bruscas de layout.
- Validar larguras de `1440px`, `1024px`, `768px` e `390px`.
- Validar sidebar minimizada e expandida nos tamanhos aplicáveis.
- Garantir ausência de sobreposição, corte de texto e rolagem horizontal da página.
- Manter contraste e legibilidade nos modos claro e escuro.

## Validação

- Testes de escopo garantirão que a identidade quadrada seja aplicada ao Operacional e não alcance outros módulos.
- Testes dos componentes compartilhados protegerão dimensões, acessibilidade e comportamento da sidebar, painéis, filtros e tabelas.
- Executar lint, TypeScript, testes focados e build de produção.
- Fazer inspeção visual em Estoque, Estoque Retroativo e Distribuidores nos quatro tamanhos definidos, em claro e escuro.
- Verificar fluidez da sidebar, abertura de filtros, drawers, troca de abas, hover de gráficos e atualização de dados.

## Fora Do Escopo

- Alterar paleta, logos ou tipografia base.
- Reescrever consultas, hooks, endpoints ou cálculos.
- Redesenhar os demais módulos.
- Introduzir nova biblioteca de componentes ou animação.
