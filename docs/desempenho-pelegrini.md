# Desempenho da Pelegrini em 27/11/2026

A base do trabalho é a revisão oficial `05c01cf` (versão `2.9.7`). O candidato fica na branch local `codex/pelegrini-performance`. Os testes do candidato carregaram o build local em uma aba dedicada do Chromium autenticado, mantendo a API oficial. O cache HTTP e o service worker foram desativados durante cada abertura fria.

## Navegador autenticado

| Empresa | Tela | Perfil | Medições por versão | Oficial, faixa e mediana | Candidato, faixa e mediana |
|---|---|---|---:|---|---|
| Casa do Chevrolet 10041 | Dashboard Comercial, Visão geral | Master | 5 | 27,60 a 42,62 s · 34,89 s | 11,52 a 13,31 s · 12,10 s |
| Casa da Transmissão 1004 | Dashboard Comercial, Visão geral | Master | 3 | 8,71 a 9,40 s · 8,88 s | 5,20 a 6,86 s · 5,90 s |
| Casa do Chevrolet 10041 | Comercial, Produtos | Master | 1 | 17,30 s | 9,38 s |

O navegador aguardou os indicadores visíveis em cada tela. As capturas preservadas ficam nos arquivos JSONL internos de `.superpowers/performance`. O medidor `scripts/performance/browser.mjs` registra espera pelo primeiro byte, transferência, tamanho recebido, estado do cache e métricas da thread principal. `Server-Timing` interno e `X-Data-As-Of` estavam ausentes nas chamadas comerciais, então o tempo de SQL e a idade da origem permanecem sem atribuição exata nessas telas.

No Dashboard da Chevrolet, a leitura de itens chegou a oito requisições e 4,42 MB transferidos em uma abertura. O candidato usou duas requisições e cerca de 0,99 MB. As respostas oficiais já usavam gzip. O tempo de espera pela primeira parte de uma resposta de produtos chegou a 4,33 s no candidato.

O candidato consulta o período inicial imediatamente, compartilha a leitura de produtos entre filtros que só mudam os cálculos locais e normaliza os nomes de vendedores uma vez por comparação. Na DRE, o arquivo local de demonstração de 6,78 MB deixou de ser dependência estática da rota e passa a carregar quando a fonte local é usada. A geração diária dos insights de IA mantém a cadência existente.

Na revisão oficial da Chevrolet, a volta à Visão geral levou 0,33 s em uma sessão com dados já carregados. As tentativas de abrir Comparativos e Metas aguardaram 19,29 s e 23,84 s, respectivamente, sem confirmação de prontidão. Ao selecionar Ano completo, o botão Buscar ficou desabilitado enquanto as opções de vendedores carregavam. O clique no candidato iniciou a consulta anual. Após quatro segundos, ainda havia duas chamadas de produtos e duas de pedidos pendentes. O relatório anual e o recorte integral ainda precisam de medição com dados completos.

## Origem e capacidade

Na medição inicial, `RSYS2003_CT` e `RSYS2003_PELEGRINI` tinham `SNAPSHOT` ativo, com Change Tracking e CDC desativados. `MovEstoque` tinha aproximadamente 2,12 milhões e 5,38 milhões de registros, respectivamente. A chamada da procedure de perdas na Chevrolet levou cerca de 2,08 s para retornar zero linhas em novembro e atingiu o limite do teste de 22 s no recorte integral. A segunda medida é um limite inferior para a duração dessa leitura.

O piloto `services/relatorios` usa DuckDB em disco, um arquivo por empresa e publicação transacional de uma leitura completa. A API interna aceita período, página e versão, calcula contagens e ranking sobre o recorte inteiro e envia `X-Data-As-Of` e `X-Data-Version`. Ao atingir 60 segundos devolve `503 DATA_UNAVAILABLE`. A troca de versão durante a paginação devolve `409 VERSION_CHANGED`. O gateway responsável por expor a rota deverá validar a sessão e o escopo antes de chamá-la. O serviço escuta apenas em loopback e requer o segredo do gateway.

Teste isolado no VPS compartilhado com 10 mil registros sintéticos por empresa, limite de 1,5 GiB e cota de 1,5 vCPU. A API respondeu a 208 consultas no total.

