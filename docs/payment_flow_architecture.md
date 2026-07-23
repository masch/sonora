# Complete Payment Flow Architecture (Sonora)

This document describes the architecture, sequence flows, and endpoint specifications for Sonora's payment integration across all platforms (**Android Native**, **iOS Native**, and **Web**). It details the interactions between the **Mobile/Web App**, **Hono API Worker**, **Mercado Pago (Checkout Pro)**, and **Webhooks**.

---

## 1. High-Level Architecture Overview

```mermaid
flowchart TD
    subgraph Shared["Shared Package (@sonora/shared)"]
        SSOT["app-identifiers.json (SSOT App Schemes)"]
        Enums["PAYMENT_ROUTES & Enums"]
    end

    subgraph Client["Sonora Client (Expo SDK 56)"]
        UI["UI Components (PaymentPrompt)"]
        Hook["usePurchase Hook"]
        ClientService["PaymentClient"]
        WebBrowser["WebBrowser / AuthSession"]
        AppCallback["app/payments/callback.tsx (Expo Router)"]
    end

    subgraph API["Sonora API Backend (Cloudflare Worker)"]
        PaymentsGuard["paymentsGuard (Injects c.var.appScheme)"]
        PaymentRoute["POST /payments/create"]
        ReturnRoute["GET /payments/return/:status/:id"]
        WebhookRoute["POST /payments/webhook"]
        StatusRoute["GET /payments/status/:id"]
        DB[(PostgreSQL Database)]
    end

    subgraph MP["Mercado Pago (Checkout Pro)"]
        CheckoutPro["Checkout Pro / Sandbox"]
        MPWebhook["MP Webhook Event Dispatcher"]
    end

    SSOT -->|environment scheme| PaymentsGuard
    SSOT -->|environment scheme| UI

    UI -->|1. Start purchase| Hook
    Hook -->|2. POST /payments/create| ClientService
    ClientService --> PaymentRoute
    PaymentRoute -->|3. Record pending purchase + redirectUrl| DB
    PaymentRoute -->|4. Create MP Preference| MP
    PaymentRoute -->|5. Return checkoutUrl + purchaseId| Hook
    Hook -->|6. Open checkout| WebBrowser
    WebBrowser -->|7. Complete payment| CheckoutPro

    CheckoutPro -->|8. POST /payments/webhook| WebhookRoute
    WebhookRoute -->|"9. Validate signature and preserve metadata"| DB

    CheckoutPro -->|10. GET /payments/return/success/:id| ReturnRoute
    ReturnRoute -->|11. Disambiguate Web vs Native| DB
    ReturnRoute -->|12a. Web: 302 Redirect to https://web-origin/payments/success/:id| WebBrowser
    ReturnRoute -->|12b. Native: 302 Redirect to sonora-staging://payments/success/:id| AppCallback

    AppCallback -->|13. GET /payments/status/:id?sync=true| StatusRoute
    StatusRoute -->|14. Return status 'approved'| Hook
    Hook -->|15. Update UI state to 'paid'| UI
```

---

## 2. Centralized App Schemes (Single Source of Truth)

To prevent scheme mismatches between the Expo mobile app and the Hono API backend, application schemes are centralized in `@sonora/shared`:

### `packages/shared/src/app-identifiers.json` (SSOT)

- **Staging**: `"scheme": "sonora-staging"`
- **Production**: `"scheme": "sonora"`

### `appScheme` Resolution in API

