import { describe, it, expect } from 'vitest';
import { flatten, setNested, serializeToTS, renderTSFile, diffFlat } from '../sync-helpers';

describe('flatten', () => {
  it('flattens a simple nested object', () => {
    const input = { common: { learnMore: 'Learn more', dismiss: 'Dismiss' } };
    expect(flatten(input)).toEqual({
      'common.learnMore': 'Learn more',
      'common.dismiss': 'Dismiss',
    });
  });

  it('flattens deeply nested objects', () => {
    const input = { a: { b: { c: 'deep' } } };
    expect(flatten(input)).toEqual({ 'a.b.c': 'deep' });
  });

  it('returns empty object for empty input', () => {
    expect(flatten({})).toEqual({});
  });

  it('skips arrays', () => {
    const input = { items: ['a', 'b'] as unknown as Record<string, unknown> };
    expect(flatten(input)).toEqual({});
  });

  it('handles multiple top-level keys', () => {
    const input = {
      common: { learnMore: 'Learn' },
      map: { title: 'Map' },
    };
    expect(flatten(input)).toEqual({
      'common.learnMore': 'Learn',
      'map.title': 'Map',
    });
  });
});

describe('setNested', () => {
  it('sets a value in an empty object', () => {
    const obj: Record<string, unknown> = {};
    setNested(obj, 'common.learnMore', 'Learn more');
    expect(obj).toEqual({ common: { learnMore: 'Learn more' } });
  });

  it('overwrites an existing value', () => {
    const obj = { common: { learnMore: 'Old' } };
    setNested(obj, 'common.learnMore', 'New');
    expect(obj).toEqual({ common: { learnMore: 'New' } });
  });

  it('creates multiple nesting levels', () => {
    const obj: Record<string, unknown> = {};
    setNested(obj, 'a.b.c.d', 'deep');
    expect(obj).toEqual({ a: { b: { c: { d: 'deep' } } } });
  });

  it('preserves existing siblings', () => {
    const obj = { common: { learnMore: 'Learn' } };
    setNested(obj, 'common.dismiss', 'Dismiss');
    expect(obj).toEqual({ common: { learnMore: 'Learn', dismiss: 'Dismiss' } });
  });
});

describe('serializeToTS', () => {
  it('serializes a flat object with indent=0 yields 2-space indent', () => {
    const input = { key: 'value' };
    const result = serializeToTS(input, 0);
    expect(result).toBe("  key: 'value',");
  });

  it('nested children indent +1 level (2 spaces) each', () => {
    const input = { a: { b: { c: 'deep' } } };
    const result = serializeToTS(input, 0);
    const lines = result.split('\n');
    // 0: "  a: {"
    // 1: "    b: {"
    // 2: "      c: 'deep',"
    // 3: "    },"
    // 4: "  },"
    expect(lines[0]).toBe('  a: {');
    expect(lines[1]).toBe('    b: {');
    expect(lines[2]).toBe("      c: 'deep',");
    expect(lines[3]).toBe('    },');
    expect(lines[4]).toBe('  },');
  });

  it('uses double quotes when value contains single quotes', () => {
    const input = { key: "it's fine" };
    const result = serializeToTS(input, 0);
    expect(result).toContain('key: "it\'s fine",');
  });

  it('uses single quotes when value has no single quotes', () => {
    const input = { key: 'hello world' };
    const result = serializeToTS(input, 0);
    expect(result).toContain("key: 'hello world',");
  });

  it('escapes newlines in multiline values', () => {
    const input = { overlayTitle: 'SONORA\nGUIDED' };
    const result = serializeToTS(input, 0);
    // Must produce a valid single-line TS string, not literal newlines
    expect(result).toBe("  overlayTitle: 'SONORA\\nGUIDED',");
    expect(result.split('\n')).toHaveLength(1);
  });
});

