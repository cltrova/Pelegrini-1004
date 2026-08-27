# Cotacoes Abertas e Vendas Perdidas 10041 - Design

## Objetivo

Ativar no modulo Comercial do cliente `10041` duas telas operacionais:

- `Cotacoes Abertas`: propostas ainda nao faturadas.
- `Vendas Perdidas`: cotacoes canceladas, recusadas ou vencidas.

As telas devem seguir o layout atual do Comercial, funcionar em desktop e mobile e nao alterar as regras existentes dos demais clientes.

## Escopo da Primeira Versao

A primeira versao sera exclusiva do `cod_empresa_bi=10041` e tera consulta, filtros, exportacao Excel e registro de motivo da perda.

Nao fazem parte desta versao:

- converter cotacao em pedido;
- reabrir cotacao;
- trocar vendedor;
- editar dados comerciais no ERP;
- liberar as telas para outros clientes.

## Navegacao

Adicionar as rotas:

- `/comercial/cotacoes`
- `/comercial/perdidas`

No `ComercialSidebar`, as duas entradas deixam a secao `Em breve` e passam para a navegacao ativa apenas quando a empresa atual for `10041`. Para os demais clientes, as entradas continuam indisponiveis.

No mobile, as telas devem ser acessiveis pela navegacao secundaria do Comercial sem substituir os atalhos principais existentes.

## Fonte de Dados

A base Comercial atual do `10041` contem somente movimentos faturados e nao e suficiente para classificar cotacoes abertas ou perdidas. A implementacao deve consumir fontes dedicadas do ERP, por meio da Edge Function `api-proxy` ja usada no projeto.

Contratos previstos:

- `GET /comercial/cotacoes_abertas_ch`
- `GET /comercial/vendas_perdidas_ch`

Parametros comuns:

- `cod_empresa_bi=10041`
- `data_ini=YYYY-MM-DD`
- `data_fim=YYYY-MM-DD`
- `vendedor` opcional
- `cliente` opcional

Os paths devem ter defaults no frontend, mas aceitar configuracao por empresa quando os campos correspondentes forem adicionados ao cadastro `empresas`.

Se o endpoint estiver indisponivel, a tela deve mostrar erro de integracao. Nao usar dados simulados nem interpretar vendas faturadas como cotacoes.

### Dependencia Externa

Os endpoints acima pertencem ao servidor ERP da Pelegrini e nao sao implementados neste repositorio. A entrega do frontend pode preparar contratos, telas e estados de erro, mas as telas so serao consideradas operacionais quando o responsavel pelo ERP disponibilizar os dois paths com os campos canonicos ou aliases documentados.

Antes de liberar em producao, validar os contratos com uma resposta real do `10041`. Se os nomes de path ou campos reais forem diferentes, atualizar apenas a configuracao e o normalizador, sem alterar o desenho das telas.

## Contrato Canonico

Cada registro sera normalizado para:

- `idCotacao`: identificador estavel da cotacao;
- `numeroCotacao`: numero exibido;
- `dataCotacao`: data de emissao;
- `dataValidade`: validade, quando houver;
- `codCliente` e `nomeCliente`;
- `codVendedor` e `nomeVendedor`;
- `valor`: valor total da cotacao;
- `status`: `aberta`, `cancelada`, `recusada` ou `vencida`;
- `motivoErp`: motivo vindo do ERP, quando existir;
- `diasEmAberto`: calculado pela data atual e pela data da cotacao;
- `raw`: registro original para auditoria tecnica.

O normalizador deve aceitar variacoes de caixa, acento, espaco e underscore nos nomes de campos, seguindo o padrao dos hooks comerciais existentes.

## Tela Cotacoes Abertas

Cabecalho compacto com titulo e acao `Exportar Excel`.

Indicadores:

- quantidade de cotacoes abertas;
- valor total em aberto;
- tempo medio em aberto;
- cotacoes vencidas dentro da lista aberta, quando a fonte sinalizar validade expirada sem encerramento.

Filtros:

- periodo;
- vendedor;
- cliente;
- faixa de dias em aberto;
- busca por numero, cliente ou vendedor.

Tabela:

- cotacao;
- emissao;
- validade;
- cliente;
- vendedor;
- valor;
- dias em aberto;
- status.

Ordenacao inicial: maior quantidade de dias em aberto, seguida da data mais antiga.

## Tela Vendas Perdidas

Cabecalho compacto com titulo e acao `Exportar Excel`.

Indicadores:

- quantidade de vendas perdidas;
- valor total perdido;
- ticket medio perdido;
- motivo mais frequente.

Filtros:

- periodo;
- vendedor;
- cliente;
- status de encerramento;
- motivo da perda;
- busca por numero, cliente ou vendedor.

Tabela:

