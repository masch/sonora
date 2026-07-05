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
  it('serializes a flat object', () => {
    const input = { key: 'value' };
    const result = serializeToTS(input, 1);
    expect(result).toBe("    key: 'value',");
  });

  it('serializes nested objects with proper indentation', () => {
    const input = { common: { learnMore: 'Learn' } };
    const result = serializeToTS(input, 1);
    expect(result).toContain('common: {');
    expect(result).toContain("learnMore: 'Learn',");
    expect(result).toContain('},');
  });

  it('escapes single quotes in values', () => {
    const input = { key: "it's fine" };
    const result = serializeToTS(input, 1);
    expect(result).toContain("key: 'it\\'s fine',");
  });
});

describe('renderTSFile', () => {
  it('renders a complete .ts file with correct export name', () => {
    const input = { key: 'value' };
    const result = renderTSFile('en', input);
    expect(result).toContain('export const en = {');
    expect(result).toContain("key: 'value',");
    expect(result.trim()).toMatch(/};$/);
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
