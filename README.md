# Rsys Cliente 1004 - Pelegrini

Projeto dedicado ao cliente Pelegrini (`1004` e `10041`), mantido via Codex + GitHub.

Este projeto foi extraido do sistema geral mantendo os dados, layouts e logicas da Pelegrini, com desenvolvimento, build e publicacao pelo fluxo GitHub + Cloudflare.

## Desenvolvimento

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Testes

```sh
npm test
```

## Stack

- Vite
- TypeScript
- React
- shadcn/ui
- Tailwind CSS
- Supabase

## Ambiente

Copie `.env.example` para `.env` e preencha as variaveis do Supabase e de IA.

Variaveis principais:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `AI_GATEWAY_URL`
- `AI_GATEWAY_API_KEY`

## Escopo

- Cliente: Pelegrini
- Filiais: `1004` Casa da Transmissao e `10041` Casa da Chevrolet
- Entrada padrao: `/comercial/dashboard`
- Modulos preservados: Comercial, Operacional, Financeiro conforme permissoes Supabase, WhatsApp e configuracoes

Veja tambem `docs/cliente-1004-dados.md`.

## Publicacao

O projeto publica pela branch principal do GitHub conectada ao Cloudflare Pages.

### Versao da sidebar

Toda compilacao de producao consulta `app-version.json` dos dois dominios e usa a
versao seguinte. A sidebar recebe essa versao na compilacao; clientes com uma aba
antiga continuam vendo a versao do codigo que estao usando. O mesmo `dist` deve
ser publicado no Cloudflare Pages e na VPS para os dois acessos terem a mesma versao.

Os dois ultimos numeros vao de 0 a 15: `2.6.15 -> 2.7.0` e
`2.15.15 -> 3.0.0`. O ponto inicial `2.6.5` considera os 356 commits completos
do GitHub ate `0b36590`, a entrega dos downloads e a entrega do versionamento.
Esse historico nao e um registro de deploys antigos; e a base escolhida para
iniciar o contador de publicacoes.

Use `npm run build` normalmente. Nao recompile entre a publicacao em um dominio
e no outro. Sem uma versao publicada acessivel o build para, evitando repetir
numeros. `PELEGRINI_VERSION_BOOTSTRAP=1` serve exclusivamente para a primeira
publicacao, quando nenhum dos dominios ainda possui o manifesto.
