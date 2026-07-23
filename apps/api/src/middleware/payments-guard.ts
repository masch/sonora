import type { MiddlewareHandler } from 'hono';
import { APP_IDENTIFIERS } from '@sonora/shared';
import type { Env, Variables } from '../index';
import { createPaymentProviders } from '../payments';

const SCHEME_BY_ENVIRONMENT: Record<string, string> = {
  staging: APP_IDENTIFIERS.staging.scheme,
  production: APP_IDENTIFIERS.production.scheme,
};

export const paymentsGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const providers = createPaymentProviders(c.env || {});
    const defaultProvider = (c.env?.DEFAULT_PAYMENT_PROVIDER || 'mercadopago') as
      'mercadopago' | 'stripe' | 'paypal';
    const env = c.env?.ENVIRONMENT || 'production';
    const appScheme =
      c.env?.APP_SCHEME || SCHEME_BY_ENVIRONMENT[env] || APP_IDENTIFIERS.production.scheme;
    c.set('paymentProviders', providers);
    c.set('defaultPaymentProvider', defaultProvider);
    c.set('appScheme', appScheme);
    await next();
  };
};
