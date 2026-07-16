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

export const DEEP_LINK_SCHEME = 'sonora://';
