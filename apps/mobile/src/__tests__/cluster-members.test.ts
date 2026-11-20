import { clusterMemberSlugs } from '@/components/map/use-shared-place-picker';
import type { WorldExperience } from '@sonora/shared';

const at = (slug: string, latitude: number, longitude: number): WorldExperience => ({
  slug,
  title: slug,
  format: 'track',
  latitude,
  longitude,
  durationSeconds: 60,
  free: true,
});

/** Nogales Alta, roughly where the hub's frame sits. */
const base = at('fuego', -32.19157, -64.7524);

describe('clusterMemberSlugs', () => {
  it('includes coincident places at any zoom, at any distance they span', () => {
    const twin = at('nogales', base.latitude, base.longitude);
    const members = clusterMemberSlugs([base, twin], {
      longitude: base.longitude,
      latitude: base.latitude,
      zoom: 14,
    });
    expect(members).toEqual(expect.arrayContaining(['fuego', 'nogales']));
  });

  it('excludes a place that sits outside the cluster radius, even one block away', () => {
    // ~150 m north: visible on the frame, but past the 40 px radius at z14.
    const neighbour = at('deriva', base.latitude + 0.0015, base.longitude);
    const members = clusterMemberSlugs([base, neighbour], {
      longitude: base.longitude,
      latitude: base.latitude,
      zoom: 14,
    });
    expect(members).toEqual(['fuego']);
  });

  it('includes a place inside the radius, so a proximity cluster lists its own', () => {
    // ~30 m east: within the 40 px radius at z14, so supercluster grouped it.
    const inside = at('nogales', base.latitude, base.longitude + 0.0003);
    const members = clusterMemberSlugs([base, inside], {
      longitude: base.longitude,
      latitude: base.latitude,
      zoom: 14,
    });
    expect(members).toEqual(expect.arrayContaining(['fuego', 'nogales']));
  });
});
