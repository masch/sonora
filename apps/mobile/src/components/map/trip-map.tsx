import { useState } from 'react';

import { IconButton } from '@/components/ui/icon-button';
import type { PlayableExperience } from '@/data/experiences';
import { useMapViewConfig } from '@/hooks/use-map-view-config';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';

import ExperienceMapSwitch from './experience-map-switch';

export interface TripMapProps {
  experience: PlayableExperience;
  userCoordinates?: { latitude: number; longitude: number };
}

/**
 * The trip's mini map and its labels toggle.
 *
 * The toggle belongs to the map it labels, so the state lives here instead of in
 * the screen: the screen only says which experience to draw.
 */
export default function TripMap({ experience, userCoordinates }: TripMapProps) {
  const { t } = useAppTranslation();
  // The experience's own coordinates decide the region, so the map draws the archive
  // of the place the walker is going to, not the one the server preloads.
  const { renderer, source } = useMapViewConfig({
    latitude: experience.latitude,
    longitude: experience.longitude,
  });
  const [showLabels, setShowLabels] = useState(true);

  return (
    <TwView className="-mx-3 relative">
      <ExperienceMapSwitch
        renderer={renderer}
        source={source}
        experience={experience}
        userCoordinates={userCoordinates}
        showLabels={showLabels}
      />
      <IconButton
        onPress={() => setShowLabels(!showLabels)}
        variant="outline"
        size="sm"
        className="absolute top-3 right-3 bg-white/95 dark:bg-zinc-800/95 shadow-md z-20 border-0"
        accessibilityLabel={showLabels ? t('map.hideLabels') : t('map.showLabels')}
        testID="toggle-map-labels"
        icon={{
          ios: showLabels ? 'tag.slash.fill' : 'tag.fill',
          android: showLabels ? 'label_off' : 'label',
          web: showLabels ? 'label_off' : 'label',
        }}
      />
    </TwView>
  );
}
