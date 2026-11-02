import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapGestureSurface, MapScrollScreenWrapper } from '@/components/map/map-scroll-lock';

/**
 * The real gesture surface, which is what these assertions are about.
 *
 * Deliberately not a stand-in that calls the lock itself: a stub would reimplement
 * the very touch accounting under test, and would keep passing while the component
 * it stands for regressed.
 */
function GestureSurface() {
  return <MapGestureSurface testID="gesture-surface" />;
}

/** The one scroll container the wrapper renders. */
function pageScroll() {
  return screen.getByTestId('screen-scroll');
}

describe('MapScrollScreenWrapper', () => {
  it('takes the page scroll away while a finger is on the surface, and gives it back', async () => {
    await render(
      <MapScrollScreenWrapper>
        <GestureSurface />
      </MapScrollScreenWrapper>,
    );

    expect(pageScroll().props.scrollEnabled).toBe(true);

    await fireEvent(screen.getByTestId('gesture-surface'), 'touchStart');
    expect(pageScroll().props.scrollEnabled).toBe(false);

    await fireEvent(screen.getByTestId('gesture-surface'), 'touchEnd');
    expect(pageScroll().props.scrollEnabled).toBe(true);
  });

  it('gives the page scroll back when the gesture is cancelled', async () => {
    await render(
      <MapScrollScreenWrapper>
        <GestureSurface />
      </MapScrollScreenWrapper>,
    );

    await fireEvent(screen.getByTestId('gesture-surface'), 'touchStart');
    expect(pageScroll().props.scrollEnabled).toBe(false);

    await fireEvent(screen.getByTestId('gesture-surface'), 'touchCancel');
    expect(pageScroll().props.scrollEnabled).toBe(true);
  });

  it('keeps a page the caller already froze, even with no finger on it', async () => {
    // `scrollEnabled` is the container's own option and this wrapper passes it
    // through: the lock only ever takes the scroll away, never gives it back
    // against a caller who said no.
    await render(
      <MapScrollScreenWrapper scrollEnabled={false}>
        <GestureSurface />
      </MapScrollScreenWrapper>,
    );

    await fireEvent(screen.getByTestId('gesture-surface'), 'touchEnd');

    expect(pageScroll().props.scrollEnabled).toBe(false);
  });

  it('stays locked while any finger of a pinch is still down', async () => {
    // A two-finger pinch ends one finger at a time: lifting the first must not hand
    // the page back while the second is still on the surface, which is the gesture
    // this whole change exists to protect.
    await render(
      <MapScrollScreenWrapper>
        <GestureSurface />
      </MapScrollScreenWrapper>,
    );

    const surface = screen.getByTestId('gesture-surface');
    await fireEvent(surface, 'touchStart');
    await fireEvent(surface, 'touchStart');
    expect(pageScroll().props.scrollEnabled).toBe(false);

    await fireEvent(surface, 'touchEnd');
    expect(pageScroll().props.scrollEnabled).toBe(false);

    await fireEvent(surface, 'touchEnd');
    expect(pageScroll().props.scrollEnabled).toBe(true);
  });

  it('accepts a surface with no wrapper above it', async () => {
    // A map mounted outside the wrapper (a future host that forgot to opt in) must
    // draw and respond; the lock is a no-op, never a crash.
    await render(<GestureSurface />);

    await fireEvent(screen.getByTestId('gesture-surface'), 'touchStart');

    // Reaching this line is the assertion: the surface answered the touch, and the
    // lock nobody is holding stayed a no-op instead of throwing.
    expect(screen.getByTestId('gesture-surface')).toBeTruthy();
  });
});
