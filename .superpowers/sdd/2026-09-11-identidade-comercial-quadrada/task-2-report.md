# Task 2 Report: Navegacao Comercial quadrada

## RED

- O novo teste do caminho mobile bloqueado falhou porque o placeholder nao tinha ancestral com `data-module-shell="comercial"`.
- O caso de rota isolado falhou no timeout padrao de teste de `5s` durante `await import('@/App')`; o timeout de `findByRole` nao cobria essa etapa.
- Na bateria conjunta exata, os dois arquivos de suporte passaram (`17 testes`) e o arquivo Comercial avancou ate o caso de rota, mas o runner nao encerrou dentro do limite externo controlado e foi interrompido explicitamente.

## Implementacao

- Mantido `indexed` na sidebar Comercial e os hooks visuais de indice/estado ativo.
- Mantidos o nome acessivel e a classe da navegacao mobile, sem alterar links ou permissoes.
- Mantido `data-module-shell="comercial"` no layout mobile e a geometria quadrada do placeholder.
- Adicionado `data-module-shell="comercial"` ao container do retorno mobile bloqueado em `ComercialLayout`.
- Mantidos os estilos escopados ao modulo Comercial, com raios, sombras, blur e transicoes conforme o brief.
- Adicionado teste de regressao do escopo no placeholder mobile bloqueado na suite existente.
- O teste de rota mantem `import('@/App')`, recria a arvore de rotas para cada empresa, aguarda o heading lazy por ate `10s` e possui timeout total explicito de `30s`, sem retornos que mascarem as assercoes.

## GREEN

- Teste focado do shell mobile: `1 passed`, `12 skipped`, processo encerrado normalmente.
- Caso de rota isolado apos a correcao: `1 passed`, `12 skipped`, teste em `4.09s`, processo encerrado normalmente.
- Limitacao preexistente: a bateria conjunta exata ainda nao encerra de forma confiavel ao executar o carregamento lazy de `App` depois dos demais testes do arquivo Comercial; a tentativa controlada foi interrompida e nenhum runner ficou pendente.

## Arquivos alterados

- `src/components/layout/ComercialSidebar.tsx`
- `src/components/layout/ComercialSidebar.test.ts`
- `src/components/layout/ComercialMobileBottomNav.tsx`
- `src/components/layout/ComercialMobileLayout.tsx`
- `src/components/layout/ComercialLayout.tsx`
- `src/styles/comercial-square.css`
- `.superpowers/sdd/2026-09-11-identidade-comercial-quadrada/task-2-report.md`