| Cenário | Maior resposta HTTP | Maior idade simulada | Pico de RAM do processo |
|---|---:|---:|---:|
| 1 usuário | 98 ms | 0,40 s | 96 MiB |
| 5 usuários | 68 ms | 0,71 s | 128 MiB |
| 10 usuários | 188 ms | 1,29 s | 146 MiB |
| 10 usuários e duas atualizações simultâneas | 375 ms | 1,78 s | 166 MiB |

A RAM em repouso após a carga foi de 85 MiB. O disco passou de 1,62 MiB para um pico amostrado de 3,40 MiB. O teste consumiu 3,04 segundos de CPU em 2,93 segundos de execução. São medições da API interna com dados sintéticos. O pico de memória informado pelo processo é comparável apenas a medições com metodologia equivalente.

## Pendências de aceite

- As medições de Dashboard acima excederam 3 s. Produtos tem uma rodada posterior com a base preparada, documentada abaixo.
- Validar as demais telas e o tempo de navegação dos outros perfis. A homologação de Produtos usa dados reais e sessão Master no navegador.
- Medir novamente as telas oficiais após autorização de publicação.

Os testes do piloto rodam com `python -m unittest discover -s services/relatorios`. A carga de homologação recebe JSONL conferido na origem, com os campos `filial`, `dia`, `pedido`, `vendedor`, `valor` e `original`, pelo comando `carregar.py`, junto com o horário UTC efetivo da leitura. Execute a carga de arquivo em uma base que o servidor ainda vá abrir. `medir.py` gera seu próprio conjunto sintético, publica novas versões no mesmo processo do servidor e mede as consultas.

Os testes focados passaram com 100 casos no frontend e 7 no piloto. A suíte geral registrou 50 falhas na execução desta rodada. A execução da base inicial já registrava 51.

## Produtos em homologação no VPS

A branch local passou a usar como base a revisão `f408685`, publicada como `2.9.8` no site oficial. Em uma abertura fria em que a Casa do Chevrolet estava selecionada, a tela de Produtos oficial ficou utilizável em 25,85 s. Três aberturas do candidato com a mesma API levaram 14,89 s, 9,81 s e 9,16 s. O candidato monta a lista de vendedores ao abrir os filtros e evita baixar pedidos para montar a tela inicial. A consulta de Produtos caiu de quatro para duas requisições e de aproximadamente 2,22 MB para 0,99 MB transferidos.

Uma segunda comparação no navegador usou o mesmo período e uma assinatura do texto dos indicadores. Ao aproveitar uma página maior da API atual, os indicadores se mantiveram iguais, as duas consultas de Produtos viraram uma e a abertura passou de 10,20 s para 7,72 s nas duas medições. A transferência permaneceu próxima de 0,99 MB. Esses testes usaram a sessão Master e a API atual do site.

A página de Produtos também deixou de solicitar comissões. Na medição desse ajuste, a assinatura dos indicadores permaneceu igual e a abertura ficou em 10,49 s, com 5,76 s na única chamada de Produtos. A variação da API entre as medições impediu confirmar ganho adicional no tempo total.

Na medição de troca de abas do candidato na Chevrolet, a primeira abertura ficou em 9,99 s. Depois dela, Top Produtos, Categorias e Resumo NF levaram 0,37 s, 0,19 s e 0,44 s, respectivamente, sem novas requisições de produtos. O período foi o mês corrente.

### Rastreamento e carga

O Change Tracking foi ativado com aprovação explícita em `RSYS2003_CT` e `RSYS2003_PELEGRINI`, com retenção de dois dias e limpeza automática. O rastreamento por coluna ficou desabilitado. As 12 tabelas são `NotasFiscais`, `MovEstoque`, `MovEstoqueImposto`, `Pedidos`, `Operacoes`, `Entidades`, `Produtos`, `Grupos`, `Vendedores`, `Cidades`, `Marcas` e `Empresas`.

