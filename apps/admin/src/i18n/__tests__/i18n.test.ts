import { en } from '../locales/en';
import { es } from '../locales/es';

describe('Admin i18n', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    // @ts-ignore
    globalThis.window = originalWindow;
    // @ts-ignore
    globalThis.navigator = originalNavigator;
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
    // @ts-ignore
    delete globalThis.window;
    // @ts-ignore
    delete globalThis.navigator;

    const i18nInstance = require('../index').default;
    expect(i18nInstance.language).toBe('en');
  });

  it('detects spanish language from navigator', () => {
    // @ts-ignore
    delete globalThis.window;
    // @ts-ignore
    globalThis.navigator = {
      language: 'es-ES',
    } as any;

    const i18nInstance = require('../index').default;
    expect(i18nInstance.language).toBe('es');
  });

  it('detects spanish language from URL query parameter lng', () => {
    // @ts-ignore
    globalThis.window = {
      location: {
        search: '?lng=es',
      },
    } as any;
    // @ts-ignore
    globalThis.navigator = {
      language: 'en-US',
    } as any;

    const i18nInstance = require('../index').default;
    expect(i18nInstance.language).toBe('es');
  });

  it('detects english language from URL query parameter lang', () => {
    // @ts-ignore
    globalThis.window = {
      location: {
        search: '?lang=en',
      },
    } as any;
    // @ts-ignore
    globalThis.navigator = {
      language: 'es-ES',
    } as any;

    const i18nInstance = require('../index').default;
    expect(i18nInstance.language).toBe('en');
  });
});
