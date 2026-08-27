# Task 5 Report: Shared Module Shell

## Status

DONE_WITH_CONCERNS

## Files Changed

- `src/components/pelegrini/PelegriniModuleShell.tsx` (created)
- `src/components/pelegrini/index.ts`
- `src/components/layout/ComercialLayout.tsx`
- `src/components/layout/OperacionalLayout.tsx`
- `src/components/layout/FinanceiroLayout.tsx`
- `src/components/layout/WhatsappLayout.tsx`
- `.superpowers/sdd/2026-08-27-redesign-pelegrini-filiais/task-5-report.md` (created)

## Implementation

Created `PelegriniModuleShell` to resolve the active branch theme, expose the Pelegrini CSS variables, and render the soft motion backdrop behind module content. Comercial, Operacional, and Financeiro now use the sidebar composition of the shell. The Comercial desktop branch-selection placeholder and separate mobile layout remain unchanged. Financeiro remains wrapped by `FinanceiroSearchProvider`.

### WhatsApp Ruling

The plan cited a shell with `sidebar`, but the real WhatsApp code uses `WhatsappHeader` and a `flex-col` layout. The implementation preserves that structure through the shell's `header` variant, which applies only the theme, backdrop, and variables without introducing a sidebar, lateral content offset, or navigation changes.

Reason: preserve existing behavior while fulfilling the shell's visual intent. If this choice is wrong, WhatsApp may be less visually standardized than sidebar-based modules, but it avoids a structural regression.

## Verification

- `git diff --check`: passed; no whitespace errors.
- `npm run build`: passed in the authorized environment.
- The initial sandboxed build was blocked while resolving `vite.config.ts`; the authorized rerun completed successfully.

Build emitted pre-existing warnings only:

- Browserslist data is 14 months old.
- Tailwind reports an ambiguous `duration-[1200ms]` class.
- CSS has an `@import` after Tailwind directives.

No unit test was added because the task's explicitly permitted code-writing scope excludes test files; the required full production build was executed instead.

## Self-Review

- Confirmed all four module layouts retain their existing child content and routing outlet.
- Confirmed Comercial's mobile branch and branch-selection blocking placeholder remain outside the desktop shell change.
- Confirmed `FinanceiroSearchProvider` still wraps the module shell.
- Confirmed the WhatsApp header and vertical layout remain intact, with no `md:ml-64` sidebar offset.
- Confirmed the only behavior-affecting branch in the shell is presentational layout selection for the existing header versus sidebar structures.

## Concerns

- Existing build warnings remain and were not changed because they are outside this task's scope.
- The WhatsApp header composition intentionally differs from the sidebar modules; this is the documented compatibility choice above.

## Commits

- `feat: add pelegrini module shell`
