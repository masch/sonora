import { useEffect, useRef, useState } from 'react';
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TripDetailMap({ latitude, longitude }: TripDetailMapProps) {
  const { t } = useAppTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isBrowser) return;
    if (mapRef.current) return;

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

        leaflet.marker([latitude, longitude], { icon }).addTo(map);

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
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <TwView className="h-48 w-full items-center justify-center gap-2 rounded-xl bg-backgroundElement px-4">
        <ThemedText>{t('map.offlineTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('map.offlineDescription')}
        </ThemedText>
      </TwView>
    );
  }

  return (
    <TwView className="h-48 w-full overflow-hidden rounded-xl">
      <div ref={containerRef} className="h-full w-full z-0" />
    </TwView>
  );
}
