# Mercado Pago — Fix para Producción

> Pendiente: validación de firma X-Signature en webhooks.
> Creado: 2026-07-16. Session Engram no disponible, se dejó este archivo.

## Problema

El `MercadoPagoProvider.processWebhook()` recibe `webhookSecret` en el constructor pero **nunca lo usa**. En producción, cualquiera puede POSTear a `/payments/webhook` con un payload falso y simular un pago aprobado. Mercado Pago envía el header `X-Signature` que hay que validar.

## Archivos a modificar

### 1. `apps/api/src/payments/mercadopago.ts`

- **Qué**: Agregar validación de `X-Signature` al inicio de `processWebhook()`.
- **Cómo**: MP firma con HMAC-SHA256 del body + secret. El header `X-Signature` contiene `ts=` y `v1=`.
- Referencia: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/additional-info

Estructura del header:

```
X-Signature: ts=1711234567,v1=hash_hex
```

La validación:

```typescript
async processWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult> {
  // --- NUEVO: validar firma ---
  const signatureHeader = headers['x-signature'] || '';
  if (!signatureHeader && this.config.webhookSecret) {
    throw new Error('Missing X-Signature header');
  }
  if (signatureHeader && this.config.webhookSecret) {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map(p => p.trim().split('=') as [string, string])
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) {
      throw new Error('Invalid X-Signature format');
    }
    const bodyRaw = JSON.stringify(payload);
    const expected = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`id:${(payload as any).data?.id || ''};request-id:${headers['x-request-id'] || ''};ts:${ts};`)
    );
    // Nota: revisar el formato exacto que MP usa, puede variar
    // Alternativa más simple: comparar con HMAC-SHA256 del body
  }
  // --- FIN NUEVO ---

  if (body.type !== 'payment' || !body.data?.id) {
    throw new Error('Ignored non-payment notification');
  }
  // ...resto igual
}
```

⚠️ **Importante**: El formato exacto de la firma de MP cambió en 2024/2025. Antes era HMAC-SHA256 del body, ahora incluye `id`, `request-id`, `ts`. Verificar la [doc actual](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/additional-info) antes de implementar.

### 2. `apps/api/src/payments/provider.ts`

- **Qué**: Probablemente no tocar, la interfaz ya pasa `headers` en `processWebhook()`.
- **Check**: Asegurarse de que el `HonoRequest` exponga todos los headers necesarios (debería con `c.req.raw.headers`).

## Prerequisitos en Mercado Pago

Antes de deployar:

1. Produc-tizar la aplicación en el dashboard de MP (suele requerir verificación)
2. Obtener `APP_USR-xxxx` (access token de producción)
3. Configurar Webhook Secret desde el panel de MP → Webhooks
4. Registrar la URL `https://<tu-dominio>/payments/webhook` en el panel

## Secrets a setear

```bash
cd apps/api

# Token de producción (empieza con APP_USR-)
echo "APP_USR-xxxx" | wrangler secret put MERCADO_PAGO_ACCESS_TOKEN

# Webhook secret (lo generás desde el panel de MP)
echo "tu-webhook-secret" | wrangler secret put MP_WEBHOOK_SECRET
```

O via Makefile:

```bash
make api-deploy-production-secrets
```

## Deploy

```bash
make api-deploy-production
```

## Tests existentes

El archivo de tests del archive:

```
apps/api/src/__tests__/mercadopago.test.ts
```

Correr después del fix:

```bash
cd apps/api && bun test
```

## Orden sugerido

1. Leer doc actual de MP sobre X-Signature
2. Implementar validación en `mercadopago.ts`
3. Testear con sandbox (staging) primero
4. Pasar a producción: secrets + deploy + webhook URL
