import type { PaymentProvider, CheckoutParams, CheckoutResult, WebhookResult } from './provider';
import { HttpClient } from '../lib/http-client';

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';
  private client: HttpClient;

  constructor(
    private config: {
      accessToken: string;
      webhookSecret: string;
    },
  ) {
    this.client = new HttpClient({
      baseUrl: 'https://api.mercadopago.com',
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      timeout: 10_000,
    });
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const data = await this.client.post<{
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
    }>('/checkout/preferences', {
      items: [
        {
          title: params.experienceTitle,
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency,
        },
      ],
      external_reference: params.purchaseId,
      back_urls: {
        success: params.backUrls.success,
        failure: params.backUrls.failure,
        pending: params.backUrls.pending,
      },
      notification_url: params.notificationUrl,
      auto_return: 'approved',
    });

    return {
      checkoutUrl: data.sandbox_init_point || data.init_point || '',
      providerPaymentId: data.id,
    };
  }

  async processWebhook(payload: unknown, _headers: Record<string, string>): Promise<WebhookResult> {
    const body = payload as { type?: string; data?: { id?: string } };

    // Only process payment notifications
    if (body.type !== 'payment' || !body.data?.id) {
      throw new Error('Ignored non-payment notification');
    }

    // Fetch payment details from MP API
    const paymentId = body.data.id;
    const payment = await this.client.get<{
      id: number;
      status: string;
      payer?: { email?: string; id?: string };
      transaction_amount?: number;
      currency_id?: string;
      payment_method_id?: string;
      payment_type_id?: string;
      installments?: number;
      installment_amount?: number;
      transaction_details?: {
        net_received_amount?: number;
        overpaid_amount?: number;
        total_paid_amount?: number;
      };
    }>(`/v1/payments/${paymentId}`);

    return {
      event: this.mapStatus(payment.status),
      providerPaymentId: String(payment.id),
      email: payment.payer?.email || '',
      amount: payment.transaction_amount || 0,
      currency: payment.currency_id || 'ARS',
      metadata: {
        payment_method_id: payment.payment_method_id,
        payment_type_id: payment.payment_type_id,
        installments: payment.installments,
        installment_amount: payment.installment_amount,
        payer_id: payment.payer?.id,
        transaction_details: payment.transaction_details,
      },
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<{
    status: 'approved' | 'pending' | 'rejected' | 'refunded';
    email?: string;
    amount?: number;
    currency?: string;
  }> {
    const payment = await this.client.get<{
      status: string;
      payer?: { email?: string };
      transaction_amount?: number;
      currency_id?: string;
    }>(`/v1/payments/${providerPaymentId}`);

    return {
      status: this.mapStatus(payment.status),
      email: payment.payer?.email,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    };
  }

  private mapStatus(mpStatus: string): 'approved' | 'pending' | 'rejected' | 'refunded' {
    switch (mpStatus) {
      case 'approved':
        return 'approved';
      case 'pending':
      case 'in_process':
      case 'in_mediation':
        return 'pending';
      case 'rejected':
      case 'cancelled':
      case 'charged_back':
        return 'rejected';
      case 'refunded':
        return 'refunded';
      default:
        return 'pending';
    }
  }
}
