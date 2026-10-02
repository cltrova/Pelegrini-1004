# E-Commerce Mercado Livre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontend-only E-Commerce module for Casa do Chevrolet, prepared for a future Mercado Livre integration without exposing credentials, making real API calls, or changing existing modules.

**Architecture:** Add E-Commerce as a first-class Pelegrini module identity and visual theme, expose its home card only while the active branch is Chevrolet, protect all deep links with authentication plus a Chevrolet branch guard, and render a dedicated responsive shell with Overview, Listings, Orders, and Mercado Livre Integration routes. Keep Mercado Livre access behind typed domain contracts and a service/query boundary that currently reports the integration as not configured.

**Tech Stack:** React, TypeScript, Vite, React Router, TanStack Query, lucide-react, Vitest, React Testing Library, existing Pelegrini shell/theme/loading primitives.

**Spec:** [docs/superpowers/specs/2026-10-02-ecommerce-mercado-livre-design.md](../specs/2026-10-02-ecommerce-mercado-livre-design.md)

## Global Constraints

- E-Commerce is available only to the active Casa do Chevrolet branch (`chevrolet` / company `10041`); it must be hidden from the Casa da Transmissao branch and direct routes must redirect safely.
- Preserve the current authentication and branch-selection flow. Do not add a new permission column or Supabase migration in this frontend-preparation phase.
- Do not put Mercado Livre client secrets, access tokens, refresh tokens, or credentials in the browser bundle, local storage, or URL parameters.
- Do not make real Mercado Livre requests until a backend OAuth/proxy contract exists. The UI must present a controlled disconnected/not-configured state instead of fake production data.
- Reuse the existing module shell, sidebar patterns, theme tokens, standard loading state, error boundaries, and responsive conventions wherever possible.
- Keep the existing Comercial, Operacional, Financeiro, WhatsApp, and branch-selection behavior unchanged.
- Do not add listing, price, stock, order, or account mutations in this phase.

## Review Focus

- Branch isolation: the card is absent on Transmissao, direct `/ecommerce/*` access is blocked there, and Chevrolet deep links work after authentication.
- Loading, empty, disconnected, and error states are explicit and use the system-standard loading experience.
- No network call or credential persistence occurs when the integration is not configured.
- Tables remain usable on narrow screens without introducing a page-level horizontal scroll.
- Existing route guards, build output, and module navigation regressions are covered by focused tests.

---

## Task 1: Add E-Commerce Identity, Theme, and Chevrolet-Only Home Entry

**Files:**
- Modify `src/config/pelegriniIdentity.ts`
- Modify `src/config/pelegriniTheme.ts`
- Modify `src/config/pelegriniHome.ts`
- Modify `src/components/home/PelegriniHomeExperience.tsx`
- Add or extend `src/components/home/PelegriniHomeExperience.test.tsx` and/or `src/pages/HomeBranchFlow.test.tsx`

- [ ] Write failing tests for the new module identity/visual metadata and for branch visibility: E-Commerce is rendered for Chevrolet, absent for Transmissao, and does not bypass existing auth/module checks.
- [ ] Extend `PelegriniModuleKey` and all module visual/theme records with `ecommerce`; add the module label, description, operational label, metric label, tags, icon, and accent using existing design tokens.
- [ ] Add a branch restriction field to the home-module configuration rather than hard-coding the card in JSX; mark E-Commerce as Chevrolet-only.
- [ ] Update home filtering and click handling so the card is visible and navigable only for the active Chevrolet branch, while existing modules preserve their current permission logic.
- [ ] Keep the card copy honest: describe marketplace management and integration preparation, without claiming a live Mercado Livre connection.
- [ ] Run the focused home tests and confirm they fail before implementation and pass afterward.
- [ ] Commit the isolated change with message `feat: add Chevrolet-only ecommerce module entry`.

## Task 2: Create the Protected E-Commerce Shell and Routes

**Files:**
- Add `src/components/auth/RequireEcommerceBranch.tsx`
- Add `src/components/layout/EcommerceLayout.tsx`
- Add `src/components/layout/EcommerceSidebar.tsx`
- Modify `src/App.tsx`
- Modify `src/components/pelegrini/PelegriniModuleShell.tsx` only if the existing shell needs a typed extension for the new module key
- Add `src/components/auth/RequireEcommerceBranch.test.tsx`
- Add `src/components/layout/EcommerceLayout.test.tsx`

- [ ] Write failing guard tests for unauthenticated access, authenticated Transmissao access, and authenticated Chevrolet access.
- [ ] Implement a small guard that composes the existing auth/company checks with the active branch context and redirects non-Chevrolet users to the existing safe home route.
- [ ] Write failing layout tests for sidebar navigation, active route state, mobile behavior, and the standard loading fallback around lazy pages.
- [ ] Implement the dedicated shell/sidebar with four routes: `/ecommerce`, `/ecommerce/anuncios`, `/ecommerce/pedidos`, and `/ecommerce/integracao`.
- [ ] Register lazy route boundaries in `src/App.tsx` behind the guard, preserving current route ordering and existing layout behavior.
- [ ] Use the existing `PelegriniModuleShell` and shared sidebar primitives; do not create a second global navigation system.
- [ ] Run focused guard/layout tests and verify direct route refresh behavior in the local app.
- [ ] Commit the isolated change with message `feat: add protected ecommerce shell and routes`.

## Task 3: Define the Mercado Livre Frontend Contract and Safe Data Boundary

