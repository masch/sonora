import type { CheckoutParams, CheckoutResult, WebhookResult, PaymentProvider } from './provider';
import { MercadoPagoProvider } from './mercadopago';
import type { Env } from '../index';

export function createPaymentProviders(env: Env): Record<string, PaymentProvider | null> {
  const providers: Record<string, PaymentProvider | null> = {
    mercadopago: new MercadoPagoProvider({
      accessToken: env.MERCADO_PAGO_ACCESS_TOKEN || '',
      webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET || '',
    }),
    stripe: null,
    paypal: null,
  };

  return providers;
}

export type { PaymentProvider } from './provider';
export type { CheckoutParams, CheckoutResult, WebhookResult } from './provider';
