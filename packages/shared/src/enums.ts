export const PURCHASE_STATUSES = ['pending', 'approved', 'rejected', 'refunded'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const ACCESS_SOURCES = ['free', 'paid', 'restored'] as const;
export type AccessSource = (typeof ACCESS_SOURCES)[number];

export const PLATFORMS = ['ios', 'android', 'web'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CURRENCIES = ['ARS'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PAYMENT_PROVIDERS = ['mercadopago', 'stripe', 'paypal'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const PAYMENT_PREFIX = '/payments';

export const PAYMENT_ROUTES = {
  PREFIX: PAYMENT_PREFIX,
  CALLBACK: `${PAYMENT_PREFIX}/callback`,
  CREATE: `${PAYMENT_PREFIX}/create`,
  WEBHOOK: `${PAYMENT_PREFIX}/webhook`,
  PURCHASES: `${PAYMENT_PREFIX}/purchases`,
  RETURN: `${PAYMENT_PREFIX}/return`,
  STATUS: `${PAYMENT_PREFIX}/status`,
  status: (purchaseId: string) => `${PAYMENT_PREFIX}/status/${purchaseId}` as const,
  returnStatus: (status: string, purchaseId: string) =>
    `${PAYMENT_PREFIX}/return/${status}/${purchaseId}` as const,
  nativeRedirect: (status: string, purchaseId: string, scheme: string) =>
    `${scheme}://${PAYMENT_PREFIX.slice(1)}/${status}/${purchaseId}` as const,
  nativeCallback: (scheme: string) => `${scheme}://${PAYMENT_PREFIX.slice(1)}/callback` as const,
  // Resource domain grouping (scalable for future resources like EVENTS, SUBSCRIPTIONS, etc.)
  EXPERIENCES: {
    PREFIX: `${PAYMENT_PREFIX}/experiences`,
    purchased: (experienceId: string) =>
      `${PAYMENT_PREFIX}/experiences/${experienceId}/purchased` as const,
    access: (experienceId: string) =>
      `${PAYMENT_PREFIX}/experiences/${experienceId}/access` as const,
  },
} as const;
