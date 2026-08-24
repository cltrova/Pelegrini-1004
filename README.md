# Rsys Cliente 1004 - Pelegrini

Projeto dedicado ao cliente Pelegrini (`1004` e `10041`), mantido via Codex + GitHub.

Este projeto foi extraido do sistema geral mantendo os dados, layouts e logicas da Pelegrini, sem depender do Lovable para desenvolvimento, build ou publicacao.

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

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
