import type { Context } from 'hono';

export interface ClientMetadata {
  ipAddress: string;
  userAgent: string;
}

export const UNKNOWN_CLIENT_METADATA = 'unknown';

/**
 * Extracts client network metadata (IP address and User-Agent) from HTTP headers,
 * defaulting to 'unknown' when headers are missing or blank.
 */
export function getClientMetadata(c: Context): ClientMetadata {
  const cfIp = c.req.header('cf-connecting-ip')?.trim();
  const forwardedIp = c.req.header('x-forwarded-for')?.split(',')[0].trim();

  const ipAddress = cfIp || forwardedIp || UNKNOWN_CLIENT_METADATA;
  const userAgent = c.req.header('user-agent')?.trim() || UNKNOWN_CLIENT_METADATA;

  return {
    ipAddress,
    userAgent,
  };
}
