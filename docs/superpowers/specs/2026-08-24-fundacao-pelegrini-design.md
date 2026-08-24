# Fundacao Pelegrini

## Contexto

O repositorio atual contem uma aplicacao React/Vite com modulos ja estruturados para WhatsApp, Comercial, Operacional e Financeiro. A base tambem carrega nomes, rotas e regras herdadas de Rsys, Outlet360 e cliente 1004. O objetivo agora e criar o projeto Pelegrini como uma experiencia nova dentro deste repositorio, aproveitando a estrutura tecnica existente sem apresentar o produto como uma simples troca de nome.

Esta primeira etapa cria a fundacao visual e navegacional do Pelegrini. Ela deve deixar o sistema reconhecivel como "Pelegrini", com entrada propria e quatro modulos principais prontos para evolucao em etapas seguintes.

## Objetivo

Criar a primeira versao da camada de produto Pelegrini:

- ativar uma tela inicial executiva como entrada oficial do app;
- apresentar os quatro modulos principais: WhatsApp, Comercial, Operacional e Financeiro;
- aplicar nomenclatura Pelegrini nos pontos visiveis da home;
- preservar os layouts e funcionalidades internas existentes dos modulos;
- reduzir a exposicao de textos genericos como "BI Reports" na entrada;
- manter o trabalho pequeno o suficiente para ser implementado e validado em uma entrega.

## Fora do Escopo

Esta etapa nao vai redesenhar todos os modulos internos, remover toda regra antiga de cliente 1004, trocar banco de dados, alterar permissoes profundas, integrar novas APIs ou reescrever paginas comerciais/financeiras existentes. Essas mudancas devem virar etapas separadas.

## Arquitetura Proposta

A rota raiz `/` deve deixar de redirecionar diretamente para `/comercial/dashboard` e passar a renderizar a HomePage desktop/mobile como porta de entrada do Pelegrini.

A HomePage deve continuar usando os mecanismos existentes de autenticacao, permissao de modulo, seletor de empresa para master e seletor de filial quando necessario. Isso evita quebrar fluxos sensiveis ja presentes no sistema.

Os layouts internos permanecem como estao:

- `/whatsapp` usa `WhatsappLayout`;
- `/comercial` usa `ComercialLayout`;
- `/operacional` usa `OperacionalLayout`;
- `/financeiro` usa `FinanceiroLayout`.

A fundacao Pelegrini deve ser uma camada acima desses modulos, nao uma reescrita deles.

## Experiencia da Home

A tela inicial deve exibir o nome "Pelegrini" como marca principal. O texto de apoio deve comunicar um painel de gestao com quatro areas, evitando linguagem generica demais.

Os quatro cards de modulo devem permanecer como atalhos principais:

- WhatsApp: atendimento, conversas e automacoes;
- Comercial: vendas, metas, clientes e performance;
- Operacional: estoque, giro e indicadores operacionais;
- Financeiro: resumo, DRE, variacao, duplicatas e cobranca.

O estado de login deve continuar funcionando:

- usuario visitante ve os modulos, mas precisa autenticar para acessar;
- usuario autenticado ve apenas modulos liberados;
- usuario master pode selecionar empresa antes de entrar;
- vendedor autenticado pode continuar sendo direcionado ao WhatsApp, se essa regra ja existir e continuar sendo desejada pelo codigo atual.

## Identidade Visual

A identidade inicial deve ser sobria e operacional. A aplicacao e um painel de trabalho, entao a interface deve priorizar leitura, organizacao e acesso rapido aos modulos. A primeira etapa pode reaproveitar a paleta e componentes atuais, mas deve substituir a marca visivel da home por Pelegrini.

Textos-alvo da home:

- marca: "Pelegrini";
- subtitulo curto: "Painel modular de gestao";
- chamada principal: algo equivalente a "Acompanhe operacao, vendas, financeiro e atendimento em um so lugar";
- rodape: referencia a Pelegrini, sem "BI Reports" como marca principal.

## Dados e Estado

Esta etapa nao cria novos schemas ou migracoes Supabase. O app deve continuar usando os hooks e contexts existentes:

- `AuthContext`;
- `EmpresaSelecionadaContext`;
- `FilialSelecionadaContext`;
- `useEmpresaConfig`;
- `useUserModulePermissions`.

Como os dados reais dos modulos serao tratados em etapas futuras, a home deve funcionar mesmo quando algum modulo ainda depender de regras herdadas.

## Erros e Permissoes

A implementacao deve preservar os guards atuais:

- `RequireModule` para controle de modulo;
- `RequireRole` para areas administrativas;
- `RequirePelegrini` onde hoje ha regra especifica para empresas 1004/10041.

Se algum usuario nao tiver acesso a um modulo, a home deve manter o comportamento atual de mostrar detalhes ou bloquear acesso conforme a logica existente.

## Testes e Verificacao

A entrega deve ser validada com:

- build TypeScript/Vite;
- testes existentes que forem relevantes e rapidos;
- verificacao visual local da home em desktop;
- checagem de que `/`, `/whatsapp`, `/comercial/dashboard`, `/operacional/estoque` e `/financeiro` continuam roteando sem erro de compilacao.

## Criterios de Aceite

- `/` abre a home Pelegrini, nao redireciona direto para Comercial.
- A home mostra "Pelegrini" como marca principal.
- Os quatro modulos aparecem como entradas principais.
- O fluxo de clique em modulo preserva permissoes, selecao de empresa e selecao de filial.
- Nenhuma funcionalidade interna dos modulos e removida nesta etapa.
- O projeto compila.

## Etapas Futuras

Apos esta fundacao, as proximas specs devem tratar cada modulo separadamente:

- WhatsApp Pelegrini;
- Comercial Pelegrini;
- Operacional Pelegrini;
- Financeiro Pelegrini;
- permissoes, usuarios e acabamento final.
