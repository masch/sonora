import { APP_CONFIG } from '@/config/app-config';
import { SONORA_HOME_MAP } from '@/constants/images';
import { useMapViewConfig } from '@/hooks/use-map-view-config';
import { useAppTranslation } from '@/hooks/use-translation';

import { PopupImageModal } from './popup-image-modal';
import WorldMap from './map/world-map';

/**
 * The home's map slot: the Deriva world where the build and the payload resolved
 * MapLibre, and the still image that has always been there where they did not.
 *
 * The decision is the renderer the app already resolved — build-time env, then the
 * remote value, both read once per render by `useMapViewConfig` — and never a
 * second flag: a build that draws its maps with Leaflet has no archive on disk
 * (`use-map-prefetch` only downloads one for MapLibre), so a world mounted there
 * would open on tiles nobody downloaded. The image is the honest fallback, not a
 * degraded feature.
 *
 * Leaflet stays frozen: nothing here reaches it, and the deprecation suite keeps
 * leaflet's consumers at the two modules that already existed.
 */
export default function HomeWorld() {
  const { renderer } = useMapViewConfig();
  const { t } = useAppTranslation();

  if (renderer !== 'maplibre') {
    return <PopupImageModal source={SONORA_HOME_MAP} alt={t('home.mapAlt')} />;
  }

  return <WorldMap centerOnSelect={APP_CONFIG.worldPreview === 'fly'} />;
}
