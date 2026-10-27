import { describe, expect, it } from 'vitest';
import { normalizeFlag, normalizeLayerGroups } from '../map-layers';

describe('normalizeFlag', () => {
  it('enables only the word "true", whatever its case or padding', () => {
    expect(normalizeFlag('true')).toBe(true);
    expect(normalizeFlag(' TRUE ')).toBe(true);
  });

  it('keeps every other value off, including unset', () => {
    // A misspelled switch has to fail towards today's behaviour, not towards
    // publishing a field no build in the field parses.
    for (const value of [undefined, '', '   ', 'false', '1', 'yes', 'on', 'maplibre']) {
      expect(normalizeFlag(value)).toBe(false);
    }
  });
});

describe('normalizeLayerGroups', () => {
  it('reads a comma-separated list in the order the operator wrote it', () => {
    expect(normalizeLayerGroups('roads,water,places')).toEqual([
      { id: 'roads', defaultVisible: true },
      { id: 'water', defaultVisible: true },
      { id: 'places', defaultVisible: true },
    ]);
  });

  it('reads a leading dash as "draws nothing until the walker asks"', () => {
    expect(normalizeLayerGroups('-buildings,roads')).toEqual([
      { id: 'buildings', defaultVisible: false },
      { id: 'roads', defaultVisible: true },
    ]);
  });

  it('trims each entry and drops the empty ones', () => {
    expect(normalizeLayerGroups(' roads , , water ,')).toEqual([
      { id: 'roads', defaultVisible: true },
      { id: 'water', defaultVisible: true },
    ]);
  });

  it('keeps the first mention of a group and ignores the repeats', () => {
    // Two entries for one group would give the control two rows that disagree.
    expect(normalizeLayerGroups('roads,-roads,water')).toEqual([
      { id: 'roads', defaultVisible: true },
      { id: 'water', defaultVisible: true },
    ]);
  });

  it('drops a group this build does not implement', () => {
    // The vocabulary is compiled into this server, so a typo is dropped here
    // instead of travelling as a row nobody can render.
    expect(normalizeLayerGroups('telemetry,roads,Buildings')).toEqual([
      { id: 'roads', defaultVisible: true },
    ]);
  });

  it('answers an empty list for an unset or blank variable', () => {
    expect(normalizeLayerGroups(undefined)).toEqual([]);
    expect(normalizeLayerGroups('   ')).toEqual([]);
    expect(normalizeLayerGroups('-')).toEqual([]);
  });
});