O serviço `PelegriniRelatoriosTunel` do Windows se conecta ao VPS com chave própria e host fixado. A porta `15007` do VPS se limita a `127.0.0.1` e leva ao SQL Server interno. A leitura de produção usa a credencial criptografada já existente e o modo de conexão somente leitura. O VPS validou a consulta das versões de Change Tracking nos dois bancos pelo novo túnel.

A implementação usa o bloco de seleção de `sp_api_produto` de cada empresa, valida a assinatura da definição, restringe a filial e aplica as exclusões de Força P na origem. A Chevrolet também aplica o recorte de serviços usado em Produtos. A carga em DuckDB grava cada lote e o próximo intervalo na mesma transação. Ao final, o sincronizador reconsulta os documentos afetados desde a versão inicial. Ele usa a chave anterior e a atual para movimentos transferidos ou excluídos. Se uma restauração ou perda de retenção invalidar a versão, a atualização fica pendente de uma nova carga.

### Serviço e evidências

`pelegrini-relatorios-carga.service` carrega as bases com até duas leituras simultâneas, retoma os lotes confirmados e dispara a medição após concluir as duas empresas. O estado fica em `/var/lib/pelegrini-relatorios-homologacao`. A consulta interna e o gateway ficam em `127.0.0.1:8328` e `127.0.0.1:8329`. A consulta abre cada base quando a carga e a primeira reconciliação estiverem confirmadas. A Transmissão respondeu durante a carga da Chevrolet. O gateway confere a sessão do portal, o perfil e a filial. Sem sessão, o gateway respondeu `401`. Os testes automatizados de autorização exercitam Master, Gerencial e Vendedor, incluindo filial indevida.

A API de Produtos calcula totais sobre o recorte inteiro, entrega rankings e pagina os detalhes por versão. Os totais e rankings de todo o histórico são preparados em disco na mesma gravação do lote incremental. A API envia a hora UTC da leitura e a versão servida, e devolve `503` quando a base está incompleta ou a leitura atingiu 60 segundos. O portal oficial usa a API legada.

Na amostra real de 24 a 26/11 pelo novo túnel, as contagens e o total líquido coincidiram com a mesma seleção na origem. Foram 493 linhas da Transmissão e 1.159 da Chevrolet. A publicação das amostras ocorreu com 4,70 s e 5,54 s de idade, respectivamente. As consultas em disco levaram 9,3 ms e 11,7 ms. A leitura incremental encontrou 32 e 111 chaves modificadas desde as versões consultadas no primeiro teste do túnel.

A Transmissão concluiu a carga integral com 916.939 linhas. Após a reconciliação pelo Change Tracking, dois recortes reais coincidiram em contagem, quantidade, venda, devolução, líquido e custo. São 371 linhas de 01 a 05/11/2019 e 493 linhas de 24 a 26/11/2026. As leituras em disco por API ficaram em 48,8 e 19,6 ms. As respectivas comparações no SQL Server levaram 1,51 e 1,10 s.

Em uma rodada de todo o histórico da Transmissão, os máximos da API interna foram 45,6 ms com 1 acesso, 234,3 ms com 5 e 357,7 ms com 10. A maior idade foi de 8,46 s e a resposta gzip de 50 linhas teve cerca de 8,9 KB. O processo atingiu 210 MiB de RSS. Em outra rodada de 72 s, com a carga real da Chevrolet em paralelo, a Transmissão respondeu a 26 consultas, com máximo de 1,09 s e idade de até 18,15 s. A Chevrolet retornou `503` durante a carga incompleta, conforme esperado.

Ao comparar a mesma página de todo o histórico, o gzip reduziu o corpo da resposta de 52.956 para 8.867 bytes, cerca de 83%. As três chamadas sem compressão levaram de 41 a 97 ms e as três com compressão, de 43 a 57 ms no VPS. A diferença de tempo inclui variação de consulta e serialização.

Durante essa fase, o arquivo da Transmissão ocupava 348 MiB. Em uma amostra simultânea, carga, API interna e gateway usavam aproximadamente 534 MiB de RAM somados. Os picos individuais acumulados naquele momento foram 429 MiB, 148 MiB e 36 MiB.

Em uma fase posterior da carga da Chevrolet, oito amostras ao longo de 28 s registraram entre 943 e 1.016 MiB nos três serviços juntos. Os dois arquivos, incluindo os logs do DuckDB, chegaram a 972 MiB. Os serviços consumiram no total 3,43 s de CPU nessa janela.

