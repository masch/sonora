import { describe, expect, it } from 'vitest';
import {
  ACCESS_SOURCES,
  CURRENCIES,
  DEFAULT_LANGUAGE,
  PAYMENT_PROVIDERS,
  PAYMENT_ROUTES,
  PLATFORMS,
  PURCHASE_STATUSES,
  resolveLanguage,
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

  describe('PAYMENT_ROUTES dynamic helpers with all PURCHASE_STATUSES combinations', () => {
    it.each(PURCHASE_STATUSES)('generates returnStatus for purchase status %s', (status) => {
      expect(PAYMENT_ROUTES.returnStatus(status, 'p-456')).toBe(`/payments/return/${status}/p-456`);
    });

    it.each(PURCHASE_STATUSES)(
      'generates nativeRedirect for purchase status %s across production and staging schemes',
      (status) => {
        expect(PAYMENT_ROUTES.nativeRedirect(status, 'p-456', 'sonora')).toBe(
          `sonora://payments/${status}/p-456`,
        );
        expect(PAYMENT_ROUTES.nativeRedirect(status, 'p-456', 'sonora-staging')).toBe(
          `sonora-staging://payments/${status}/p-456`,
        );
      },
    );
  });

  describe('domain enum constants', () => {
    it('contains expected enum values', () => {
      expect(PURCHASE_STATUSES).toEqual(['pending', 'approved', 'rejected', 'refunded']);
      expect(ACCESS_SOURCES).toEqual(['free', 'paid', 'restored']);
      expect(PLATFORMS).toEqual(['ios', 'android', 'web']);
      expect(CURRENCIES).toEqual(['ARS']);
      expect(PAYMENT_PROVIDERS).toEqual(['mercadopago', 'stripe', 'paypal']);
      expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es']);
      expect(DEFAULT_LANGUAGE).toBe('es');
    });
  });

  describe('resolveLanguage', () => {
    it('resolves exact match supported languages', () => {
      expect(resolveLanguage('en')).toBe('en');
      expect(resolveLanguage('es')).toBe('es');
    });

    it('resolves case-insensitively', () => {
      expect(resolveLanguage('EN')).toBe('en');
      expect(resolveLanguage('ES')).toBe('es');
      expect(resolveLanguage('En')).toBe('en');
      expect(resolveLanguage('Es')).toBe('es');
      expect(resolveLanguage('EN-us')).toBe('en');
      expect(resolveLanguage('ES-ar')).toBe('es');
    });

    it('resolves language tags with regions or scripts to base language', () => {
      expect(resolveLanguage('en-US')).toBe('en');
      expect(resolveLanguage('en_GB')).toBe('en');
      expect(resolveLanguage('es-AR')).toBe('es');
      expect(resolveLanguage('es-ES')).toBe('es');
      expect(resolveLanguage('es_419')).toBe('es');
    });

    it('falls back to DEFAULT_LANGUAGE (es) for unsupported or empty values', () => {
      expect(resolveLanguage('fr')).toBe('es');
      expect(resolveLanguage('de-DE')).toBe('es');
      expect(resolveLanguage('pt-BR')).toBe('es');
      expect(resolveLanguage('')).toBe('es');
      expect(resolveLanguage(null)).toBe('es');
      expect(resolveLanguage(undefined)).toBe('es');
      expect(resolveLanguage('123')).toBe('es');
      expect(resolveLanguage('---')).toBe('es');
    });
  });
});
