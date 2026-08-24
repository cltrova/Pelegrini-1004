# Cliente 1004 - Pelegrini

Projeto dedicado ao cliente Pelegrini, separado do sistema geral para ser mantido via Codex + GitHub.

## Codigos Aceitos

- `1004`: Casa da Transmissao
- `10041`: Casa da Chevrolet

Qualquer valor fora de `1004` e `10041` deve cair para `1004` ou ser bloqueado pelas validacoes do projeto dedicado.

## Regras Preservadas

- Dashboard Comercial da Pelegrini.
- Analise de clientes, produtos e marcas.
- Comissao Pelegrini com regras de equipe, vendedores ocultos e marcas tecnicas.
- Tratamento da Casa da Chevrolet (`10041`) em dados comerciais e estoque.
- Regras de Forca P ja existentes no sistema geral.
- Estoque e Estoque Retroativo para Pelegrini.
- Auditorias de suporte ligadas a `1004`, MWM e Eaton.

## Dados e Endpoints

O projeto continua usando Supabase para autenticacao, configuracao de empresas, perfis, permissoes e Edge Functions.

As variaveis devem ser configuradas a partir de `.env.example`. Nao versionar `.env` nem secrets reais.

## IA

As Edge Functions usam:

- `AI_GATEWAY_URL`
- `AI_GATEWAY_API_KEY`
- `OPENAI_API_KEY`

Quando `AI_GATEWAY_API_KEY` nao existir, as functions usam `OPENAI_API_KEY`.

## GitHub

Depois da validacao da pasta, crie um repositorio separado para este cliente a partir da pasta `Rsys-1004`.

Fluxo recomendado:

```sh
git init
git add .
git commit -m "chore: initial cliente 1004 project"
git remote add origin <URL_DO_REPOSITORIO_1004>
git push -u origin main
```
