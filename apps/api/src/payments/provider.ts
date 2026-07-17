import type { PurchaseStatus } from '@sonora/shared';

export interface CheckoutParams {
  purchaseId: string;
  experienceTitle: string;
  amount: number;
  currency: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  notificationUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerPaymentId: string;
}

export interface WebhookResult {
  event: PurchaseStatus;
  providerPaymentId: string;
  email: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  processWebhook(
    payload: unknown,
    headers: Record<string, string>,
    dataId: string,
  ): Promise<WebhookResult>;
  getPaymentStatus(
    providerPaymentId: string,
    externalReference?: string,
  ): Promise<{
    status: PurchaseStatus;
    email?: string;
    amount?: number;
    currency?: string;
  }>;
}
