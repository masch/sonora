# Complete Payment Flow Architecture (Sonora)

This document describes the architecture, sequence flows, and endpoint specifications for Sonora's payment integration across all platforms (**Android Native**, **iOS Native**, and **Web**). It details the interactions between the **Mobile/Web App**, **Hono API Worker**, **Mercado Pago (Checkout Pro)**, and **Webhooks**.

---

## 1. High-Level Architecture Overview

```mermaid
flowchart TD
    subgraph Client["Sonora Client (Expo SDK 56)"]
        UI["UI Components (PaymentPrompt)"]
        Hook["usePurchase Hook"]
        ClientService["PaymentClient"]
        WebBrowser["WebBrowser / AuthSession"]
    end

    subgraph API["Sonora API Backend (Cloudflare Worker)"]
        PaymentRoute["/payments/create"]
        ReturnRoute["/payments/return/:status/:id"]
        WebhookRoute["/payments/webhook"]
        StatusRoute["/payments/status/:id"]
        DB[(PostgreSQL Database)]
    end

    subgraph MP["Mercado Pago (Checkout Pro)"]
        CheckoutPro["Checkout Pro / Sandbox"]
        MPWebhook["MP Webhook Event Dispatcher"]
    end

    UI -->|1. Start purchase| Hook
    Hook -->|2. POST /payments/create| ClientService
    ClientService --> PaymentRoute
    PaymentRoute -->|3. Record pending purchase| DB
    PaymentRoute -->|4. Create MP Preference| MP
    PaymentRoute -->|5. Return checkoutUrl + purchaseId| Hook
    Hook -->|6. Open checkout| WebBrowser
    WebBrowser -->|7. Complete payment| CheckoutPro

    CheckoutPro -->|8. POST /payments/webhook| WebhookRoute
    WebhookRoute -->|9. Validate signature & update purchase| DB

    CheckoutPro -->|10. GET /payments/return/success/:id| ReturnRoute
    ReturnRoute -->|11. HTTP 302 Redirect to /payments/callback| WebBrowser
    WebBrowser -->|12. Intercept via App Link / Deep Link| Hook
    Hook -->|13. GET /payments/status/:id?sync=true| StatusRoute
    StatusRoute -->|14. Return status 'approved'| Hook
    Hook -->|15. Update UI state to 'paid'| UI
```

---

## 2. Route & Endpoint Standardizations (Plural `/payments/`)

| Layer              | Route / URL                                | Description                                       |
| :----------------- | :----------------------------------------- | :------------------------------------------------ |
| **API Backend**    | `POST /payments/create`                    | Initializes checkout & creates MP preference      |
| **API Backend**    | `POST /payments/webhook`                   | Receives async provider webhook notifications     |
| **API Backend**    | `GET /payments/return/:status/:purchaseId` | Mercado Pago browser return handler (`back_urls`) |
| **API Backend**    | `GET /payments/status/:purchaseId`         | Client status polling endpoint (`?sync=true`)     |
| **App Client**     | `src/app/payments/success/[id].tsx`        | Expo Router success screen                        |
| **App Client**     | `src/app/payments/failure/[id].tsx`        | Expo Router failure screen                        |
| **App Client**     | `src/app/payments/pending/[id].tsx`        | Expo Router pending screen                        |
| **Universal Link** | `https://<domain>/payments/callback`       | Callback URL supplied in `redirectUrl`            |

---

## 3. Platform Sequence Diagrams

### A. Android Native (App Link Integration)

