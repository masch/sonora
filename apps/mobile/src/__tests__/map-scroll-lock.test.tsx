import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { MapScrollScreenWrapper, useLockMapScroll } from '@/components/map/map-scroll-lock';

/**
 * A gesture surface that asks for the lock the way the map card does.
 *
 * The map itself is not what this suite is about: `ExperienceMap` owns the wiring
 * onto these three events, and its own suite proves it fires them. What is under
 * test here is the other half — that a surface which asks for the lock really takes
 * the page scroll away, and gives it back on every exit.
 */
function GestureSurface() {
  const lockPageScroll = useLockMapScroll();

  return (
    <View
      testID="gesture-surface"
      onTouchStart={() => lockPageScroll(true)}
      onTouchEnd={() => lockPageScroll(false)}
      onTouchCancel={() => lockPageScroll(false)}
    />
  );
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
