import { render, screen } from '@testing-library/react-native';

import HomeWorld from '@/components/home-world';
import type { MapRenderer } from '@/components/map/map-view.types';

/**
 * The renderer the build resolved. Read on every call so a test can flip it: the
 * home's only input is `renderer`, and nothing else about the map view decides
 * which of the two slots is drawn.
 */
let mockRenderer: MapRenderer = 'maplibre';
jest.mock('@/hooks/use-map-view-config', () => ({
  useMapViewConfig: () => ({
    renderer: mockRenderer,
    regionKey: null,
    source: { archiveUrl: '', regionKey: null },
  }),
}));

/** The world map is a whole suite of its own; here it only has to be mounted or not. */
const mockWorldMapProps: Record<string, unknown>[] = [];
jest.mock('@/components/map/world-map', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockWorldMapProps.push(props);
    return null;
  },
}));

describe('HomeWorld', () => {
  beforeEach(() => {
    mockWorldMapProps.length = 0;
    mockRenderer = 'maplibre';
  });

  it('mounts the Deriva world when the build resolved MapLibre', async () => {
    await render(<HomeWorld />);

    expect(mockWorldMapProps).toHaveLength(1);
    // The still image is not drawn at all: one slot, one surface.
    expect(screen.queryByTestId('explore-routes-image-trigger')).toBeNull();
  });

  it('keeps the still home image and never mounts the world on Leaflet', async () => {
    mockRenderer = 'leaflet';

    await render(<HomeWorld />);

    expect(mockWorldMapProps).toHaveLength(0);
    // The image that has always been on the home, with the home's accessible name.
    const image = screen.getByTestId('explore-routes-image-trigger');
    expect(image.props.accessibilityLabel).toBe('home.mapAlt');
  });
});
