import { en } from '@/i18n/locales/en';

describe('en translations', () => {
  it('has all required top-level namespaces', () => {
    const namespaces = Object.keys(en);
    expect(namespaces).toContain('common');
    expect(namespaces).toContain('tabs');
    expect(namespaces).toContain('index');
    expect(namespaces).toContain('explore');
    expect(namespaces).toContain('settings');
  });

  it('has non-empty string values for all translation keys', () => {
    const checkValues = (obj: Record<string, unknown>, path = ''): string[] => {
      const empty: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (typeof value === 'string') {
          if (value.trim() === '') empty.push(fullPath);
        } else if (typeof value === 'object' && value !== null) {
          empty.push(...checkValues(value as Record<string, unknown>, fullPath));
        }
      }
      return empty;
    };
    const emptyKeys = checkValues(en);
    expect(emptyKeys).toEqual([]);
  });
});

