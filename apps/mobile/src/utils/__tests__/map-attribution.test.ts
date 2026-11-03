import { attributionWithVersion } from '@/utils/map-attribution';

/** The notice the published style carries: markup, with the credit inside the anchor. */
const OSM_NOTICE =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

describe('attributionWithVersion', () => {
  it('appends the drawn version to the notice, after the markup', () => {
    const notice = attributionWithVersion(OSM_NOTICE, 'v7');

    expect(notice).toBe(`${OSM_NOTICE} (v7)`);
    // The base text is the style's, untouched: the suffix is the only thing added, and it
    // lands outside the anchor so the link stays the link and the text stays text.
    expect(notice).toContain('</a> contributors (v7)');
    expect(notice).not.toContain('>OpenStreetMap (v7)</a>');
  });

  it('leaves the notice exactly as written when there is no version', () => {
    expect(attributionWithVersion(OSM_NOTICE, null)).toBe(OSM_NOTICE);
    expect(attributionWithVersion(OSM_NOTICE, undefined)).toBe(OSM_NOTICE);
    expect(attributionWithVersion(OSM_NOTICE, '   ')).toBe(OSM_NOTICE);
    // No stand-in for an answer nobody has: not the question mark, not a zero.
    expect(attributionWithVersion(OSM_NOTICE, null)).not.toContain('(v');
  });

  it('refuses to say the version twice', () => {
    expect(attributionWithVersion(`${OSM_NOTICE} (v7)`, 'v7')).toBe(`${OSM_NOTICE} (v7)`);
    // Trailing whitespace does not hide the suffix that is already there.
    expect(attributionWithVersion(`${OSM_NOTICE} (v7)  `, 'v7')).toBe(`${OSM_NOTICE} (v7)  `);
    // A version the style authored is a version the notice already names.
    expect(attributionWithVersion(`${OSM_NOTICE} (v3)`, 'v7')).toBe(`${OSM_NOTICE} (v3)`);
  });

  it('has nothing to extend when the style publishes no attribution', () => {
    expect(attributionWithVersion(undefined, 'v7')).toBeUndefined();
    expect(attributionWithVersion(null, 'v7')).toBeUndefined();
    expect(attributionWithVersion('', 'v7')).toBeUndefined();
    expect(attributionWithVersion('   ', 'v7')).toBeUndefined();
  });

  it('appends to a notice that carries no markup, and to one that is not OpenStreetMap', () => {
    expect(attributionWithVersion('© OpenStreetMap contributors', 'v7')).toBe(
      '© OpenStreetMap contributors (v7)',
    );
    expect(attributionWithVersion('© OpenStreetMap contributors (v7)', 'v7')).toBe(
      '© OpenStreetMap contributors (v7)',
    );
  });
});
