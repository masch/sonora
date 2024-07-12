import { ApiClient } from '@/services/api-client';
import type { AccessSource } from '@sonora/shared';
import { logger } from '@/utils/logger';

export interface CreatePaymentResponse {
  purchaseId: string;
  checkoutUrl: string;
}

export interface PaymentStatusResponse {
  purchaseId: string;
  status: string;
  experienceId: string;
  provider: string;
  amount: number;
  currency: string;
  email?: string;
}

export interface PurchasedResponse {
  purchased: boolean;
  purchase?: {
    purchaseId: string;
    status: string;
    provider: string;
    amount: number;
    currency: string;
    purchasedAt: string;
  };
}

export interface PurchaseRecord {
  purchaseId: string;
  experienceId: string;
  experienceTitle: string;
  experienceSlug: string;
  status: string;
  provider: string;
  amount: number;
  currency: string;
  purchasedAt: string;
}

export interface PurchasesListResponse {
  purchases: PurchaseRecord[];
}

export const PaymentClient = {
  async createPayment(experienceId: string): Promise<CreatePaymentResponse> {
    return ApiClient.post<CreatePaymentResponse>('/payments/create', { experienceId });
  },

  async getPaymentStatus(purchaseId: string): Promise<PaymentStatusResponse> {
    return ApiClient.get<PaymentStatusResponse>(`/payments/status/${purchaseId}`);
  },

  async checkPurchased(experienceId: string, email: string): Promise<PurchasedResponse> {
    return ApiClient.get<PurchasedResponse>(
      `/experiences/${experienceId}/purchased?email=${encodeURIComponent(email)}`,
    );
  },

  async listPurchases(email: string): Promise<PurchasesListResponse> {
    return ApiClient.get<PurchasesListResponse>(`/purchases?email=${encodeURIComponent(email)}`);
  },

  async logAccess(
    experienceId: string,
    source: AccessSource,
    email?: string,
    platform?: string,
  ): Promise<void> {
    // Fire-and-forget — never block user interaction
    ApiClient.post(`/experiences/${experienceId}/access`, {
      source,
      email,
      platform,
    }).catch(() => {
      logger.warn('[PaymentClient] Failed to log access');
    });
  },
};