In Android Native, [`app.config.ts`](file:///var/home/masch/dev/js/sonora/apps/mobile/app.config.ts#L57-L70) configures an `intentFilter` listening to URLs with `pathPrefix: "/payments"`.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Native App (Android)
    participant API as Sonora API Worker
    participant DB as PostgreSQL DB
    participant MP as Mercado Pago

    User->>App: Tap "Buy Experience"
    App->>API: POST /payments/create { experienceId, redirectUrl: "https://<domain>/payments/callback" }
    API->>DB: Insert purchase (status: 'pending')
    API->>MP: Create Preference (back_urls: "/payments/return/...", notification_url: "/payments/webhook")
    MP-->>API: Return init_point (checkoutUrl)
    API-->>App: { purchaseId, checkoutUrl }

    App->>App: Start background polling (GET /payments/status/:id)
    App->>MP: Open WebBrowser (Custom Tab) to checkoutUrl

    User->>MP: Complete payment

    par Async Webhook
        MP->>API: POST /payments/webhook?data.id=123&type=payment
        API->>DB: Update purchase status to 'approved'
        API-->>MP: 200 OK
    and Browser Redirection
        MP->>API: GET /payments/return/success/:purchaseId
        API->>DB: Query purchase metadata (redirectUrl)
        API-->>MP: HTTP 302 Redirect to "https://<domain>/payments/callback"
        MP->>App: Browser attempts navigation to "https://<domain>/payments/callback"
        Note over App: Android OS Intent Filter intercepts the URL<br/>and reopens the Sonora Native App directly.
    end

    App->>API: GET /payments/status/:purchaseId?sync=true
    API-->>App: { status: 'approved' }
    App->>User: Close checkout & unlock experience
```

---

### B. iOS Native (Universal Links Integration)

In iOS Native, [`app.config.ts`](file:///var/home/masch/dev/js/sonora/apps/mobile/app.config.ts#L41) defines `associatedDomains: ["applinks:<domain>"]`.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Native App (iOS)
    participant API as Sonora API Worker
    participant MP as Mercado Pago

    User->>App: Start purchase
    App->>API: POST /payments/create { experienceId, redirectUrl: "https://<domain>/payments/callback" }
    API-->>App: { purchaseId, checkoutUrl }
    App->>MP: WebBrowser.openAuthSessionAsync(checkoutUrl, callbackUrl)

    User->>MP: Complete payment in Mercado Pago
    MP->>API: GET /payments/return/success/:purchaseId
    API-->>MP: HTTP 302 Redirect to "https://<domain>/payments/callback"
    Note over App,MP: iOS WebAuthSession detects matching callbackUrl,<br/>automatically closes popup, and returns control to JS.
    App->>API: GET /payments/status/:purchaseId?sync=true
    App->>User: Unlock experience
```

---

### C. Web Frontend (Desktop / Mobile Browser)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Web App Browser
    participant API as Sonora API Worker
    participant MP as Mercado Pago

    User->>Web: Click "Buy"
    Web->>API: POST /payments/create { experienceId, redirectUrl: "https://web.sonora.app/payments/success/123" }
    API-->>Web: { purchaseId, checkoutUrl }
    Web->>MP: Redirect tab to checkoutUrl
    User->>MP: Complete payment
    MP->>API: GET /payments/return/success/:purchaseId
    API-->>Web: HTTP 302 Redirect to "https://web.sonora.app/payments/success/123"
    Web->>User: Render web success page
```

---

## 4. Referer Filtering & Redirect Loop Prevention

### Gateway Domain Filtering

In [`apps/api/src/routes/payments.ts`](file:///var/home/masch/dev/js/sonora/apps/api/src/routes/payments.ts):

1. **Priority 1**: If `purchase.metadata.redirectUrl` exists, issue an HTTP 302 redirect.
2. **Priority 2**: Inspect `Referer` header. If domain belongs to a payment gateway (`mercadopago.com`, `mercadopago.com.ar`, `mercadolibre.com`), **ignore the referer**.
3. **HTML Fallback**: If no valid redirect URL or non-gateway referer exists, render an HTML confirmation page (`200 OK`) instructing the user that payment was completed and they can return to the app.

---

## 5. Webhook Validation & Polling Resilience

1. **HMAC-SHA256 Signature Verification**: Evaluates `x-signature` header using `MP_WEBHOOK_SECRET`.
2. **Idempotency & Replay Attack Prevention**: Enforces valid state machine transitions (e.g., blocks `refunded` -> `approved`).
3. **Active Fallback Polling (`?sync=true`)**: Forces real-time gateway checks if webhooks experience network latency.
