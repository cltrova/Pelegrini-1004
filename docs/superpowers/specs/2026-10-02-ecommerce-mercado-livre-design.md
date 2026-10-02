# E-Commerce Mercado Livre Design

**Status:** Proposed for implementation
**Scope:** Frontend preparation for Casa do Chevrolet (`chevrolet` / `10041`)

## Goal

Create a new E-Commerce module that is available only for Casa do Chevrolet and provides the frontend structure needed to connect to the Mercado Livre API without exposing credentials or pretending that backend synchronization already exists.

## Constraints

- The module must never appear for Casa da Transmissao.
- Direct navigation to E-Commerce routes must be blocked when the active branch is not Chevrolet.
- The frontend must not store Mercado Livre client secrets, access tokens, or refresh tokens.
- Existing Comercial, Operacional, Financeiro, and WhatsApp flows must remain unchanged.
- Existing loading, empty, error, and responsive layout conventions must be reused.
- No Mercado Livre API calls are added until the backend OAuth and proxy endpoints exist.

## User Experience

When the active branch is Casa do Chevrolet, the home module selector shows **E-Commerce**. Selecting it opens `/ecommerce` with a dedicated module shell and sidebar.

The sidebar contains:

- Visao geral (`/ecommerce`)
- Anuncios (`/ecommerce/anuncios`)
- Pedidos (`/ecommerce/pedidos`)
- Integracao Mercado Livre (`/ecommerce/integracao`)

### Visao geral

The first screen is a compact operational dashboard with connection status, last synchronization, announcement count, pending orders, and synchronization health. It must support loading, empty, disconnected, and error states without fake production data.

### Anuncios

Prepare a table surface for Mercado Livre listings with title, SKU, status, price, stock, and last update. The first phase may show a clear empty state when no API data is available.

### Pedidos

Prepare a table surface for marketplace orders with order ID, buyer, status, total, payment status, and date. The first phase may show a clear empty state when no API data is available.

### Integracao Mercado Livre

Provide a configuration surface with:

- Connection status: disconnected, connecting, connected, error.
- Client ID field or configuration display.
- Redirect URI displayed as read-only configuration guidance.
- Connect/reconnect action.
- Disconnect action only when a backend endpoint is available.
- Last synchronization timestamp and error message.
- Clear note that secrets and tokens are handled by the backend.

The connect action is an integration boundary. Until its backend contract exists, it must show a controlled unavailable state rather than make a fabricated request.

## Architecture

- Add `ecommerce` to the module identity and visual configuration types.
- Add a Chevrolet-only home module entry gated by the active branch.
- Add a dedicated `EcommerceLayout` and `EcommerceSidebar` using the shared Pelegrini shell/sidebar primitives.
- Add lazy-loaded routes under `/ecommerce` with a branch guard.
- Add frontend domain types for connection status, listing rows, order rows, and synchronization status.
- Add a small service/query boundary with explicit placeholder states so future OAuth/API endpoints can be introduced without changing the screens.
- Keep authorization compatible with the current auth model. The branch gate is mandatory; the existing authenticated/master flow remains the outer guard.

## Non-Goals

- Implementing Mercado Livre OAuth against real credentials.
- Persisting secrets or tokens in Supabase from the browser.
- Creating marketplace listings, changing prices, importing orders, or synchronizing stock.
- Adding the module to Casa da Transmissao.

## Acceptance Criteria

1. E-Commerce is visible only after selecting Casa do Chevrolet.
2. E-Commerce does not appear for Casa da Transmissao.
3. Direct E-Commerce URLs redirect away when the active branch is not Chevrolet.
4. The four screens render through the standard module shell and standard loading states.
5. Empty and disconnected states clearly explain that backend integration is pending.
6. The frontend contains no Mercado Livre secret or token handling.
7. Existing module routes and focused tests remain green.
8. Production build completes successfully.
