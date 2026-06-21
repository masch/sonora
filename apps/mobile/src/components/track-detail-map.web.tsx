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

const EMPTY_WAYPOINTS: { latitude: number; longitude: number }[] = [];
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TrackDetailMapProps {
  latitude: number;
  longitude: number;
  userLatitude?: number;
  userLongitude?: number;
  showLabels?: boolean;
  waypoints?: { latitude: number; longitude: number }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// react-doctor-disable-next-line deslop/unused-export — false positive: used by track-detail-view.tsx via relative import. deslop can't resolve Metro platform extension resolution.
export default function TrackDetailMap({
  latitude,
  longitude,
  userLatitude,
  userLongitude,
  showLabels = true,
  waypoints = EMPTY_WAYPOINTS,
}: TrackDetailMapProps) {
  const { t } = useAppTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.CircleMarker[]>([]);
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

        // Draw path polyline and waypoints if available
        if (waypoints && waypoints.length > 0) {
          const latlngs: [number, number][] = waypoints.map((wp) => [wp.latitude, wp.longitude]);
          latlngs.unshift([latitude, longitude]);

          const polyline = leaflet
            .polyline(latlngs, { color: '#10b981', weight: 4, opacity: 0.8 })
            .addTo(map);
          polylineRef.current = polyline;

          const markers: L.CircleMarker[] = [];
          waypoints.forEach((wp, idx) => {
            const marker = leaflet
              .circleMarker([wp.latitude, wp.longitude], {
                radius: 6,
                color: '#10b981',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 3,
              })
              .addTo(map);
            marker.bindTooltip('Pt ' + (idx + 1), { permanent: true, direction: 'top' });
            markers.push(marker);
          });
          waypointMarkersRef.current = markers;

          const bounds = leaflet.latLngBounds(latlngs);
          map.fitBounds(bounds.pad(0.2));
        }

        mapRef.current = map;
      } catch (err) {
        logger.error('TrackDetailMap init failed:', err);
        setError(true);
      }
    }

    const getL = () =>
      (window as unknown as Record<string, unknown>).L as typeof import('leaflet') | undefined;

    if (getL()) {
      init(getL()!);
    } else {
      if (!document.querySelector('link[data-track-detail-map-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS_URL;
        link.setAttribute('data-track-detail-map-css', '');
        document.head.appendChild(link);
      }

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
        polylineRef.current = null;
        waypointMarkersRef.current = [];
      }
    };
  }, [latitude, longitude, t, waypoints]);

  // Handle user coordinates changes dynamically (no reload, smooth transition)
  useLayoutEffect(() => {
    if (!mapRef.current) return;
    const leaflet = (window as unknown as Record<string, unknown>).L as
      | typeof import('leaflet')
      | undefined;
    if (!leaflet) return;

    if (userLatitude !== undefined && userLongitude !== undefined) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLatitude, userLongitude]);
      } else {
        const userMarker = leaflet
          .circleMarker([userLatitude, userLongitude], {
            radius: 8,
            color: '#ffffff',
            fillColor: '#3b82f6',
            fillOpacity: 0.9,
            weight: 2,
          })
          .addTo(mapRef.current);
        userMarkerRef.current = userMarker;
        if (showLabels) {
          userMarker.bindTooltip(t('map.userLocation'), { permanent: true, direction: 'top' });
        }
      }
      const points: [number, number][] = [
        [latitude, longitude],
        [userLatitude, userLongitude],
      ];
      if (waypoints && waypoints.length > 0) {
        waypoints.forEach((wp) => points.push([wp.latitude, wp.longitude]));
      }
      const bounds = leaflet.latLngBounds(points);
      mapRef.current.fitBounds(bounds.pad(0.2), { animate: true });
    }
  }, [userLatitude, userLongitude, latitude, longitude, showLabels, t, waypoints]);

  // Sync Leaflet tooltip visibility with the external Leaflet system.
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
        testID="track-detail-map-error"
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
    <TwView testID="track-detail-map" className="relative h-80 w-full overflow-hidden">
      {userLatitude === undefined && (
        <TwView className="absolute bottom-4 left-4 z-10 rounded-full bg-black/70 px-4 py-2">
          <ThemedText className="text-sm font-semibold text-white">
            {t('map.fetchingLocation')}
          </ThemedText>
        </TwView>
      )}
      <div ref={containerRef} className="h-full w-full z-0" />
    </TwView>
  );
}
