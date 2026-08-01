/**
 * SHA-256 hash a string value.
 * Uses Web Crypto API (available in modern browsers, Bun, Node.js).
 * Returns lowercase 64-character hex digest.
 */
export async function sha256(value: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
