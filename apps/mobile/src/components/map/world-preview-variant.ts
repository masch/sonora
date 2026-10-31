export const WORLD_PREVIEW_ENV = 'EXPO_PUBLIC_WORLD_MAP_PREVIEW';

/**
 * How the world presents a tapped point: the shape the walker sees, not a feature
 * of the build's map engine.
 *
 * `sheet` opens the preview card where it stands; `fly` also travels to the point
 * first, so the walker sees where it is before the card covers the bottom of the
 * screen. Both are the same card and the same data — the difference is one camera
 * move — which is why this is a variant to try on a device and then delete, not a
 * server-side switch: nothing about a rollout depends on it.
 *
 * An unknown value, and the absent one, resolve to `sheet`: the plainer reading is
 * the one a build gets when nobody chose.
 */
export type WorldPreviewVariant = 'sheet' | 'fly';

export function resolveWorldPreview(raw: string | undefined): WorldPreviewVariant {
  return raw === 'fly' ? 'fly' : 'sheet';
}