**Files:**
- Add `src/modules/ecommerce/ecommerceTypes.ts`
- Add `src/modules/ecommerce/ecommerceService.ts`
- Add `src/hooks/useEcommerceData.ts`
- Add `src/modules/ecommerce/ecommerceService.test.ts`
- Add `src/hooks/useEcommerceData.test.ts`

- [ ] Write failing unit tests proving the service returns the typed `not_configured` state without making a fetch request or reading/writing browser storage.
- [ ] Define typed domain models for connection status, synchronization health, overview metrics, listing rows, order rows, and integration configuration metadata.
- [ ] Define a narrow service interface for future backend endpoints, with explicit methods for status/overview/listings/orders and no token-bearing client methods.
- [ ] Implement the current adapter as a deterministic not-configured provider, with optional injected transport only for future tests/backend wiring.
- [ ] Add TanStack Query hooks with stable query keys, disabled behavior when the branch is not Chevrolet, and explicit loading/error/empty/disconnected states.
- [ ] Ensure query hooks do not silently invent values; zero/empty values must be labeled as unavailable or not configured where appropriate.
- [ ] Run service and hook tests, including a test that branch switching prevents Chevrolet data from being requested.
- [ ] Commit the isolated change with message `feat: add ecommerce data contracts and safe adapter`.

## Task 4: Build the E-Commerce Overview Screen

**Files:**
- Add `src/pages/ecommerce/EcommerceOverviewPage.tsx`
- Add `src/pages/ecommerce/EcommerceOverviewPage.test.tsx`
- Add scoped styles only if the existing module tokens cannot cover the screen, preferably in `src/styles/ecommerce.css`

- [ ] Write failing component tests for loading, disconnected, error, and configured overview states.
- [ ] Implement the overview using existing cards, typography, icon buttons/tooltips, and the standard system loading state.
- [ ] Render connection status, last synchronization, listing count, pending orders, and sync health from the typed hook rather than hard-coded production figures.
- [ ] Add clear next action from the disconnected state to the Integration route; keep the action controlled and non-networking until backend support exists.
- [ ] Verify responsive layout and that the page does not introduce horizontal scrolling at the project’s supported viewport sizes.
- [ ] Run focused page tests and a browser smoke check for `/ecommerce` on both branches.
- [ ] Commit the isolated change with message `feat: add ecommerce overview states`.

## Task 5: Build Listings and Orders Scaffolds

**Files:**
- Add `src/pages/ecommerce/EcommerceListingsPage.tsx`
- Add `src/pages/ecommerce/EcommerceOrdersPage.tsx`
- Add `src/pages/ecommerce/EcommerceListingsPage.test.tsx`
- Add `src/pages/ecommerce/EcommerceOrdersPage.test.tsx`

- [ ] Write failing tests for each table’s loading, not-configured, empty, error, and configured rows.
- [ ] Implement Listings with columns for title, SKU, status, price, stock, and last update, using status badges and compact responsive table behavior consistent with the existing application.
- [ ] Implement Orders with order ID, buyer, status, total, payment status, and date, including an explicit empty/disconnected state instead of fake orders.
- [ ] Keep all mutations out of these screens; actions should be disabled or omitted until a backend contract exists.
- [ ] Add accessible labels/tooltips for unfamiliar icons and ensure text fits without forcing page-level horizontal scrolling.
- [ ] Run focused tests plus a visual smoke check at desktop and narrow viewport widths.
- [ ] Commit the isolated change with message `feat: add ecommerce listings and orders scaffolds`.

## Task 6: Build the Mercado Livre Integration Screen

**Files:**
- Add `src/pages/ecommerce/EcommerceIntegrationPage.tsx`
- Add `src/pages/ecommerce/EcommerceIntegrationPage.test.tsx`

- [ ] Write failing tests for disconnected, connected, syncing, and error presentation, plus the unavailable-connect-action behavior.
- [ ] Implement the screen with connection state, client/configuration metadata, read-only redirect URI, last synchronization/error, and a clear backend-not-configured explanation.
- [ ] Add Connect/Reconnect controls that show a controlled unavailable state until the backend OAuth contract is available; never put credentials in the form or URL.
- [ ] Add Disconnect only when the service reports a real connected state and the backend method exists; otherwise keep it unavailable.
- [ ] Link the screen from the overview empty/disconnected state and verify keyboard/focus behavior for all actions.
- [ ] Run focused tests and confirm no network request is made by the current frontend-only implementation.
- [ ] Commit the isolated change with message `feat: add Mercado Livre integration preparation screen`.

## Task 7: Full Verification and Integration Review

**Files:**
- Modify only files required by failing verification or type errors from Tasks 1-6.
- Add/update focused tests only where a verified regression is found.

- [ ] Run `npm run test -- --run` (or the repository’s exact test command) and fix only regressions caused by this feature.
- [ ] Run `npm run build` and confirm the production bundle contains no Mercado Livre secrets, access tokens, or accidental debug data.
- [ ] Run `git diff --check` and inspect the final diff for unrelated changes.
- [ ] Verify the full branch matrix manually: Transmissao hides/blocks E-Commerce; Chevrolet opens all four routes; unauthenticated users follow the existing auth flow.
- [ ] Verify the loading experience matches the system standard on every lazy route and query state.
- [ ] Verify responsive behavior, active sidebar state, safe redirects, and refresh/deep-link behavior.
- [ ] Request a final code review focused on authorization boundaries, data correctness, and API readiness.
- [ ] Commit any final verification-only fixes with message `chore: verify ecommerce module integration`.

