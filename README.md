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

Para o frontend local, copie `.env.example` para `.env.local` e preencha as variáveis que o portal usa no navegador.

Variaveis principais:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Inteligência artificial

As funções de IA servidas por `/api/ia/` usam a chave `OPENAI_API_KEY` no backend da Pelegrini. Essa variável fica no arquivo de ambiente do serviço.

Para rodar localmente com Node.js 24.12 ou superior, use um arquivo `.env.ai.local` e execute:

```sh
node --env-file=.env.ai.local services/ia/server.ts
```

O arquivo de ambiente precisa de `OPENAI_API_KEY`, `PORTAL_AUTH_URL` e `PORTAL_PUBLIC_KEY`. Os dois valores do portal correspondem ao endereço e à chave pública que o login atual já usa. O Vite encaminha `/api/ia/` para `127.0.0.1:4319` por padrão.

Na VPS, o `deploy/ia/compose.yml` lê `OPENAI_API_KEY` de `/etc/pelegrini/ia/openai.env`. Restrinja o arquivo aos administradores do servidor. Guarde `PORTAL_AUTH_URL` e `PORTAL_PUBLIC_KEY` em `/etc/pelegrini/ia/portal.env`. O serviço usa a rede Docker privada do site e recebe as chamadas do proxy HTTPS configurado em `deploy/produtividade/site.conf`.

Para cadastrar a chave pela primeira vez em uma máquina com acesso SSH ao servidor, execute `pwsh -File deploy/ia/configurar-chave.ps1`. A chave é solicitada com entrada oculta.

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
