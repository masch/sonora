import { en } from '../locales/en';
import { es } from '../locales/es';

describe('Admin i18n', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    (globalThis as unknown as { navigator: unknown }).navigator = originalNavigator;
  });

  it('contains expected namespaces in en and es locales', () => {
    expect(en.common).toBeDefined();
    expect(en.login).toBeDefined();
    expect(en.dashboard).toBeDefined();

    expect(es.common).toBeDefined();
    expect(es.login).toBeDefined();
    expect(es.dashboard).toBeDefined();
  });

  it('initializes with fallback language if window/navigator are undefined', () => {
    delete (globalThis as unknown as Record<string, unknown>).window;
    delete (globalThis as unknown as Record<string, unknown>).navigator;

    const i18nInstance = jest.requireActual('../index').default;
    expect(i18nInstance.language).toBe('en');
  });

  it('detects spanish language from navigator', () => {
    delete (globalThis as unknown as Record<string, unknown>).window;
    (globalThis as unknown as { navigator: unknown }).navigator = {
      language: 'es-ES',
    } as unknown as Navigator;

    const i18nInstance = jest.requireActual('../index').default;
    expect(i18nInstance.language).toBe('es');
  });

  it('detects spanish language from URL query parameter lng', () => {
    (globalThis as unknown as { window: unknown }).window = {
      location: {
        search: '?lng=es',
      },
    } as unknown as Window & typeof globalThis;
    (globalThis as unknown as { navigator: unknown }).navigator = {
      language: 'en-US',
    } as unknown as Navigator;

    const i18nInstance = jest.requireActual('../index').default;
    expect(i18nInstance.language).toBe('es');
  });

  it('detects english language from URL query parameter lang', () => {
    (globalThis as unknown as { window: unknown }).window = {
      location: {
        search: '?lang=en',
      },
    } as unknown as Window & typeof globalThis;
    (globalThis as unknown as { navigator: unknown }).navigator = {
      language: 'es-ES',
    } as unknown as Navigator;

    const i18nInstance = jest.requireActual('../index').default;
    expect(i18nInstance.language).toBe('en');
  });
});
