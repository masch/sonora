import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { createPaymentProviders } from '../payments';

export const paymentsGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const providers = createPaymentProviders(c.env || {});
    const defaultProvider = (c.env?.DEFAULT_PAYMENT_PROVIDER || 'mercadopago') as
      'mercadopago' | 'stripe' | 'paypal';
    c.set('paymentProviders', providers);
    c.set('defaultPaymentProvider', defaultProvider);
    await next();
  };
};
