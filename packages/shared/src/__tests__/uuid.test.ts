import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateUuid } from '../utils/uuid';

describe('generateUuid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate a string of correct length', () => {
    const uuid = generateUuid();
    expect(typeof uuid).toBe('string');
    expect(uuid.length).toBe(36);
  });

  it('should match RFC 4122 v4 UUID format', () => {
    const uuid = generateUuid();
    // Regex for v4 UUID format (version 4 indicator, 8/9/a/b variant indicator)
    const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(v4Regex);
  });

  it('should generate unique values', () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUuid());
    }
    expect(uuids.size).toBe(100);
  });

  it('should use crypto.randomUUID when available', () => {
    const mockUUID = '11111111-2222-4333-8444-555555555555';

    // Temporarily mock global crypto
    const originalCrypto = globalThis.crypto;
    const mockCrypto = {
      randomUUID: vi.fn(() => mockUUID),
      subtle: originalCrypto?.subtle,
    } as unknown as Crypto;

    Object.defineProperty(globalThis, 'crypto', {
      value: mockCrypto,
      configurable: true,
      writable: true,
    });

    try {
      const result = generateUuid();
      expect(mockCrypto.randomUUID).toHaveBeenCalled();
      expect(result).toBe(mockUUID);
    } finally {
      // Restore original crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    }
  });

  it('should fallback to manual generation when crypto.randomUUID is not present', () => {
    const originalCrypto = globalThis.crypto;

    // Define a crypto object without randomUUID
    Object.defineProperty(globalThis, 'crypto', {
      value: { subtle: originalCrypto?.subtle } as unknown as Crypto,
      configurable: true,
      writable: true,
    });

    try {
      const uuid = generateUuid();
      const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(v4Regex);
    } finally {
      // Restore original crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    }
  });
});
