import { describe, expect, it } from 'vitest';

import type { MapDocument } from '@sonora/shared';

import { imageRejectionReason, linkRejectionReason } from '../map-documents/policy';

/** A one-feature document, which is all these rules look at. */
function documentWith(properties: Record<string, unknown>): MapDocument {
  return {
    key: 'ficha',
    scope: 'global',
    collection: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
          properties: { labelKey: 'map.a', ...properties },
        },
      ],
    },
  } as MapDocument;
}

describe('write policy', () => {
  it('accepts an allowlisted https link and an image from the upload route', () => {
    expect(
      linkRejectionReason(documentWith({ linkUrl: 'https://www.openstreetmap.org/way/638440638' })),
    ).toBeNull();
    expect(
      imageRejectionReason(
        documentWith({ imageUrl: 'https://api.example/media/public/references/a.jpg' }),
      ),
    ).toBeNull();
  });

  it('rejects a link outside the allowlist and an instagram profile that is not ours', () => {
    expect(linkRejectionReason(documentWith({ linkUrl: 'https://evil.example/x' }))).toMatch(
      /not allowlisted/,
    );
    expect(
      linkRejectionReason(documentWith({ linkUrl: 'https://www.instagram.com/otro.perfil' })),
    ).toMatch(/instagram links must point to/);
  });

  it('rejects an image that does not come from the upload route', () => {
    expect(imageRejectionReason(documentWith({ imageUrl: 'https://cdn.example/a.jpg' }))).toMatch(
      /must come from the upload endpoint/,
    );
  });

  it('checks the origin only when the caller has one to compare against', () => {
    const document = documentWith({ imageUrl: 'https://otro.example/media/public/a.jpg' });

    expect(imageRejectionReason(document)).toBeNull();
    expect(imageRejectionReason(document, 'https://api.example')).toMatch(/on this origin/);
  });
});