The [`paymentsGuard`](file:///var/home/masch/dev/js/sonora/apps/api/src/middleware/payments-guard.ts) middleware resolves the target OS scheme based on the active `ENVIRONMENT`:

```ts
const SCHEME_BY_ENVIRONMENT: Record<string, string> = {
  staging: APP_IDENTIFIERS.staging.scheme,
  production: APP_IDENTIFIERS.production.scheme,
};
c.set('appScheme', SCHEME_BY_ENVIRONMENT[env] || APP_IDENTIFIERS.production.scheme);
```

---

## 3. Standardized Routes & Endpoints (`PAYMENT_ROUTES`)

All payment-domain routes are defined in [`packages/shared/src/enums.ts`](file:///var/home/masch/dev/js/sonora/packages/shared/src/enums.ts):

| Component       | Route / Endpoint                           | Description                                              |
| :-------------- | :----------------------------------------- | :------------------------------------------------------- |
| **API Backend** | `POST /payments/create`                    | Initiates purchase session and creates MP preference     |
| **API Backend** | `POST /payments/webhook`                   | Receives async payment event notifications from MP       |
| **API Backend** | `GET /payments/return/:status/:purchaseId` | Browser return receiver from Mercado Pago (`back_urls`)  |
| **API Backend** | `GET /payments/status/:purchaseId`         | Purchase status check with active polling (`?sync=true`) |
| **API Backend** | `GET /payments/callback`                   | Native deep link fallback redirect                       |
| **API Backend** | `GET /payments/experiences/:id/purchased`  | Direct purchase check for a specific experience          |
| **API Backend** | `POST /payments/experiences/:id/access`    | Logs experience access (free / paid / restored)          |
| **App Client**  | `src/app/payments/callback.tsx`            | Expo Router native deep link callback receiver           |
| **App Client**  | `src/app/payments/success/[id].tsx`        | Expo Router success screen                               |
| **App Client**  | `src/app/payments/failure/[id].tsx`        | Expo Router failure screen                               |
| **App Client**  | `src/app/payments/pending/[id].tsx`        | Expo Router pending screen                               |

---

## 4. Return Redirection Logic (`/payments/return/:status/:purchaseId`)

Upon completing checkout, Mercado Pago redirects the browser to the API worker return endpoint. The endpoint differentiates Web clients from Native App clients:

### Redirection Algorithm ([`apps/api/src/routes/payments.ts`](file:///var/home/masch/dev/js/sonora/apps/api/src/routes/payments.ts#L284-L330))

1. **Read Metadata**: Retrieves `purchase.metadata.redirectUrl` saved during checkout creation.
2. **Origin Disambiguation**:
   - **Web App (`http://` or `https://` origin that is not a native API callback)**:
     Formats the return URL using the Web App origin:
     `https://<web-origin>/payments/:status/:purchaseId`
   - **Native App (`/payments/callback` URL or custom scheme `sonora-staging://`)**:
     Formats the native deep link using the active environment scheme:
     `${appScheme}://payments/:status/:purchaseId`
3. **URL Parsing Failures**: If `new URL(targetUrl)` throws due to a malformed URL, the API logs `logger.error(...)` and sets `targetUrl = ''`.
4. **Fallback Hierarchy**:
   - If `targetUrl` is falsy/empty, checks the `Referer` header. If it does not belong to a payment gateway (`mercadopago` / `mercadolibre`), redirects to the Referer origin.
   - If the Referer originated from Mercado Pago or is missing, redirects to the default native callback `${baseUrl}/payments/callback` (`sonora-staging://payments/callback`).

---

## 5. Webhooks & Metadata Preservation (Merge)

### `redirectUrl` Preservation ([`apps/api/src/routes/payments.ts`](file:///var/home/masch/dev/js/sonora/apps/api/src/routes/payments.ts#L239))

When Mercado Pago notifies status updates via `POST /payments/webhook`:

- The API merges existing purchase metadata (`existingMeta`) with incoming notification metadata (`incomingMeta`):
  ```ts
  const mergedMetadata = { ...existingMeta, ...incomingMeta };
  ```
- This ensures `redirectUrl` set during checkout creation is **never overwritten with `NULL`** when webhooks arrive before the browser return redirect completes.

### Idempotency & Replay Protection

- **HMAC-SHA256**: Validates `x-signature` header (with controlled logging bypass in staging).
- **State Transition Guard**: Prevents invalid status transitions (e.g. `refunded` -> `approved`).
- **Duplicate Detection**: Repeated notifications with matching status return `200 OK` immediately.

---

## 6. Complete Sequence Diagram (Web vs Native)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Mobile App / Web App
    participant API as Sonora API Worker
    participant DB as PostgreSQL
    participant MP as Mercado Pago

    User->>App: Initiate experience purchase
    App->>API: POST /payments/create { experienceId, redirectUrl }
    API->>DB: Insert purchase (status: 'pending', metadata: { redirectUrl })
    API->>MP: Create Preference (back_urls: "/payments/return/...")
    MP-->>API: Return checkoutUrl
    API-->>App: { purchaseId, checkoutUrl }
    App->>MP: Open WebBrowser / tab at checkoutUrl

    User->>MP: Complete payment

    par Async Webhook
        MP->>API: POST /payments/webhook?data.id=123&type=payment
        API->>DB: Merge metadata and Update status 'approved'
        API-->>MP: 200 OK
    and Browser Return
        MP->>API: GET /payments/return/success/:purchaseId
        API->>DB: Read metadata (redirectUrl)
        alt redirectUrl is Web Origin (https://web-app.com)
            API-->>MP: 302 Redirect to "https://web-app.com/payments/success/:purchaseId"
            MP->>App: Browser navigates to Web App
        else redirectUrl is Native Callback (https://api.domain/payments/callback or custom scheme)
            API-->>MP: 302 Redirect to "sonora-staging://payments/success/:purchaseId"
            MP->>App: OS intercepts Deep Link and reopens Native App
        end
    end

    App->>API: GET /payments/status/:purchaseId?sync=true
    API-->>App: { status: 'approved' }
    App->>User: Display success screen & unlock experience
```

---

## 7. Quality Assurance & Testing

The payment architecture is fully covered by automated unit tests verified in CI and signed with GPG:

- **`packages/shared/src/__tests__/enums.test.ts`**: 100% coverage on route generators and domain enums.
- **`apps/api/src/__tests__/payments.test.ts`**: Covers checkout creation, idempotent webhooks, Web vs Native redirection, metadata preservation, and error handling.
- **Security Validation**: All commits GPG signed (`Good signature`) with strict pre-commit validation hooks (`format-check`, `test-ci`, `lint`, `typecheck`, `doctor-ci`, `gga`).