Um teste com 900 mil itens sintéticos no VPS, antes da preparação dos agregados, registrou máximos de 213 ms, 495 ms e 2,105 s com 1, 5 e 10 chamadas simultâneas. A RAM do processo ficou em 370 MiB em repouso, atingiu pico de 383 MiB e os arquivos ocuparam 110,6 MiB. São tempos da API interna. Em SQL Server isolado, foi exercitada uma carga seguida de mudança de nota, exclusão de item e imposto e alterações em marca e vendedor.

Com os agregados em disco e o mesmo volume sintético, os máximos da API interna foram 79 ms com 1 chamada, 206 ms com 5 e 456 ms com 10. O máximo com 10 chamadas e gravações simultâneas nos dois arquivos foi 545 ms. As gravações levaram 546 e 584 ms. O processo ocupou 277 MiB em repouso e atingiu 390 MiB. Os arquivos ocuparam 109,8 MiB e a maior resposta gzip teve 2,5 KB com 50 itens detalhados. O teste usou limite de 1,5 GiB e cota de 1,25 vCPU. Em homologação, a sincronização das duas empresas é sequencial para limitar a carga no SQL Server.

A amostragem no SQL Server durante a carga registrou espera por leitura de disco (`PAGEIOLATCH_SH`, `IO_COMPLETION`) e envio do resultado (`ASYNC_NETWORK_IO`). Uma consulta amostrada tinha acumulado 624 ms de CPU para 6.001 ms decorridos e 105.178 leituras lógicas. A carga usa lotes retomáveis para limitar o tempo de cada transação de leitura.

### Aceite da API interna com as duas bases

A Chevrolet concluiu a carga com 2.175.324 linhas. A primeira passagem incremental reconciliou 13 documentos e publicou a versão com 9,11 s de idade. O serviço de carga concluiu com sucesso e disparou a conferência automática. As duas bases ocuparam cerca de 1,07 GiB em disco.

| Empresa | Período em novembro | Linhas | API interna | SQL Server | Idade da leitura |
|---|---|---:|---:|---:|---:|
| Transmissão | 01 a 05/11/2019 | 371 | 31,7 ms | 2,47 s | 5,65 s |
| Transmissão | 24 a 26/11/2026 | 493 | 65,9 ms | 1,61 s | 8,19 s |
| Chevrolet | 01 a 05/11/2019 | 957 | 39,5 ms | 1,69 s | 8,11 s |
| Chevrolet | 24 a 26/11/2026 | 1.159 | 25,4 ms | 1,68 s | 9,82 s |

Os quatro recortes coincidiram em contagem de linhas, quantidade, venda, devolução, líquido e custo. Essa conferência usa a seleção canônica do RSYS.

No histórico integral, a conferência automática mediu até 61,2 ms com um acesso, 262,5 ms com cinco e 394,7 ms com dez acessos simultâneos. Nas duas rodadas com acesso concorrente, foram consultadas ambas as empresas. A maior idade foi de 13,97 s e a maior resposta teve 9.241 bytes com gzip e 50 itens. São medições da API interna no VPS.

Uma segunda rodada com as duas bases ativas e a sincronização em execução completou 51 consultas ao histórico, em grupos de até dez. A maior resposta foi de 1,12 s, com dados de até 16,67 s. API interna e gateway usaram até 211 MiB sem consultas e 228 MiB nas amostras durante as consultas. Os picos individuais acumulados foram 223 MiB e 36 MiB. O maior grupo consumiu 0,50 s de CPU. Os arquivos ocuparam 1.095 MiB no disco, incluindo os logs de gravação.

A revisão servida no site oficial ao fim da medição era `f408685` (`2.9.8`).

### Produtos conectado à base preparada

A revisão `9bfced8` foi servida na homologação local com dados do VPS. O Chromium autenticado como Master usou a mesma rota de Produtos nas duas filiais. Nas aberturas frias, o cache HTTP e o service worker ficaram desativados. Para medir o histórico, o navegador aplicou o filtro na interface e o medidor exigiu uma resposta `200` para a empresa, a aba e a página esperadas, sem datas no recorte. A medição terminou com os dados visíveis.

