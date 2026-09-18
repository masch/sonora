import { renderHook } from '@testing-library/react-native';
import { resolveLanguage, useAppTranslation } from '../use-translation';

describe('resolveLanguage', () => {
  it('resolves exact match supported languages', () => {
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('es')).toBe('es');
  });

  it('resolves case-insensitively', () => {
    expect(resolveLanguage('EN')).toBe('en');
    expect(resolveLanguage('ES')).toBe('es');
    expect(resolveLanguage('EN-us')).toBe('en');
    expect(resolveLanguage('ES-ar')).toBe('es');
  });

  it('resolves locale tags with regions or scripts to base language', () => {
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('en_GB')).toBe('en');
    expect(resolveLanguage('es-AR')).toBe('es');
    expect(resolveLanguage('es-ES')).toBe('es');
    expect(resolveLanguage('es_419')).toBe('es');
  });

  it('falls back to es for unsupported languages or empty values', () => {
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

describe('useAppTranslation', () => {
  it('returns typed t function and resolved language from i18n', async () => {
    const { result } = await renderHook(() => useAppTranslation());
    expect(typeof result.current.t).toBe('function');
    expect(result.current.language).toBe('en');
    expect(result.current.t('common.retry')).toBe('common.retry');
  });
});
