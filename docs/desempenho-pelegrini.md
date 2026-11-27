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

- Todas as medições confirmadas de Dashboard e Produtos acima ainda excedem 3 s. O histórico completo com dados reais, as demais abas e os demais perfis continuam com aceite pendente.
- Integrar ao navegador os cálculos de tela, filtros completos e exportações da base preparada. Conferir cada perfil no portal autenticado. A homologação de Produtos descrita abaixo usa a origem real.
- Medir novamente as telas oficiais após autorização de publicação.

Os testes do piloto rodam com `python -m unittest discover -s services/relatorios`. A carga de homologação recebe JSONL conferido na origem, com os campos `filial`, `dia`, `pedido`, `vendedor`, `valor` e `original`, pelo comando `carregar.py`, junto com o horário UTC efetivo da leitura. Execute a carga de arquivo em uma base que o servidor ainda vá abrir. `medir.py` gera seu próprio conjunto sintético, publica novas versões no mesmo processo do servidor e mede as consultas.

Os testes focados passaram com 100 casos no frontend e 7 no piloto. A suíte geral registrou 50 falhas na execução desta rodada. A execução da base inicial já registrava 51.

## Produtos em homologação no VPS

A branch local passou a usar como base a revisão `f408685`, publicada como `2.9.8` no site oficial. Em uma abertura fria em que a Casa do Chevrolet estava selecionada, a tela de Produtos oficial ficou utilizável em 25,85 s. Três aberturas do candidato com a mesma API levaram 14,89 s, 9,81 s e 9,16 s. O candidato monta a lista de vendedores ao abrir os filtros e evita baixar pedidos para montar a tela inicial. A consulta de Produtos caiu de quatro para duas requisições e de aproximadamente 2,22 MB para 0,99 MB transferidos.

Uma segunda comparação no navegador usou o mesmo período e uma assinatura do texto dos indicadores. Ao aproveitar uma página maior da API atual, os indicadores se mantiveram iguais, as duas consultas de Produtos viraram uma e a abertura passou de 10,20 s para 7,72 s nas duas medições. A transferência permaneceu próxima de 0,99 MB. Esses testes usaram a sessão Master e a API atual do site.

### Rastreamento e carga

O Change Tracking foi ativado com aprovação explícita em `RSYS2003_CT` e `RSYS2003_PELEGRINI`, com retenção de dois dias e limpeza automática. O rastreamento por coluna ficou desabilitado. As 12 tabelas são `NotasFiscais`, `MovEstoque`, `MovEstoqueImposto`, `Pedidos`, `Operacoes`, `Entidades`, `Produtos`, `Grupos`, `Vendedores`, `Cidades`, `Marcas` e `Empresas`.

O serviço `PelegriniRelatoriosTunel` do Windows se conecta ao VPS com chave própria e host fixado. A porta `15007` do VPS se limita a `127.0.0.1` e leva ao SQL Server interno. A leitura de produção usa a credencial criptografada já existente e o modo de conexão somente leitura. O VPS validou a consulta das versões de Change Tracking nos dois bancos pelo novo túnel.

A implementação usa o bloco de seleção de `sp_api_produto` de cada empresa, valida a assinatura da definição, restringe a filial e aplica as exclusões de Força P na origem. A Chevrolet também aplica o recorte de serviços usado em Produtos. A carga em DuckDB grava cada lote e o próximo intervalo na mesma transação. Ao final, o sincronizador reconsulta os documentos afetados desde a versão inicial. Ele usa a chave anterior e a atual para movimentos transferidos ou excluídos. Se uma restauração ou perda de retenção invalidar a versão, a atualização fica pendente de uma nova carga.

### Serviço e evidências

`pelegrini-relatorios-carga.service` carrega as bases com até duas leituras simultâneas, retoma os lotes confirmados e dispara a medição após concluir as duas empresas. O estado fica em `/var/lib/pelegrini-relatorios-homologacao`. A consulta interna e o gateway ficam em `127.0.0.1:8328` e `127.0.0.1:8329`. A consulta abre cada base quando a carga e a primeira reconciliação estiverem confirmadas. A Transmissão já sincroniza e responde enquanto a carga da Chevrolet é executada. O gateway confere a sessão do portal, o perfil e a filial. Sem sessão, o gateway respondeu `401`. Os testes automatizados de autorização exercitam Master, Gerencial e Vendedor, incluindo filial indevida.

A API de Produtos calcula totais sobre o recorte inteiro, entrega rankings e pagina os detalhes por versão. Os totais e rankings de todo o histórico são preparados em disco na mesma gravação do lote incremental. A API envia a hora UTC da leitura e a versão servida, e devolve `503` quando a base está incompleta ou a leitura atingiu 60 segundos. A sessão do portal oficial ainda usa a API legada. A paridade das métricas finais da interface, a troca da fonte no navegador, as exportações e demais telas e perfis fazem parte do aceite pendente.

