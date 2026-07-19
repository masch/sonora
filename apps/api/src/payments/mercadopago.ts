import { logger } from '@sonora/shared';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import type { CheckoutParams, CheckoutResult, PaymentProvider, WebhookResult } from './provider';
import { validateMercadoPagoSignature } from './signature';

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';
  readonly signatureMaxAgeMinutes: number;
  private client: MercadoPagoConfig;
  private preferenceClient: Preference;
  private paymentClient: Payment;

  constructor(
    private config: {
      accessToken: string;
      webhookSecret: string;
      environment: string;
      bypassSignature: boolean;
      signatureMaxAgeMinutes: number;
    },
  ) {
    if (!config.accessToken) {
      throw new TypeError('MercadoPagoProvider: accessToken is required');
    }
    if (!config.webhookSecret) {
      throw new TypeError('MercadoPagoProvider: webhookSecret is required');
    }
    this.signatureMaxAgeMinutes = config.signatureMaxAgeMinutes;
    this.client = new MercadoPagoConfig({
      accessToken: this.config.accessToken,
      options: { timeout: 10000 },
    });
    this.preferenceClient = new Preference(this.client);
    this.paymentClient = new Payment(this.client);
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const result = await this.preferenceClient.create({
      body: {
        items: [
          {
            id: params.purchaseId,
            title: params.experienceTitle,
            quantity: 1,
            unit_price: Math.round(params.amount / 100),
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
      },
    });

    return {
      checkoutUrl:
        this.config.environment === 'production'
          ? result.init_point || ''
          : result.sandbox_init_point || '',
      providerPaymentId: result.id || '',
    };
  }

  async processWebhook(
    payload: unknown,
    headers: Record<string, string>,
    dataId: string,
  ): Promise<WebhookResult> {
    const body = payload as { type?: string; data?: { id?: string } };

    // Only process payment notifications
    if (body.type !== 'payment') {
      throw new Error('Ignored non-payment notification');
    }
    if (!dataId) {
      throw new Error('Missing data.id');
    }

    // Validate X-Signature before fetching payment details
    // MP computes the HMAC using data.id from query params, not the body
    const validation = await validateMercadoPagoSignature(
      headers,
      dataId,
      this.config.webhookSecret,
      this.signatureMaxAgeMinutes,
    );
    if (!validation.valid) {
      logger.warn('[METRIC:invalid_signature_total] Invalid signature', {
        ts: headers['x-signature']?.match(/ts=([^,]+)/)?.[1] || 'unknown',
        'x-request-id': headers['x-request-id'] || 'unknown',
        'data.id': dataId,
        reason: validation.reason,
      });
      if (this.config.bypassSignature) {
        // Safety net: never bypass in production, even if the flag is somehow set
        if (this.config.environment === 'production') {
          throw new Error('CRITICAL: mpSkipSignature is active in production');
        }
        logger.warn('[WEBHOOK] Bypassing MP signature validation for staging');
      } else {
        throw new Error('Invalid signature');
      }
    }

    const paymentId = dataId;
    const payment = await this.paymentClient.get({ id: paymentId });

    if (!payment.external_reference) {
      throw new Error('MP payment missing external_reference — was this purchase created by us?');
    }

    return {
      event: this.mapStatus(payment.status || ''),
      providerPaymentId: String(payment.id),
      externalReference: payment.external_reference,
      email: payment.payer?.email || '',
      amount: payment.transaction_amount || 0,
      currency: payment.currency_id || 'ARS',
      metadata: {
        preference_id: payment.external_reference,
        payment_method_id: payment.payment_method_id,
        payment_type_id: payment.payment_type_id,
        installments: payment.installments,
        installment_amount: (
          payment as Awaited<ReturnType<Payment['get']>> & { installment_amount?: number }
        ).installment_amount,
        payer_id: payment.payer?.id,
        transaction_details: payment.transaction_details,
      },
    };
  }

  async getPaymentStatus(
    providerPaymentId: string,
    externalReference?: string,
  ): Promise<{
    status: 'approved' | 'pending' | 'rejected' | 'refunded';
    email?: string;
    amount?: number;
    currency?: string;
  }> {
    let payment: any = null;

    if (externalReference) {
      try {
        const searchResult = await this.paymentClient.search({
          options: {
            external_reference: externalReference,
          },
        });
        const paymentsList = searchResult.results || [];
        if (paymentsList.length > 0) {
          payment = paymentsList[0];
        }
      } catch (err) {
        logger.warn('Failed to search payment by external_reference:', err);
      }
    }

    if (!payment) {
      try {
        payment = await this.paymentClient.get({ id: providerPaymentId });
      } catch (err) {
        logger.warn('Fetch failed, treating as pending:', err);
        // If the ID is a preference ID or payment doesn't exist yet, return pending status
        return {
          status: 'pending',
        };
      }
    }

    return {
      status: this.mapStatus(payment.status || ''),
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
