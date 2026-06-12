import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type L from 'leaflet';

import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TripDetailMapProps {
  latitude: number;
  longitude: number;
  userLatitude?: number;
  userLongitude?: number;
  showLabels?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TripDetailMap({
  latitude,
  longitude,
  userLatitude,
  userLongitude,
  showLabels = true,
}: TripDetailMapProps) {
  const { t } = useAppTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isBrowser) return;

    function init(leaflet: typeof import('leaflet')) {
      if (mapRef.current || !containerRef.current) return;

      try {
        const icon = leaflet.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        const map = leaflet.map(containerRef.current, {
          center: [latitude, longitude],
          zoom: 15,
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: true,
        });

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          })
          .addTo(map);

        const destMarker = leaflet.marker([latitude, longitude], { icon }).addTo(map);
        destMarkerRef.current = destMarker;
        destMarker.bindTooltip(t('map.destination'), { permanent: true, direction: 'top' });

        if (userLatitude !== undefined && userLongitude !== undefined) {
          const userMarker = leaflet
            .circleMarker([userLatitude, userLongitude], {
              radius: 8,
              color: '#ffffff',
              fillColor: '#3b82f6',
              fillOpacity: 0.9,
              weight: 2,
            })
            .addTo(map);
          userMarkerRef.current = userMarker;
          userMarker.bindTooltip(t('map.userLocation'), { permanent: true, direction: 'top' });
          const bounds = leaflet.latLngBounds([
            [latitude, longitude],
            [userLatitude, userLongitude],
          ]);
          map.fitBounds(bounds.pad(0.2));
        }

        mapRef.current = map;
      } catch (err) {
        logger.error('TripDetailMap init failed:', err);
        setError(true);
      }
    }

    const getL = () =>
      (window as unknown as Record<string, unknown>).L as typeof import('leaflet') | undefined;

    if (getL()) {
      init(getL()!);
    } else {
      // CSS
      if (!document.querySelector('link[data-trip-detail-map-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS_URL;
        link.setAttribute('data-trip-detail-map-css', '');
        document.head.appendChild(link);
      }

      // JS
      const script = document.createElement('script');
      script.src = LEAFLET_JS_URL;
      script.onload = () => {
        const L = getL();
        if (L) init(L);
      };
      script.onerror = () => setError(true);
      document.head.appendChild(script);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        destMarkerRef.current = null;
        userMarkerRef.current = null;
      }
    };
  }, [latitude, longitude, userLatitude, userLongitude, t]);

  // Sync Leaflet tooltip visibility with the external Leaflet system.
  // useLayoutEffect is the correct pattern for synchronizing with external
  // (non-React) systems — avoids the "event logic in effect" anti-pattern.
  useLayoutEffect(() => {
    const dest = destMarkerRef.current;
    const user = userMarkerRef.current;
    if (dest) {
      dest.unbindTooltip();
      if (showLabels) {
        dest.bindTooltip(t('map.destination'), { permanent: true, direction: 'top' });
      }
    }
    if (user) {
      user.unbindTooltip();
      if (showLabels) {
        user.bindTooltip(t('map.userLocation'), { permanent: true, direction: 'top' });
      }
    }
  }, [showLabels, t]);

  if (error) {
    return (
      <TwView
        testID="trip-detail-map-error"
        className="h-80 w-full items-center justify-center gap-2 bg-backgroundElement px-4"
      >
        <ThemedText>{t('map.offlineTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('map.offlineDescription')}
        </ThemedText>
      </TwView>
    );
  }

  return (
    <TwView testID="trip-detail-map" className="h-80 w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full z-0" />
    </TwView>
  );
}
