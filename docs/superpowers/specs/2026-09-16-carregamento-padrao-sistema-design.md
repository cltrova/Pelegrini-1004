# Carregamento Padrao do Sistema

## Objetivo

Padronizar todos os estados visuais de carregamento do sistema com base na gravacao enviada em 16/09/2026: fundo estavel e um arco azul discreto girando no centro da area em processamento, sem textos visiveis, cartoes, skeletons ou mudancas bruscas de layout.

O padrao deve abranger os modulos Comercial, Operacional, Financeiro, WhatsApp e Configuracoes, alem da inicializacao da aplicacao, validacao de autenticacao, permissoes e carregamento preguicoso de rotas.

## Direcao Visual

- Fundo da area permanece com a cor normal da pagina ou painel.
- Indicador formado por um arco circular fino, azul e sem preenchimento.
- Animacao continua, discreta e centralizada.
- Nenhuma mensagem de carregamento fica visivel.
- O texto acessivel continua disponivel por `aria-label` e `role="status"`.
- A animacao e desativada quando o usuario solicita reducao de movimento.
- O componente nao adiciona borda, sombra, cartao ou arredondamento proprio.

## Componente Central

O componente `LoadingState` sera a unica primitiva para carregamentos bloqueantes. Ele tera tres escopos:

### Tela

Usado durante autenticacao, permissao, selecao inicial de empresa e carregamento de rotas. Ocupa a viewport disponivel e centraliza o indicador sem exibir partes incompletas da pagina.

### Conteudo

Usado em paginas, abas, tabelas, graficos e paineis cuja informacao ainda nao existe. Ocupa a area do conteudo, preservando dimensoes minimas para impedir saltos no layout.

### Inline

Usado em botoes e acoes curtas, como salvar, buscar, exportar ou gerar analise. Mantem as dimensoes do controle e usa uma versao pequena do mesmo arco. O rotulo pode permanecer quando for necessario explicar a acao em andamento.

## Comportamento De Dados

- Primeiro carregamento: substitui o conteudo da regiao pelo indicador central.
- Mudanca de filtro que invalida o resultado: mostra o indicador na regiao dependente do filtro e remove os valores antigos ate a nova resposta chegar.
- Atualizacao em segundo plano com dados validos ja exibidos: preserva os dados e mostra somente o indicador compacto no comando de atualizar. Isso evita piscadas e mantem a fluidez.
- Acoes de formulario: desabilitam apenas o controle responsavel e usam o indicador inline.
- Dialogos: carregam dentro do corpo do dialogo, sem bloquear o restante da aplicacao.

## Migracao

1. Evoluir `src/components/common/LoadingState.tsx` para suportar os tres escopos e o novo arco visual.
2. Substituir os spinners duplicados de `App.tsx`, `RequireRole.tsx` e `RequireModule.tsx` pelo escopo de tela.
3. Fazer os carregamentos de pagina e painel existentes usarem o escopo de conteudo.
4. Substituir indicadores personalizados de espera que ocupam areas inteiras.
5. Manter indicadores de atualizacao e botoes como inline, adotando a mesma linguagem visual.
6. Remover mensagens visiveis como `Carregando...` dos estados bloqueantes, preservando-as somente para leitores de tela.

## Acessibilidade

- Todos os estados bloqueantes usam `role="status"` e `aria-live="polite"`.
- A regiao em processamento recebe `aria-busy="true"` quando aplicavel.
- O arco e decorativo e fica oculto de leitores de tela.
- `prefers-reduced-motion` interrompe a rotacao sem esconder o indicador.
- Contraste do arco deve funcionar nos temas claro e escuro.

## Desempenho E Fluidez

- Nenhuma biblioteca nova sera adicionada.
- O componente usara CSS e markup simples, sem imagens ou animacoes JavaScript.
- As dimensoes da regiao serao preservadas para evitar `layout shift`.
- Atualizacoes em segundo plano nao apagam informacoes ainda validas.
- O carregamento nao deve criar overlays globais quando apenas um painel estiver buscando dados.

## Testes E Validacao

- Testar os escopos tela, conteudo e inline.
- Confirmar semantica de acessibilidade e reducao de movimento.
- Validar autenticacao, guardas de rota e `Suspense`.
- Validar ao menos uma pagina de cada modulo em carregamento inicial e troca de filtro.
- Confirmar que botoes de salvar, exportar, buscar e atualizar nao mudam de tamanho.
- Fazer verificacao visual nos temas claro e escuro em 1440, 1024, 768 e 390 px.
- Confirmar ausencia de sobreposicao, rolagem horizontal e piscadas do conteudo.

## Fora Do Escopo

- Alterar regras de consulta, cache ou autorizacao.
- Introduzir skeletons, barras de progresso ou textos rotativos.
- Bloquear a aplicacao inteira durante atualizacoes locais.
