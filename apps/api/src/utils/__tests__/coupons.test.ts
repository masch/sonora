import { describe, it, expect } from 'vitest';
import { normalizeEmail, maskEmail, hashEmail } from '../coupons';

describe('coupons utils', () => {
  describe('normalizeEmail', () => {
    it('trims and converts email to lowercase', () => {
      expect(normalizeEmail('  User.Name@Example.COM  ')).toBe('user.name@example.com');
    });
  });

  describe('maskEmail', () => {
    it('masks standard email addresses properly', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com');
      expect(maskEmail('maria@gmail.com')).toBe('m***a@gmail.com');
    });

    it('masks short local parts', () => {
      expect(maskEmail('ab@test.com')).toBe('a***@test.com');
      expect(maskEmail('a@test.com')).toBe('a***@test.com');
    });

    it('returns *** for invalid input with no @', () => {
      expect(maskEmail('notanemail')).toBe('***');
    });
  });

  describe('hashEmail', () => {
    it('generates consistent HMAC-SHA256 hex string', async () => {
      const hash1 = await hashEmail('user@example.com', 'test-secret');
      const hash2 = await hashEmail('USER@EXAMPLE.COM ', 'test-secret');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('generates different hashes for different secrets', async () => {
      const hash1 = await hashEmail('user@example.com', 'secret-1');
      const hash2 = await hashEmail('user@example.com', 'secret-2');
      expect(hash1).not.toBe(hash2);
    });
  });
});
