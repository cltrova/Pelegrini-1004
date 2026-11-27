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

Na revisão oficial da Chevrolet, a volta à Visão geral levou 0,33 s em uma sessão com dados já carregados. As tentativas de abrir Comparativos e Metas aguardaram 19,29 s e 23,84 s, respectivamente, sem confirmação de prontidão. Ao selecionar Ano completo, o botão Buscar ficou desabilitado enquanto as opções de vendedores carregavam. O candidato permite enviar o período durante a consulta das opções. O relatório anual e o recorte integral ainda precisam de medição com dados completos.

## Origem e capacidade

Os catálogos de `RSYS2003_CT` e `RSYS2003_PELEGRINI` mostraram `SNAPSHOT` ativo e Change Tracking e CDC desativados. `MovEstoque` tinha aproximadamente 2,12 milhões e 5,38 milhões de registros, respectivamente. A chamada da procedure de perdas na Chevrolet levou cerca de 2,08 s para retornar zero linhas em novembro e atingiu o limite do teste de 22 s no recorte integral. A segunda medida é um limite inferior para a duração dessa leitura.

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
- Validar uma fonte incremental com todas as dependências e exclusões ou demonstrar uma leitura completa que sustente a janela de atualização. A preparação inicial do piloto foi exercitada com dados sintéticos. A integração com a sessão do portal, os filtros completos, as exportações e a paridade com a origem ainda precisam de validação.
- Medir novamente as telas oficiais após autorização de publicação. O piloto executado no VPS foi temporário. A publicação do portal e a configuração do RSYS seguem fora desta execução.

Os testes do piloto rodam com `python -m unittest discover -s services/relatorios`. A carga de homologação recebe JSONL conferido na origem, com os campos `filial`, `dia`, `pedido`, `vendedor`, `valor` e `original`, pelo comando `carregar.py`, junto com o horário UTC efetivo da leitura. Execute a carga de arquivo em uma base que o servidor ainda vá abrir. `medir.py` gera seu próprio conjunto sintético, publica novas versões no mesmo processo do servidor e mede as consultas.

Os testes focados passaram com 100 casos no frontend e 7 no piloto. A suíte geral registrou 50 falhas na execução desta rodada. A execução da base inicial já registrava 51.
