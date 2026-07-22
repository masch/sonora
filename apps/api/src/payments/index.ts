import type { Env } from '../index';
import { MercadoPagoProvider } from './mercadopago';
import type { PaymentProvider } from './provider';

// Build-time defines — substituted by esbuild at compile time via wrangler [define].
// Cannot be changed at runtime.
declare const MP_BYPASS_SIGNATURE: boolean;
declare const MP_SIGNATURE_MAX_AGE_MINUTES: number;

export function createPaymentProviders(env: Env): Record<string, PaymentProvider | null> {
  const providers: Record<string, PaymentProvider | null> = {
    mercadopago: new MercadoPagoProvider({
      accessToken: env.MP_ACCESS_TOKEN as string,
      webhookSecret: env.MP_WEBHOOK_SECRET as string,
      environment: env.ENVIRONMENT || 'production',
      signatureMaxAgeMinutes:
        typeof MP_SIGNATURE_MAX_AGE_MINUTES !== 'undefined' ? MP_SIGNATURE_MAX_AGE_MINUTES : 5,
      bypassSignature: typeof MP_BYPASS_SIGNATURE !== 'undefined' ? MP_BYPASS_SIGNATURE : false,
    }),
    stripe: null,
    paypal: null,
  };

  return providers;
}

export type { CheckoutParams, CheckoutResult, PaymentProvider, WebhookResult } from './provider';
