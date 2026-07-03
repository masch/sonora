import { describe, it, expect } from 'vitest';
import { gte } from '../semver';

describe('gte', () => {
  describe('valid semver strings', () => {
    it('returns true when version is equal (1.0.0 >= 1.0.0)', () => {
      expect(gte('1.0.0', '1.0.0')).toBe(true);
    });

    it('returns true when version is greater major (2.0.0 >= 1.0.0)', () => {
      expect(gte('2.0.0', '1.0.0')).toBe(true);
    });

    it('returns true when version is greater minor (1.10.0 >= 1.9.0)', () => {
      expect(gte('1.10.0', '1.9.0')).toBe(true);
    });

    it('returns true when version is greater patch (1.0.5 >= 1.0.1)', () => {
      expect(gte('1.0.5', '1.0.1')).toBe(true);
    });

    it('returns false when version is below (1.0.0 >= 2.0.0)', () => {
      expect(gte('1.0.0', '2.0.0')).toBe(false);
    });

    it('returns false when minor is below (1.8.0 >= 1.9.0)', () => {
      expect(gte('1.8.0', '1.9.0')).toBe(false);
    });

    it('returns false when patch is below (1.0.1 >= 1.0.5)', () => {
      expect(gte('1.0.1', '1.0.5')).toBe(false);
    });
  });

  describe('pre-release versions', () => {
    it('compares pre-release as lower than release (1.0.0-alpha >= 1.0.0)', () => {
      expect(gte('1.0.0-alpha', '1.0.0')).toBe(false);
    });

    it('compares two pre-release versions (1.0.0-beta >= 1.0.0-alpha)', () => {
      expect(gte('1.0.0-beta', '1.0.0-alpha')).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(gte('', '1.0.0')).toBeNull();
    });

    it('returns null for non-numeric version parts', () => {
      expect(gte('abc', '1.0.0')).toBeNull();
    });

    it('returns null for partial version string', () => {
      expect(gte('1.0', '1.0.0')).toBeNull();
    });

    it('returns null when second argument is invalid', () => {
      expect(gte('1.0.0', 'not-valid')).toBeNull();
    });

    it('returns null when both arguments are invalid', () => {
      expect(gte('bad', 'wrong')).toBeNull();
    });
  });
});
