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

/**
 * The one scroll container the wrapper renders, as the platform receives it.
 *
 * Queried by host type rather than by a test id this component has no reason to
 * carry: what the assertion is about is the native prop the scroll view was given.
 */
function pageScroll() {
  const [scroll] = screen.container.queryAll((node) => node.type === 'RCTScrollView');
  if (!scroll) throw new Error('the wrapper rendered no scroll view');
  return scroll;
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

  it('accepts a surface with no wrapper above it', async () => {
    // A map mounted outside the wrapper (a future host that forgot to opt in) must
    // draw and respond; the lock is a no-op, never a crash.
    await render(<GestureSurface />);

    await expect(
      fireEvent(screen.getByTestId('gesture-surface'), 'touchStart'),
    ).resolves.toBeUndefined();
  });
});
