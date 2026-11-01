import { resolveWorldPreview, WORLD_PREVIEW_ENV } from '@/components/map/world-preview-variant';

/**
 * The world's preview variant is a development choice read from the build: `fly`
 * travels to the tapped point before the card opens, and everything else is the
 * plain sheet. An unknown value resolves to the plain reading, because a build
 * that was never configured must not gain a camera move nobody asked for.
 */
describe('resolveWorldPreview', () => {
  it('resolves the flight variant when the build asked for it', () => {
    expect(resolveWorldPreview('fly')).toBe('fly');
  });

  it('resolves the plain sheet for every other value', () => {
    // The named sibling, the absent value and an empty one.
    expect(resolveWorldPreview('sheet')).toBe('sheet');
    expect(resolveWorldPreview(undefined)).toBe('sheet');
    expect(resolveWorldPreview('')).toBe('sheet');
    // Values that look right but are not the token: case and surrounding space are
    // not normalised, so they must not silently switch the variant on.
    expect(resolveWorldPreview('FLY')).toBe('sheet');
    expect(resolveWorldPreview('fly ')).toBe('sheet');
    // Anything else the environment carries.
    expect(resolveWorldPreview('callout')).toBe('sheet');
    expect(resolveWorldPreview('{"variant":"fly"}')).toBe('sheet');
  });

  it('reads the build variable the value comes from', () => {
    expect(WORLD_PREVIEW_ENV).toBe('EXPO_PUBLIC_WORLD_MAP_PREVIEW');
  });
});
