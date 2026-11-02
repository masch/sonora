import { createContext, useContext, useEffect, useState, type ComponentProps } from 'react';

import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { TwView } from '@/tw';

/**
 * Pauses or releases the page scroll for the gesture a surface is holding.
 *
 * `true` while a finger is down on the surface, `false` when it lifts or the gesture
 * is cancelled — the surface reports the gesture, never the scroll.
 */
type MapScrollLock = (locked: boolean) => void;

/**
 * The page scroll a gesture surface pauses while a finger is on it.
 *
 * The map draws inside the screen's `ScrollView`, and on a device that container
 * takes the gesture away from it: Android's scroll view intercepts a vertical drag
 * unless the child asks it not to, and the child here is a native map that only asks
 * when pan is declared (see the gesture props in `experience-map.tsx`); iOS cancels
 * the touches of its content once its own pan begins. Declaring the gestures is half
 * of the answer and the platform-specific half. This is the other half, the one that
 * also covers the platform with no such request to make, and the only one that reaches
 * iOS at all.
 *
 * The default is a no-op on purpose: a surface that asks with no wrapper above it
 * keeps drawing, and simply does not move the page scroll.
 */
const MapScrollLockContext = createContext<MapScrollLock>(() => {});

/** Asks for the page scroll, for the duration of the gesture the caller is handling. */
export function useLockMapScroll(): MapScrollLock {
  return useContext(MapScrollLockContext);
}

/**
 * A surface whose gestures belong to it, not to the page it draws on.
 *
 * Everything the map card is — its test id, its size, the overlays stacked on it —
 * is passed through to the view; the only thing added is that the page scroll is
 * held while a finger is on it, and released on both exits so a cancelled gesture
 * (the container took it, an interruption) never leaves the screen frozen. A surface
 * that goes away mid-gesture releases it too: the gesture that asked is over, because
 * the surface it was asked for is gone.
 */
export function MapGestureSurface({ children, ...rest }: ComponentProps<typeof TwView>) {
  const lockPageScroll = useLockMapScroll();

  useEffect(() => () => lockPageScroll(false), [lockPageScroll]);

  return (
    <TwView
      {...rest}
      onTouchStart={() => lockPageScroll(true)}
      onTouchEnd={() => lockPageScroll(false)}
      onTouchCancel={() => lockPageScroll(false)}
    >
      {children}
    </TwView>
  );
}

/**
 * The scrollable screen a gesture surface lives on.
 *
 * Same container and same props as `ScrollScreenWrapper`; the only difference is that
 * it lets a surface inside it take the scroll away while a finger is down. The lock
 * state lives here rather than in the screen because it belongs to the gesture: the
 * surface that starts it is the surface that ends it, and the state dies with this
 * wrapper instead of outliving the map that asked for it.
 */
export function MapScrollScreenWrapper({
  scrollEnabled = true,
  ...rest
}: ComponentProps<typeof ScrollScreenWrapper>) {
  const [locked, setLocked] = useState(false);

  // A caller that asked for a page it cannot scroll keeps that: the lock takes the
  // scroll away for a gesture, and never hands it back against an explicit no.
  return (
    <MapScrollLockContext.Provider value={setLocked}>
      <ScrollScreenWrapper {...rest} scrollEnabled={scrollEnabled && !locked} />
    </MapScrollLockContext.Provider>
  );
}
