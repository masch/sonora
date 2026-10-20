import { act, fireEvent, render } from '@testing-library/react-native';

import TrackDetailMap from '@/components/track-detail-map';
import { getAppVersion } from '@/utils/app-version';

// The native WebView cannot render under jest: a host component keeps the props
// this component must set (source, userAgent, testID) inspectable.
// The native WebView cannot render under jest. This double keeps the props the
// component must set (source, userAgent, testID, the load handlers) inspectable,
// and gives the component the one imperative method it calls through its ref.
jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const WebView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    React.useImperativeHandle(ref as never, () => ({ injectJavaScript: jest.fn() }));
    return React.createElement(View, props);
  });
  WebView.displayName = 'MockWebView';
  return { WebView };
});

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

describe('TrackDetailMap first load', () => {
  const props = { latitude: -32.211913, longitude: -64.73809 };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops showing the loader as soon as the webview reports it loaded', async () => {
    const { getByTestId, queryByText } = await render(<TrackDetailMap {...props} />);

    expect(queryByText('map.loadingMap')).toBeTruthy();

    await act(async () => {
      getByTestId('track-detail-map').props.onLoad();
    });

    expect(queryByText('map.loadingMap')).toBeNull();
  });

  it('falls back and then gives up instead of loading forever', async () => {
    const { getByTestId, queryByText } = await render(<TrackDetailMap {...props} />);

    // The first attempt never reports back: it must not stay on the loader.
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });

    expect(getByTestId('track-detail-map').props.source.uri).toContain(
      'openstreetmap.org/export/embed.html',
    );

    // The fallback stays silent too, so the screen owes the user an answer.
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });

    expect(queryByText('map.loadingMap')).toBeNull();
    expect(queryByText('map.offlineTitle')).toBeTruthy();
  });

  it('retries from the error state instead of forcing the user to leave the screen', async () => {
    const { getByTestId, queryByText } = await render(<TrackDetailMap {...props} />);

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(getByTestId('track-detail-map-retry')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('track-detail-map-retry'));
    });

    expect(queryByText('map.loadingMap')).toBeTruthy();
    expect(queryByText('map.offlineTitle')).toBeNull();
  });
});
