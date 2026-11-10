# Estoque: filtros por coluna R15 — 10/11/2026

## Resultado

Publicada a web **2.7.2**, com filtros nos cabeçalhos e faixa de controles no celular. Padrão Grupo → Marca → Produto. Seleções múltiplas e limites/datas são enviados à API, antes da paginação; marca depende do grupo. O resultado vazio conserva cabeçalhos e ações de limpeza. Exportação explicitamente limitada à página, preservando R11.

API verificada: `pelegrini-estoque-colunas-20261109-r15`. Consolidado deduplica produtos e utiliza quantidade_consolidada, valor_estoque_consolidado e custo_medio_consolidado uma única vez. Situação vem da API; não usar Giro em cache como fallback de uma página filtrada que falhou. Falha de capacidades bloqueia a consulta, e repetir consulta refaz primeiro a leitura das capacidades.

## Proveniência e publicação

- Base da versão anterior publicada: `50effcd7a0cd11e21a592463b2902d89bcb21d50` (2.7.1). A branch c0de276 não foi publicada inteira, pois diverge das mudanças mais recentes de produtividade/login/e-commerce.
- Snapshot completo usado no build: `tmp/stock-r15-release-source`, gerado por `git archive` da base e aplicação explícita de 20 arquivos desta tarefa. Lista e hashes em `stock-filter-source.json` desse snapshot.
- SHA256 da lista de fontes: `b2b71894fdc63cec4f956423a87d60efad10c29eece5ad59c95d96dd0c24edc6`.
- Manifesto registra commit nulo, sourceBase e change=stock-column-filters-r15, evitando atribuição falsa ao HEAD antigo do workspace.
- Imagem: `pelegrini-web:stock-filters-r15-b2b71894fdc6`.
- ID da imagem: `sha256:b8812ef045b44ff923b3e88c501e7731406d0a37bdfb2645051c382e880a192d`.
- Entrada JS: `/assets/index-BWppHvS2.js`.
- Chunk estoque: `/assets/EstoquePage-D2Iy7ANC.js`.
- Serviço saudável e versão 2.7.2 confirmada no navegador, nas duas filiais.

### Montagem estática importante

O compose possui uma montagem somente leitura em `/usr/share/nginx/html`. Trocar a imagem isoladamente não troca os arquivos servidos. A primeira troca de imagem passou pelo smoke, mas a conferência no navegador detectou que a montagem ainda apontava para o conteúdo 2.7.1. O apontamento foi corrigido e verificado por HTTP dentro do serviço e pela tela pública.

Conteúdo ativo: `/docker/pelegrini-web-vps/build-stock-r15-b2b71894fdc6/web-dist`.

A configuração nginx da produtividade foi preservada em `/docker/pelegrini-web-vps/build-produtividade-50effcd/deploy/produtividade/site.conf`.

Para economizar espaço, os arquivos estáticos imutáveis anteriores foram reutilizados por hardlink em um diretório novo; cada arquivo alterado foi desvinculado ANTES da cópia. Os hashes do índice e do manifesto anteriores foram preservados. **Não editar arquivos compartilhados in-place em publicações futuras.** Criar outro diretório e substituir cada caminho alterado atomicamente, preservando rollback.

Backups do compose:

- Antes da troca de imagem: `/var/backups/pelegrini-mercadolivre-api/stock-filters-r15-web-20261110T112336Z/web-compose.yml`.
- Antes da troca da montagem: `/var/backups/pelegrini-mercadolivre-api/stock-filters-r15-content-20261110T112648Z/web-compose.yml`.

Não foram alterados API, banco, tokens, permissões, DNS ou código do e-commerce/produtividade do snapshot publicado. Nenhum código foi enviado ao GitHub. Os logs já estavam abaixo dos 200 MB autorizados; nenhum log foi apagado. O pacote de 4,7 MB foi publicado sem build Node na VPS, com espaço mínimo medido e reserva.

## Validação

- 115 testes selecionados, em 12 arquivos, passaram no snapshot efetivamente compilado (incluindo produtividade).
- Lint dos arquivos alterados: zero erros; duas advertências preexistentes de Fast Refresh na tabela.
- Build Vite passou. A checagem TypeScript global continua com erros preexistentes fora dos arquivos desta tarefa; não foi declarada uma checagem global limpa.
- Revisão independente encontrou retry de capacidades e fallback indevido de Giro. Ambos corrigidos; regressão do fallback observada falhando antes da correção e passando depois.
- Navegador: Chevrolet com 56.529 produtos consolidados, grupo SPICER, marcas por grupo, combinação grupo/marca/quantidade, detalhado apenas origens 2/3, limite sem resultados e limpeza acessível; Transmissão com grupo ZF PESADO e marca ZF (996 produtos no momento da conferência). Paginação global preservada.
- Layout móvel 390×844: faixa de filtros e popover de 320 px dentro da viewport. Override de viewport removido ao concluir.
- Captura: `tmp/filtros-estoque-publicados-2.7.2.png`.

Scripts locais de publicação e comparação estão em `tmp/prepare-stock-r15-*.cjs`, `tmp/build-stock-r15.cjs`, `tmp/publish-stock-r15.py` e `tmp/publish-stock-r15-content.py`. Os dois últimos exigem os estados e caminhos específicos desta publicação; não reutilizar sem reler a configuração atual.
