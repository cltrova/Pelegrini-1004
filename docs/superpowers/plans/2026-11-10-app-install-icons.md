# Ícones ao instalar no celular

**Objetivo:** usar as logos oficiais existentes no ícone de instalação, no Android e no iPhone, em vez do ícone genérico.
**Arquitetura:** três manifestos JSON estáticos (grupo/CT/Chevrolet), PNGs opacos 180/192/512 e maskable512. Componente global atualiza somente metadados de instalação conforme a filial já autorizada no contexto. Antes da seleção, usar Grupo Pelegrini. Manifestos têm IDs distintos e start_url=/, mantendo o fluxo de login/seleção existente.
**Execução:** superpowers:writing-plans, test-driven-development e executing-plans, inline, com revisão final.

- [x] Teste funcional de metadados CT/Chevrolet/grupo e ativos/manifestos.
- [x] Gerar ícones a partir dos arquivos originais, com margem para recorte do sistema; configurar head e componente global.
- [x] Verificar dimensões, visual, testes, build e configuração servida.
- [x] Publicar sobre a versão atual preservando o estoque R15 e a montagem estática; conferir no navegador.

Preferência opcional solicitada: logo da filial ou única do grupo. Enquanto não houver resposta, seguir o padrão recomendado da filial selecionada, pois corresponde às identidades já exibidas pelo sistema. Não inventar logos nem alterar permissões, filial ativa, login ou cache de dados. A instalação usa o fluxo inicial normal do sistema; trocar a filial não concede acesso.

Base de publicação desta tarefa: branch local codex/stock-column-filters-r15, commit3b60b54 (web2.7.2). O HEAD antigo c0de276 não será publicado inteiro. Conferir novamente o container e os bind mounts antes da troca. Nenhum push ao GitHub.

Referências: web.dev/learn/pwa/web-app-manifest e guia Apple SafariWebContent/ConfiguringWebApplications (consultados em10/11/2026).

Concluído na web2.7.3,35testes selecionados, lint e build. Ver `docs/deployment/company-install-icons-2026-11-10.md` para proveniência, validação e rollback.