| Cenário no navegador Master | Transmissão | Chevrolet |
|---|---:|---:|
| Abertura fria, mediana de 3 | 1,12 s | 1,42 s |
| Abertura fria, maior de 3 | 1,60 s | 1,47 s |
| Aplicar Todo o histórico | 1,41 s | 1,81 s |
| Top Produtos e segunda página, maior tempo | 0,90 s | 0,99 s |
| Categorias | 0,75 s | 0,76 s |
| Sem Giro | 0,66 s | 0,64 s |
| Resumo NF, segunda página e devoluções, maior tempo | 0,85 s | 0,86 s |
| Abrir detalhes de um produto | 0,82 s | 1,65 s |
| Maior idade da origem ao exibir dados | 17,39 s | 17,96 s |

Na Chevrolet, a assinatura dos indicadores do mês coincidiu com a captura anterior da tela legada. A conferência de 24 a 26/11 comparou os agregados de marcas, as quantidades e receitas do ranking e as contagens de vendas e devoluções com os cálculos da tela anterior sobre as mesmas linhas. Houve correspondência nos cinco cenários, incluindo três filtros de vendedor. Para o histórico integral, o Top Produtos retornou 45.414 códigos na Transmissão e 40.448 na Chevrolet, em páginas de 50. O Resumo NF também entrega páginas de 50 acompanhadas da contagem integral do recorte.

Durante as aberturas frias da revisão final, a solicitação de Produtos começou de 256 a 352 ms após a navegação e durou de 659 a 988 ms. Dentro dessa solicitação, a autenticação do gateway levou de 213 a 552 ms e a consulta local de 51 a 126 ms. Após a resposta, a interface levou de 154 a 427 ms para ficar utilizável, incluindo a espera restante do portal e a renderização. No clique em Todo o histórico, a consulta local de marcas levou de 5,3 a 6,4 ms. O download das respostas medidas levou até 1 ms depois do primeiro byte. O corpo da visão geral da Chevrolet caiu de 131.296 para 36.369 bytes com gzip, uma redução de 72%.

A sincronização continuou em segundo plano. Em 13 ciclos observados de cada filial, o trecho de extração do SQL Server levou até 1,36 s na Transmissão e 1,61 s na Chevrolet. A publicação dos dados ocorreu com idade de até 5,01 s nesses ciclos. A API interna respondeu `409` quando solicitada com versão inválida. No navegador, o avanço simulado de 61 segundos fez a tela ocultar os resultados vencidos e indicar indisponibilidade. A tela voltou a exibir os dados após receber uma leitura atual. O gateway exige a sessão, compara a filial e aplica as permissões do Comercial da empresa e do usuário.

API interna e gateway usavam 316,4 MiB juntos sem consultas. As duas bases e seus arquivos auxiliares ocuparam 1.249,9 MiB em disco. Os resultados abaixo incluem cinco abas, as duas empresas e três rodadas por nível de concorrência.

| Chamadas simultâneas | Leituras concluídas | Maior tempo da API interna | Maior idade | Pico de RAM amostrado | CPU acumulada na rodada |
|---:|---:|---:|---:|---:|---:|
| 1 | 3 | 116 ms | 6,32 s | 316,7 MiB | 0,026 s |
| 5 | 15 | 138 ms | 17,99 s | 342,6 MiB | 0,421 s |
| 10 | 30 | 1,05 s | 9,80 s | 350,1 MiB | 0,892 s |

Passaram 23 testes focados do frontend, 17 do serviço de relatórios e os dois testes do gateway. As duas falhas da suíte visual abrangente também ocorreram na revisão base. O aceite no navegador cobre o perfil Master. A filial indevida, o módulo bloqueado e a resposta vencida foram exercitados no gateway com sessões de teste. Os demais perfis e as outras telas ainda precisam de medição autenticada. A versão `9bfced8` ficou em homologação. O site oficial continuou na `2.9.8`.

### Demais telas na revisão 2.9.8

