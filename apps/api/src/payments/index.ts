import type { Env } from '../index';
import { MercadoPagoProvider } from './mercadopago';
import type { PaymentProvider } from './provider';

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

export type { CheckoutParams, CheckoutResult, PaymentProvider, WebhookResult } from './provider';