- cotacao;
- data;
- cliente;
- vendedor;
- valor;
- status;
- motivo da perda;
- acao para cadastrar ou alterar o motivo.

## Motivo da Perda

O motivo informado pelo usuario sera persistido no Supabase, sem escrever no ERP.

Criar a tabela `comercial_motivos_perda` com:

- `id` UUID;
- `cod_empresa_bi` text;
- `id_cotacao` text;
- `motivo` text;
- `observacao` text opcional;
- `created_by` UUID;
- `created_at` timestamptz;
- `updated_at` timestamptz.

Restricoes:

- chave unica em `cod_empresa_bi + id_cotacao`;
- `cod_empresa_bi` limitado ao contexto do usuario;
- leitura e escrita somente para usuarios autenticados autorizados no Comercial;
- RLS habilitado;
- policies devem relacionar `auth.uid()` ao perfil e ao `cod_empresa_bi`, usando dados de autorizacao controlados pela aplicacao;
- `created_by` preenchido com o usuario autenticado;
- alteracoes feitas por `upsert`, preservando a data de criacao.

Motivos iniciais:

- preco;
- prazo de entrega;
- condicao de pagamento;
- concorrencia;
- indisponibilidade de produto;
- cliente desistiu;
- cotacao vencida;
- outro.

Ao escolher `outro`, a observacao passa a ser obrigatoria.

## Exportacao Excel

Cada tela tera um botao visivel `Exportar Excel` com icone de download.

A planilha deve:

- respeitar todos os filtros ativos;
- exportar somente as linhas visiveis no resultado filtrado;
- usar os mesmos nomes de colunas da tabela;
- exportar datas como datas e valores como numeros;
- incluir o motivo da perda consolidado na tela de vendas perdidas;
- usar nomes de arquivo com empresa, tela e periodo.

## Estados e Tratamento de Erros

As duas telas devem contemplar:

- carregamento com skeleton sem deslocar o layout;
- vazio inicial antes da busca;
- nenhum resultado para os filtros;
- erro do endpoint com mensagem clara e opcao de tentar novamente;
- erro ao salvar motivo sem perder o texto digitado;
- confirmacao visual apos salvar;
- desabilitar exportacao quando nao houver linhas.

O `api-proxy` nao deve transformar falhas desses endpoints em lista vazia silenciosa. Erros de origem precisam permanecer distinguiveis de uma consulta valida sem resultados.

## Componentes e Hooks

Separar as responsabilidades em:

- hook de consulta e normalizacao das cotacoes;
- hook de consulta e normalizacao das vendas perdidas;
- hook de leitura e gravacao dos motivos no Supabase;
- barra de filtros compartilhada;
- indicadores de cada tela;
- tabela responsiva compartilhada onde houver estrutura comum;
- dialogo de motivo da perda;
- utilitario de exportacao Excel.

Reutilizar React Query, formatadores, componentes de tabela, filtros e padroes de erro ja existentes. Nao reformular o modulo Comercial.

## Seguranca

- Nunca usar `service_role` no frontend.
- Validar empresa e usuario nas policies, sem confiar em metadados editaveis pelo usuario.
- Nao expor o campo `raw` na interface ou na exportacao.
- Nao permitir escrita de motivo para empresa diferente da empresa ativa.
- Preservar o comportamento atual de autenticacao e permissoes do modulo.

## Testes e Validacao

Cobertura automatizada minima:

- normalizacao dos contratos reais dos dois endpoints;
- classificacao correta de aberta, cancelada, recusada e vencida;
- calculo de dias em aberto;
- filtros e busca;
- indicadores agregados;
- exportacao com os filtros ativos;
- validacao do motivo `outro`;
- gravacao e atualizacao do motivo;
- isolamento do cliente `10041` nas rotas e no menu;
- estados de loading, vazio e erro.

Validacao final:

- executar testes focados e suite relacionada;
- executar build de producao;
- validar desktop e mobile;
- conferir que os endpoints recebem `cod_empresa_bi=10041` e o periodo selecionado;
- confirmar que o Excel abre com tipos e colunas corretos;
- confirmar RLS e isolamento da empresa no Supabase;
- confirmar que nenhuma tela existente foi alterada visual ou funcionalmente.

## Criterios de Aceite

- O cliente `10041` acessa as duas novas rotas pelo menu Comercial.
- Cotacoes abertas exibem somente propostas ainda nao faturadas.
- Vendas perdidas exibem somente cotacoes canceladas, recusadas ou vencidas.
- Os totais correspondem exatamente as linhas filtradas.
- O usuario consegue registrar e alterar o motivo da perda.
- A exportacao Excel corresponde ao resultado filtrado.
- Falha de integracao nao aparece como resultado vazio.
- Outros clientes nao recebem as novas telas nesta versao.