As medições abaixo usaram Chromium autenticado no perfil Master com a Chevrolet selecionada. A camada de origem continua sendo a API oficial nesses fluxos. A idade da origem não foi aferida nessas respostas.

| Tela e ação | Tempo no navegador | Observação |
|---|---:|---|
| Produtividade, abertura fria | 14,55 s | API 11,48 s |
| Visitas no Comercial, abertura fria | 5,97 s | Listagem HTTP 200 concluída em 1,98 s após a sessão gerencial |
| Clientes, abertura fria | 8,54 s | Pedidos levaram 4,09 s |
| Estoque retroativo, abertura fria do formulário | 2,03 s | A consulta de 26/11 respondeu HTTP 200 em 4,02 s. A captura não comprovou uma tabela preenchida |
| DRE, abertura fria do formulário | 2,50 a 3,39 s | O clique em Buscar retornou uma tela sem resultado para esse cenário |
| Cotações abertas, clique em Aplicar | 23,87 s | Resposta de 343 KB gzip em 10,02 s, com 13,96 s de atividade na thread principal |
| Vendas perdidas, clique em Aplicar | 4,63 s | Consulta do mês respondeu HTTP 200 em 4,60 s |
| Giro, troca de aba a partir de Estoque | Acima de 21,08 s | Requisições de Giro e Estoque consolidado ainda pendentes |

Comissões, Estoque retroativo, Giro, DRE e Variação ainda precisam de aceite com dados exibidos. Em Cotações, a maior parte da espera pela resposta da API foi para o primeiro byte, 9,36 s.

Em Cotações, o candidato monta 50 registros por página. Os indicadores, filtros e exportação usam a lista filtrada integral. Em uma comparação no mesmo Chromium autenticado e no mesmo período, o resultado ficou utilizável em 19,12 s sem paginação e 9,56 s com paginação. A atividade da thread principal foi de 11,31 s e 1,01 s, respectivamente. As respostas tiveram o mesmo tamanho decodificado e os indicadores tiveram a mesma assinatura. A troca para a segunda página levou 0,14 s. A consulta à API legada ainda levou 8,64 s no candidato.

Uma consulta de diagnóstico no SQL Server, com a mesma seleção de Cotações na Chevrolet, confirmou 555 linhas e a soma dos valores de 25 a 26/11. A primeira parte da procedure original levou 2,30 s e a consulta restrita a contagem e soma levou 1,92 s. A consulta restrita a contagem e soma no histórico integral atingiu o limite do teste de 10 s. Ela manteve as condições de filial e de visibilidade da procedure.

Em Vendas perdidas, o catálogo da Chevrolet mostrou 39 linhas em `VendaPerdida`. A projeção consulta também Estoque, Serviços e a visão de preços. Esta última depende de tabelas como `ItemListaPreco` e `Moedas`. Essas dependências ainda estão fora da configuração de Change Tracking de Produtos.

O candidato inicia o download do módulo principal em paralelo com a consulta que identifica a sessão do visitador. O redirecionamento continua sendo decidido antes de montar o portal. Estoque começa a carregar o componente da aba ativa enquanto aguarda os dados da API.

Na abertura fria de Estoque, o oficial ficou utilizável em 12,29 s e o candidato em 4,06 s, com uma medição de cada. O pedido de dados levou 7,36 s no oficial e 0,74 s no candidato. O código do gráfico começou a carregar junto da requisição de dados no candidato. No oficial, carregou depois da resposta. A variação do tempo de resposta da API impede atribuir toda a diferença ao frontend.

No teste do carregamento da sessão, as leituras do perfil e do papel passaram a começar com diferença de até 1 ms. Antes, o papel esperava a consulta do perfil terminar, com diferença de 614 a 952 ms. Nas três aberturas frias do formulário de Comissões por candidato, a maior duração passou de 3,62 para 2,26 s, e a mediana de 2,92 para 2,14 s. A busca de comissões após preencher o formulário tem medição pendente.

Os testes focados deste ciclo passaram com 51 casos de sessão, acesso e Produtos, 16 do serviço de relatórios, 2 do gateway e 2 casos novos de paginação e exportação. A comparação das suítes de Cotações e dos overlays registrou as mesmas 17 falhas preexistentes na base e no candidato.
