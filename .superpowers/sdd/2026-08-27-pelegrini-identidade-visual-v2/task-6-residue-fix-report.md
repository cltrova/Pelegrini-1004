# Task 6: Residue Fix

- Removidos todos os usos de `Sparkles` de `EmpresaSelectorDialog` e `ModuleDetailsDialog`.
- Substituídos por ícones operacionais do `lucide-react`: `Bot`, `Activity`, `BrainCircuit`, `TrendingUp` e `Settings`.
- Textos, regras, navegação, permissões, dados e layout estrutural permaneceram inalterados.
- Nenhum gradiente adicional foi alterado; não havia ajuste seguro necessário para este escopo.

## Verificação

- Busca solicitada: sem resultados para `rounded-3xl`, `backdrop-blur-xl`, `glass` ou `Sparkles` nos caminhos alvo.
- `git diff --check`: passou.
- ESLint direcionado nos dois arquivos alterados: passou.
- `npm run lint` global: falha por problemas preexistentes espalhados pelo repositório (981 erros e 112 avisos), fora do escopo desta correção.
