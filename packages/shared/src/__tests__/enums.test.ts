import { describe, expect, it } from 'vitest';
import {
  ACCESS_SOURCES,
  CURRENCIES,
  PAYMENT_PROVIDERS,
  PAYMENT_ROUTES,
  PLATFORMS,
  PURCHASE_STATUSES,
  SUPPORTED_LANGUAGES,
} from '../enums';

describe('enums & PAYMENT_ROUTES', () => {
  describe('PAYMENT_ROUTES static paths', () => {
    it('defines expected route prefixes and endpoints', () => {
      expect(PAYMENT_ROUTES.PREFIX).toBe('/payments');
      expect(PAYMENT_ROUTES.CALLBACK).toBe('/payments/callback');
      expect(PAYMENT_ROUTES.CREATE).toBe('/payments/create');
      expect(PAYMENT_ROUTES.WEBHOOK).toBe('/payments/webhook');
      expect(PAYMENT_ROUTES.PURCHASES).toBe('/payments/purchases');
      expect(PAYMENT_ROUTES.RETURN).toBe('/payments/return');
      expect(PAYMENT_ROUTES.STATUS).toBe('/payments/status');
    });
  });

  describe('PAYMENT_ROUTES dynamic helpers', () => {
    it('generates status endpoint path', () => {
      expect(PAYMENT_ROUTES.status('p-123')).toBe('/payments/status/p-123');
    });

    it('generates returnStatus endpoint path', () => {
      expect(PAYMENT_ROUTES.returnStatus('success', 'p-123')).toBe(
        '/payments/return/success/p-123',
      );
    });

    it('generates nativeRedirect URI with explicit scheme', () => {
      expect(PAYMENT_ROUTES.nativeRedirect('success', 'p-123', 'sonora')).toBe(
        'sonora://payments/success/p-123',
      );
      expect(PAYMENT_ROUTES.nativeRedirect('success', 'p-123', 'sonora-staging')).toBe(
        'sonora-staging://payments/success/p-123',
      );
    });

    it('generates nativeCallback URI with explicit scheme', () => {
      expect(PAYMENT_ROUTES.nativeCallback('sonora')).toBe('sonora://payments/callback');
      expect(PAYMENT_ROUTES.nativeCallback('sonora-staging')).toBe(
        'sonora-staging://payments/callback',
      );
    });
  });

  describe('PAYMENT_ROUTES.EXPERIENCES resource namespace', () => {
    it('generates resource-specific payment endpoints', () => {
      expect(PAYMENT_ROUTES.EXPERIENCES.PREFIX).toBe('/payments/experiences');
      expect(PAYMENT_ROUTES.EXPERIENCES.purchased('exp-456')).toBe(
        '/payments/experiences/exp-456/purchased',
      );
      expect(PAYMENT_ROUTES.EXPERIENCES.access('exp-456')).toBe(
        '/payments/experiences/exp-456/access',
      );
    });
  });

  describe('domain enum constants', () => {
    it('contains expected enum values', () => {
      expect(PURCHASE_STATUSES).toEqual(['pending', 'approved', 'rejected', 'refunded']);
      expect(ACCESS_SOURCES).toEqual(['free', 'paid', 'restored']);
      expect(PLATFORMS).toEqual(['ios', 'android', 'web']);
      expect(CURRENCIES).toEqual(['ARS']);
      expect(PAYMENT_PROVIDERS).toEqual(['mercadopago', 'stripe', 'paypal']);
      expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es']);
    });
  });
});
