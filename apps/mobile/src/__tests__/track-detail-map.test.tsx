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

    const source = getByTestId('track-detail-map').props.source as { uri: string };
    const html = decodeDataUri(source.uri);

    expect(html).toContain("L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'");
    expect(html).not.toContain('{s}.tile.openstreetmap.org');
  });

  it('shows the OpenStreetMap attribution with a link', async () => {
    const { getByTestId } = await render(<TrackDetailMap {...props} />);

    const source = getByTestId('track-detail-map').props.source as { uri: string };

    expect(decodeDataUri(source.uri)).toContain(
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    );
  });

  it('identifies the app in the WebView User-Agent', async () => {
    const { getByTestId } = await render(<TrackDetailMap {...props} />);

    const userAgent = String(getByTestId('track-detail-map').props.userAgent);

    // Names the app, carries the app version and a contact URL in one stable token.
    expect(userAgent).toMatch(/^Sonora\/\S+ \(\+https:\/\/\S+\)$/);
    expect(userAgent).toContain(getAppVersion().versionName);
  });
});