describe('renderTSFile', () => {
  it('renders a complete .ts file with as const and type export', () => {
    const input = { key: 'value' };
    const result = renderTSFile('en', input);
    expect(result).toContain('export const en = {');
    expect(result).toContain("key: 'value',");
    expect(result).toContain('} as const;');
    expect(result).toContain('export type EnDict = typeof en;');
  });

  it('preserves 2-space indentation across the full file', () => {
    const input = { a: { b: { c: 'deep' } } };
    const result = renderTSFile('en', input);
    const lines = result.split('\n');
    // Line 0: "export const en = {"
    // Line 1:  2 spaces = "  a: {"
    // Line 2:  4 spaces = "    b: {"
    // Line 3:  6 spaces = "      c: 'deep',"
    // Line 4:  4 spaces = "    },"
    // Line 5:  2 spaces = "  },"
    // Line 6: "} as const;"
    expect(lines[0]).toBe('export const en = {');
    expect(lines[1]).toBe('  a: {');
    expect(lines[2]).toBe('    b: {');
    expect(lines[3]).toBe("      c: 'deep',");
    expect(lines[4]).toBe('    },');
    expect(lines[5]).toBe('  },');
    expect(lines[6]).toBe('} as const;');
    expect(lines[lines.length - 1]).toBe('');
  });

  it('full pipeline: flatten -> merge -> render produces minimal diff', () => {
    // Simulate a locale file with one DB override
    const original = {
      common: { learnMore: 'Learn more', dismiss: 'Dismiss' },
      home: { instructionsName: 'How to use Sonora' },
    };
    const dbOverrides = { 'home.instructionsName': 'How to use web' };

    // Merge DB override into original
    const merged = structuredClone(original);
    for (const [key, value] of Object.entries(dbOverrides)) {
      setNested(merged, key, value);
    }

    const result = renderTSFile('en', merged);

    // Should not reformat — indent remains 2-space
    expect(result).toContain('  common: {');
    expect(result).toContain("    learnMore: 'Learn more',");
    expect(result).toContain('  home: {');
    expect(result).toContain("    instructionsName: 'How to use web',");

    // Only the overridden key has 'web'
    expect(result).toContain("instructionsName: 'How to use web'");
    expect(result).not.toContain("instructionsName: 'How to use Sonora'");

    // Preserves as const and type export
    expect(result).toContain('} as const;');
    expect(result).toContain('export type EnDict = typeof en;');
  });
});

describe('diffFlat', () => {
  it('returns empty when maps are identical', () => {
    const base = { 'common.learnMore': 'Learn' };
    const overlay = { 'common.learnMore': 'Learn' };
    expect(diffFlat(base, overlay)).toEqual({});
  });

  it('returns diff for changed values', () => {
    const base = { 'common.learnMore': 'Learn' };
    const overlay = { 'common.learnMore': 'New value' };
    expect(diffFlat(base, overlay)).toEqual({
      'common.learnMore': { base: 'Learn', overlay: 'New value' },
    });
  });

  it('includes new keys in overlay that are not in base', () => {
    const base = { existing: 'value' };
    const overlay = { existing: 'value', newKey: 'new value' };
    expect(diffFlat(base, overlay)).toEqual({
      newKey: { base: '', overlay: 'new value' },
    });
  });

  it('returns empty when overlay is empty', () => {
    const base = { key: 'value' };
    expect(diffFlat(base, {})).toEqual({});
  });

  it('ignores keys in base that are absent from overlay', () => {
    const base = { key: 'value', unused: 'old' };
    const overlay = { key: 'value' };
    expect(diffFlat(base, overlay)).toEqual({});
  });

  it('handles multiple differing keys', () => {
    const base = { a: '1', b: '2', c: '3' };
    const overlay = { a: '1', b: 'changed', c: 'also changed' };
    expect(diffFlat(base, overlay)).toEqual({
      b: { base: '2', overlay: 'changed' },
      c: { base: '3', overlay: 'also changed' },
    });
  });
});
