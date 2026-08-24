# Extracao Cliente 1004 - Design

## Objetivo

Criar um projeto separado para o cliente Pelegrini, preservando o comportamento atual do sistema geral para as duas filiais:

- `1004` - Casa da Transmissao
- `10041` - Casa da Chevrolet

O projeto dedicado deve ser mantido fora do Lovable, usando Codex + GitHub, com uma pasta propria `Rsys-1004/` no workspace e uma copia solta em `C:\Users\Usuario\Downloads\Rsys-1004`.

## Escopo Funcional

O projeto deve preservar todos os dados, layouts e regras especificas da Pelegrini que ja existem no sistema geral:

- Modulo Comercial para `1004` e `10041`.
- Seletor e contexto de filial, pois esse cliente usa duas filiais.
- Regras da Casa da Transmissao e Casa da Chevrolet.
- Comissao da Pelegrini.
- Estoque e Estoque Retroativo.
- Regras de Forca P, vendedores ocultos, filtros Chevrolet, vendedores da Casa da Chevrolet e regras de receita `1004`.
- Dashboards, clientes, produtos, marcas e telas financeiras/operacionais que forem habilitadas para o cliente no cadastro Supabase.

## Isolamento de Cliente

O projeto dedicado deve aceitar somente:

- `cod_empresa_bi=1004`
- `cod_empresa_bi=10041`

Qualquer fluxo herdado de selecao multiempresa deve ser reduzido para esse conjunto. O usuario master pode alternar entre as duas filiais/codigos quando a tela precisar, mas nao deve conseguir selecionar clientes como `1001`, `1002`, `1003`, `1005` ou `MASTER` como empresa ativa do projeto dedicado.

## Remocao do Lovable

O projeto dedicado nao deve depender do Lovable para desenvolvimento, build ou IA.

Remover ou neutralizar:

- `.lovable/`
- dependencias Lovable em `package.json` e `package-lock.json`
- `componentTagger()` no `vite.config.ts`
- metatags Lovable em `index.html`
- `LOVABLE_API_KEY`
- `https://ai.gateway.lovable.dev/v1/chat/completions`

Edge Functions que usam IA devem usar `OPENAI_API_KEY` ou `AI_GATEWAY_URL` + `AI_GATEWAY_API_KEY`.

## Estrutura de Pasta

Criar a pasta fonte:

- `Rsys-1004/`

Depois de validada, criar a copia solta:

- `C:\Users\Usuario\Downloads\Rsys-1004`

Nao copiar para o projeto dedicado:

- `.git/`
- `node_modules/`
- `dist/`
- `.lovable/`
- `.env`
- `.pnpm-store/`
- `.tmp/`
- pastas temporarias fora de escopo

O projeto deve conter `.env.example` com placeholders, nunca secrets reais.

## Limpeza de Escopo

Remover do projeto dedicado functions temporarias ou auditorias claramente ligadas a outros clientes, como `1001`, `1002`, `1003`, `1005` e `MASTER`, quando nao forem parte do funcionamento da Pelegrini.

Manter functions/auditorias de `1004` somente se forem uteis para suporte ou validacao do cliente dedicado. Caso sejam apenas scripts historicos descartaveis, documentar/remover conforme o plano.

## GitHub

O resultado deve ficar pronto para virar um repositorio GitHub separado:

1. Abrir `C:\Users\Usuario\Downloads\Rsys-1004` em um novo chat/projeto Codex.
2. Rodar `npm install`.
3. Configurar `.env` a partir de `.env.example`.
4. Criar repositorio GitHub novo para a Pelegrini.

## Validacao

Antes de considerar concluido:

- Verificar que `Rsys-1004/.env` nao existe.
- Verificar que `Rsys-1004/.lovable` nao existe.
- Verificar que `Rsys-1004/node_modules` nao existe na copia final.
- Buscar referencias executaveis a Lovable.
- Rodar build ou build programatico equivalente.
- Conferir que a pasta solta `C:\Users\Usuario\Downloads\Rsys-1004` existe.
- Conferir que a pasta dedicada inclui as regras `1004` e `10041`.
