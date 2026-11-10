# Ícones de instalação no celular — web 2.7.3

Publicada em 10/11/2026 a configuração de ícones oficiais para instalação na tela inicial. A identidade acompanha a filial ativa: Casa da Transmissão ou Casa do Chevrolet. Empresa10041 usa Chevrolet; sem filial identificada, usa a logo oficial do Grupo Pelegrini.

## Implementação

- `AppInstallBranding` lê o contexto de filial existente e atualiza `manifest`, `apple-touch-icon`, `apple-mobile-web-app-title` e `application-name`. Não muda a seleção, permissões ou dados.
- `index.html` fornece manifesto de fallback e PNG180 para iOS, além dos metadados de instalação.
- `public/pwa/{pelegrini,transmissao,chevrolet}` contém manifesto JSON, PNG180,192,512 e máscara512. Imagens opacas produzidas deterministicamente a partir das logos existentes pelo script `scripts/generateAppIcons.ps1`; sem logos inventadas.
- Manifestos possuem IDs distintos, `display=standalone`, `scope=/` e `start_url=/`. O fluxo inicial e de autenticação permanece o mesmo. Nenhum service worker/cache de dados/offline foi introduzido.
- O favicon normal do navegador permanece o existente; os ícones de instalação são os PNGs específicos.

A preferência filial versus grupo foi perguntada opcionalmente. Sem resposta, foi adotado e comunicado o padrão da filial selecionada, coerente com a identidade já exibida pelo sistema.

## Publicação e rollback

- Base de código: `3b60b54cf1400f1dd0f06287c6d209cf2940a633`, fonte da web2.7.2.
- Snapshot compilado: `tmp/app-icons-release-source`; lista de arquivos e hashes em `app-icons-source.json`.
- Pacote: `823b898a3a9e`,174arquivos,4.934.113bytes.
- Manifesto da web2.7.3 registra `commit=null`, `sourceBase=3b60b54...` e `change=company-install-icons`.
- Conteúdo estático ativo: `/docker/pelegrini-web-vps/build-app-icons-823b898a3a9e/web-dist`.
- Imagem nginx preservada: `pelegrini-web:stock-filters-r15-b2b71894fdc6`. A publicação altera somente a origem do bind mount do conteúdo estático, preservando o nginx da produtividade e os demais serviços.
- Backup do compose: `/var/backups/pelegrini-mercadolivre-api/app-icons-web-20261110T144817Z/web-compose.yml`.
- Hardlinks reutilizam os ativos imutáveis anteriores; cada caminho alterado foi desvinculado antes da escrita. Não editar arquivos compartilhados in-place.
- A primeira tentativa foi interrompida pela margem de espaço antes de mudar o site. Foi retomada com a mesma margem (64MiB +4×pacote), após verificar115MB livres. Não foram apagados logs, imagens, bancos ou volumes.
- Serviço saudável;15ativos PWA conferidos por HTTP e SHA256 no serviço ativo.

O HEAD c0de276 e o índice da worktree anterior não foram substituídos. App.tsx do snapshot mantém os demais módulos da base publicada e adiciona apenas a importação/renderização do componente. Nenhum push ao GitHub.

## Verificação

-35testes selecionados passaram, incluindo a troca de metadados entre filiais, dimensões PNG, manifestos, fluxo da home, acesso aos módulos e contrato paginado de estoque.
- Lint do novo componente/teste: zero erros; build Vite passou.
- Revisão independente sem achados concretos; conferiu App.tsx versus base e os ícones maskable.
- No navegador público, selecionar Chevrolet resultou em `/pwa/chevrolet/manifest.json`, `/pwa/chevrolet/apple-touch-icon.png` e nome Casa do Chevrolet. Selecionar Transmissão resultou nos caminhos equivalentes e nome Casa da Transmissão.
- As duas imagens PNG180 foram abertas publicamente e conferidas visualmente. Instalação em telefone físico não foi executada.
- A navegação inicialmente recebeu HTML2.7.2 em cache. A URL `https://pelegrini.t2a.ia.br/?icone=2.7.3` carregou a entrada nova `/assets/index-Bw_wgSgP.js`. Usar uma atualização de página ou essa URL antes de instalar.

Referências técnicas consultadas: [Web App Manifest](https://web.dev/learn/pwa/web-app-manifest), [ID do manifesto](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id), [ícone PNG para tela inicial do iOS](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
