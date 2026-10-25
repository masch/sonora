import { render } from '@testing-library/react-native';

import TrackDetailMap from '@/components/track-detail-map';
import { getAppVersion } from '@/utils/app-version';

// The native WebView cannot render under jest: a host component keeps the props
// this component must set (source, userAgent, testID) inspectable.
jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

function decodeDataUri(uri: string): string {
  const binary = atob(uri.replace('data:text/html;base64,', ''));
  const percentEncoded = Array.from(
    binary,
    (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
  ).join('');
  return decodeURIComponent(percentEncoded);
}

describe('TrackDetailMap OSM tile policy', () => {
  const props = { latitude: -32.211913, longitude: -64.73809 };

  it('requests tiles from the exact OSM tile host, without subdomains', async () => {
    const { getByTestId } = await render(<TrackDetailMap {...props} />);

    const source = getByTestId('track-detail-map-leaflet').props.source as { uri: string };
    const html = decodeDataUri(source.uri);

    expect(html).toContain("L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'");
    expect(html).not.toContain('{s}.tile.openstreetmap.org');
  });

  it('shows the OpenStreetMap attribution with a link', async () => {
    const { getByTestId } = await render(<TrackDetailMap {...props} />);

    const source = getByTestId('track-detail-map-leaflet').props.source as { uri: string };

    expect(decodeDataUri(source.uri)).toContain(
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    );
  });

  it('identifies the app in the WebView User-Agent', async () => {
    const { getByTestId } = await render(<TrackDetailMap {...props} />);

    const userAgent = String(getByTestId('track-detail-map-leaflet').props.userAgent);

    // Names the app, carries the app version and a contact URL in one stable token.
    expect(userAgent).toMatch(/^Sonora\/\S+ \(\+https:\/\/\S+\)$/);
    expect(userAgent).toContain(getAppVersion().versionName);
  });
});

describe('TrackDetailMap labels toggle', () => {
  const props = { latitude: -32.211913, longitude: -64.73809 };

  it('keeps the waypoint markers reachable for the labels toggle', async () => {
    // The toggle runs later, as injected JavaScript, and can only unbind what the
    // page kept a reference to. A waypoint marker left out of that list keeps its
    // permanent tooltip after the walker hides the labels.
    const { getByTestId } = await render(
      <TrackDetailMap
        {...props}
        waypoints={[
          { latitude: -32.212, longitude: -64.738 },
          { latitude: -32.213, longitude: -64.739 },
        ]}
      />,
    );

    const html = decodeDataUri(
      (getByTestId('track-detail-map-leaflet').props.source as { uri: string }).uri,
    );

    expect(html).toContain('window.waypointMarkers = [];');
    expect(html).toContain('window.waypointMarkers.push({ marker: marker, label: label });');
  });

  it('answers to its own test id, not the surface', async () => {
    // The surface that mounts this map owns the screen's id; when both answer the
    // same one, every query matches two nodes the moment this renderer draws.
    const { getByTestId, queryByTestId } = await render(<TrackDetailMap {...props} />);

    expect(getByTestId('track-detail-map-leaflet')).toBeTruthy();
    expect(queryByTestId('track-detail-map')).toBeNull();
  });
});
