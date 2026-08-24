# Comercial Pelegrini

## Contexto

O projeto Pelegrini deve nascer dentro deste repositorio aproveitando o sistema geral existente. A Fundacao Pelegrini criou a home e a entrada modular, mas os modulos internos nao devem ser recriados do zero. Para o modulo Comercial, a diretriz do produto e clara: layouts, funcionalidades e regras devem vir do sistema geral de Comercial, com ajustes especificos apenas quando forem necessarios para Pelegrini.

O codigo atual ja possui uma base comercial grande, com rotas, paginas, filtros, dashboards, regras de filial, regras 1004/10041, vendedores, produtos, marcas, clientes, comissao, metas e variantes premium/legacy. A proxima etapa deve garantir que Pelegrini acesse o modulo Comercial completo, e nao uma versao simplificada.

## Objetivo

Entregar o modulo Comercial Pelegrini como uma composicao completa do sistema geral:

- manter o `ComercialLayout` desktop e o `ComercialMobileLayout` mobile;
- manter as regras existentes de autenticacao, modulo, empresa e filial;
- expor no menu as telas comerciais existentes que fazem parte do sistema geral;
- remover redirecionamentos indevidos que escondem funcionalidades ja existentes;
- preservar as regras Pelegrini 1004/10041 ja presentes nos hooks e utilitarios;
- deixar o modulo pronto para evoluir com dados reais e ajustes finos sem reescrever a arquitetura.

## Regra Principal

Pelegrini deve herdar o comportamento do sistema geral do modulo Comercial. Isso significa que uma tela ou regra ja implementada no sistema geral deve ser reaproveitada, salvo quando houver motivo explicito para bloquear, ocultar ou substituir.

Nao criar cards vazios, paginas placeholder ou fluxos paralelos para Comercial Pelegrini quando ja existir pagina equivalente no sistema geral.

## Fora do Escopo

Esta etapa nao deve redesenhar os dashboards, recalcular indicadores, criar novos endpoints, alterar schemas Supabase, trocar regras financeiras, integrar WhatsApp, nem refatorar todos os hooks comerciais. Tambem nao deve corrigir todos os testes antigos do repositorio, exceto quando uma falha for causada diretamente pela mudanca desta etapa.

## Rotas Comerciais

As rotas comerciais devem refletir o conjunto funcional do sistema geral:

- `/comercial/dashboard`: dashboard principal, atualmente baseado em `MetasVendedoresPage`;
- `/comercial/clientes`: analise de clientes, atualmente `ClientesAnalysePage`;
- `/comercial/produtos`: produtos, categorias e top produtos;
- `/comercial/marcas`: marcas e composicao de vendas;
- `/comercial/comissao`: comissao de vendedores, mantendo regras Pelegrini;
- `/comercial/metas-diarias`: metas e acompanhamento diario, usando a pagina existente;
- `/comercial/queda-clientes`: analise de queda de clientes, usando a pagina existente se estiver funcional;
- `/comercial/autenticacao`: autenticacao de pedidos, usando a pagina existente se estiver funcional para Pelegrini.

Rotas como `/comercial/progresso-vendedor` podem continuar redirecionando se nao houver pagina final correspondente no sistema geral atual.

## Navegacao

O menu desktop deve apresentar as principais funcionalidades comerciais liberadas:

- Dashboard;
- Clientes;
- Produtos;
- Marcas;
- Comissao;
- Metas Diarias;
- Queda de Clientes;
- Autenticacao de Pedidos, se a pagina for considerada pronta para uso.

O menu mobile deve acompanhar a mesma intencao dentro do espaco disponivel. Se o bottom nav nao comportar todas as entradas, ele deve manter as mais usadas e oferecer acesso ao restante por uma lista/menu interno existente ou a ser planejado em etapa propria.

O rodape do menu comercial deve deixar de usar "BI Reports" como marca principal e deve usar Pelegrini ou texto neutro do modulo.

## Regras Pelegrini

Devem ser preservadas as regras ja existentes para `1004` e `10041`, incluindo:

- selecao de filial antes de entrar no Comercial quando a empresa possuir filiais;
- Casa da Transmissao e Casa da Chevrolet como contextos separados;
- filtros especificos de vendedores/equipes;
- regras de Forca P;
- regras de receita, devolucao e data de faturamento Pelegrini;
- variantes premium/legacy ja decididas pelo codigo atual;
- regra de comissao restrita a Pelegrini quando aplicada hoje por `RequirePelegrini`.

Se uma regra parecer antiga ou conflitante, a implementacao deve primeiro preservar o comportamento atual e registrar a duvida para uma etapa futura, em vez de remover silenciosamente.

## Dados e Integracoes

Esta etapa deve continuar usando os hooks existentes:

- `useComercialData`;
- `useComercialProdutos`;
- `useComissaoVendedores`;
- `useMetasVendedores`;
- `useVendedores`;
- `useEmpresaAtiva`;
- `useEmpresaConfig`;
- `useUserModulePermissions`;
- `useFilialSelecionada`.

Nao criar nova fonte de dados. O modulo deve continuar usando as configuracoes de empresa, endpoints, VPS intermediaria, Supabase e JSON paths ja existentes no sistema geral.

## Erros e Estados Vazios

As paginas comerciais devem manter seus estados atuais de loading, erro e vazio. Se uma rota for reativada e a pagina existente tiver comportamento ruim sem dados, a correcao deve ser limitada a essa rota e documentada no plano.

Se o usuario nao tiver acesso ao modulo Comercial, `RequireModule` deve continuar bloqueando. Se entrar sem filial em empresa com filiais, `ComercialLayout` deve continuar exibindo o seletor/bloqueio de filial.

## Testes e Verificacao

A etapa deve ser validada com:

- teste focado das regras ou configuracoes alteradas;
- build Vite;
- verificacao local das rotas comerciais principais em desktop;
- checagem de que a home Pelegrini ainda entra no Comercial pelo card;
- checagem de que os menus desktop/mobile apontam para rotas existentes;
- se a suite completa continuar falhando por problemas antigos fora da etapa, registrar essas falhas separadamente.

## Criterios de Aceite

- O modulo Comercial Pelegrini usa o layout comercial existente.
- O menu Comercial mostra as principais funcionalidades do sistema geral, sem esconder rotas ja prontas por redirecionamento indevido.
- As paginas comerciais reativadas carregam dentro do `ComercialLayout`.
- Regras de empresa, filial, permissao e Pelegrini 1004/10041 sao preservadas.
- Nenhum schema Supabase e criado ou alterado.
- A home Pelegrini continua funcionando.
- O projeto compila.

## Etapas Futuras

Depois desta etapa, criar specs separadas para:

- WhatsApp Pelegrini;
- Operacional Pelegrini;
- Financeiro Pelegrini;
- correcao dos testes antigos de Supabase/ReceitaDetalheDialog;
- autenticacao real e variaveis de ambiente locais;
- acabamento visual Pelegrini em todos os sidebars e headers.
