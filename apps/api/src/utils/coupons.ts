/**
 * Utilities for coupon email hashing and masking.
 *
 * Uses HMAC-SHA256 via Web Crypto API (supported in Cloudflare Workers and Node 18+)
 * so that email addresses are never stored in plain text in the database (blind index).
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return '***';

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  const firstChar = localPart[0];
  const lastChar = localPart[localPart.length - 1];
  return `${firstChar}***${lastChar}@${domain}`;
}

export async function hashEmail(email: string, secret: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(normalized));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
