import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export async function validateMercadoPagoSignature(
  headers: Record<string, string>,
  dataId: string,
  secret: string,
  maxAgeMinutes?: number,
): Promise<ValidationResult> {
  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];

  if (!xSignature) {
    return { valid: false, reason: 'Missing X-Signature header' };
  }
  if (!xRequestId) {
    return { valid: false, reason: 'Missing x-request-id header' };
  }
  if (!dataId) {
    return { valid: false, reason: 'Missing data.id' };
  }

  // Replay window check — handled before the SDK because the SDK's ts comparison
  // expects milliseconds (Date.now()) but MP sends ts in seconds.
  const tsMatch = xSignature.match(/ts=(\d+)/);
  if (tsMatch) {
    const ts = parseInt(tsMatch[1], 10);
    if (!isNaN(ts)) {
      const maxAge = maxAgeMinutes !== undefined && maxAgeMinutes > 0 ? maxAgeMinutes : 5;
      const tsMs = ts * 1000; // MP ts is in seconds, convert to ms
      const driftMs = Math.abs(Date.now() - tsMs);
      if (driftMs > maxAge * 60 * 1000) {
        return { valid: false, reason: 'Signature timestamp outside allowed window' };
      }
    }
  }

  // Use the official MP SDK for HMAC validation (constant-time comparison)
  // Don't pass toleranceSeconds — the SDK compares ts (seconds) against
  // Date.now() (ms) which would always fail. We handle replay above.
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
    return { valid: true };
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return { valid: false, reason: error.message || 'Invalid HMAC signature' };
    }
    throw error;
  }
}