Na amostra real de 24 a 26/11 pelo novo túnel, as contagens e o total líquido coincidiram com a mesma seleção na origem. Foram 493 linhas da Transmissão e 1.159 da Chevrolet. A publicação das amostras ocorreu com 4,70 s e 5,54 s de idade, respectivamente. As consultas em disco levaram 9,3 ms e 11,7 ms. A leitura incremental encontrou 32 e 111 chaves modificadas desde as versões consultadas no primeiro teste do túnel.

A Transmissão concluiu a carga integral com 916.939 linhas. Após a reconciliação pelo Change Tracking, dois recortes reais coincidiram em contagem, quantidade, venda, devolução, líquido e custo. São 371 linhas de 01 a 05/11/2019 e 493 linhas de 24 a 26/11/2026. As leituras em disco por API ficaram em 48,8 e 19,6 ms. As respectivas comparações no SQL Server levaram 1,51 e 1,10 s.

Em uma rodada de todo o histórico da Transmissão, os máximos da API interna foram 45,6 ms com 1 acesso, 234,3 ms com 5 e 357,7 ms com 10. A maior idade foi de 8,46 s e a resposta gzip de 50 linhas teve cerca de 8,9 KB. O processo atingiu 210 MiB de RSS. Em outra rodada de 72 s, com a carga real da Chevrolet em paralelo, a Transmissão respondeu a 26 consultas, com máximo de 1,09 s e idade de até 18,15 s. A Chevrolet retornou `503` durante a carga incompleta, conforme esperado.

Durante essa fase, o arquivo da Transmissão ocupava 348 MiB. Em uma amostra simultânea, carga, API interna e gateway usavam aproximadamente 534 MiB de RAM somados. Os picos individuais acumulados naquele momento foram 429 MiB, 148 MiB e 36 MiB. O uso durante a operação integral das duas bases ainda precisa ser medido.

Um teste com 900 mil itens sintéticos no VPS, antes da preparação dos agregados, registrou máximos de 213 ms, 495 ms e 2,105 s com 1, 5 e 10 chamadas simultâneas. A RAM do processo ficou em 370 MiB em repouso, atingiu pico de 383 MiB e os arquivos ocuparam 110,6 MiB. São tempos da API interna. Em SQL Server isolado, foi exercitada uma carga seguida de mudança de nota, exclusão de item e imposto e alterações em marca e vendedor.

Com os agregados em disco e o mesmo volume sintético, os máximos da API interna foram 79 ms com 1 chamada, 206 ms com 5 e 456 ms com 10. O máximo com 10 chamadas e gravações simultâneas nos dois arquivos foi 545 ms. As gravações levaram 546 e 584 ms. O processo ocupou 277 MiB em repouso e atingiu 390 MiB. Os arquivos ocuparam 109,8 MiB e a maior resposta gzip teve 2,5 KB com 50 itens detalhados. O teste usou limite de 1,5 GiB e cota de 1,25 vCPU. Em homologação, a sincronização das duas empresas é sequencial para limitar a carga no SQL Server.

A amostragem no SQL Server durante a carga registrou espera por leitura de disco (`PAGEIOLATCH_SH`, `IO_COMPLETION`) e envio do resultado (`ASYNC_NETWORK_IO`). Uma consulta amostrada tinha acumulado 624 ms de CPU para 6.001 ms decorridos e 105.178 leituras lógicas. A carga usa lotes retomáveis para limitar o tempo de cada transação de leitura.

### Demais telas na revisão 2.9.8

Uma abertura fria por tela foi medida no Chromium autenticado com o perfil Master e a Chevrolet selecionada. Visitas no Comercial ficou utilizável em 7,75 s e Produtividade em 14,55 s. A resposta de Produtividade levou 11,48 s. Na DRE, a captura carregou o arquivo de dados de cerca de 721 KB e não confirmou prontidão em 23,03 s. Cliente, Comissão, Cotações, Vendas perdidas, Estoque retroativo, Giro, DRE e Variação seguem com aceite de desempenho pendente. A camada de origem continua sendo a API oficial nesses fluxos. A idade da origem não foi aferida nas respostas oficiais medidas.

O candidato inicia o download do módulo principal em paralelo com a consulta que identifica a sessão do visitador. O redirecionamento continua sendo decidido antes de montar o portal. Estoque começa a carregar o componente da aba ativa enquanto aguarda os dados da API.

Na abertura fria de Estoque, o oficial ficou utilizável em 12,29 s e o candidato em 4,06 s, com uma medição de cada. O pedido de dados levou 7,36 s no oficial e 0,74 s no candidato. O código do gráfico começou a carregar junto da requisição de dados no candidato. No oficial, carregou depois da resposta. A variação do tempo de resposta da API impede atribuir toda a diferença ao frontend.
