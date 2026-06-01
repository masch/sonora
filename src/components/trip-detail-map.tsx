import { useRef, useState } from 'react';
import { WebView } from 'react-native-webview';

import LoadingView from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TripDetailMapProps {
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Build Leaflet HTML → base64 data URI
// ---------------------------------------------------------------------------

function buildDataUri(lat: number, lng: number): string {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>
try{
var icon=L.icon({
iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]});
var map=L.map('map',{center:[${lat},${lng}],zoom:15,zoomControl:false,scrollWheelZoom:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OSM contributors',maxZoom:19}).addTo(map);
L.marker([${lat},${lng}],{icon}).addTo(map);
}catch(e){document.body.innerHTML='<p style="padding:20px;color:#666">'+e.message+'</p>'}
<\/script>
</body>
</html>`;

  const base64 = btoa(unescape(encodeURIComponent(html)));
  return `data:text/html;base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Fallback: OSM embed URL (used if data URI fails)
// ---------------------------------------------------------------------------

function buildEmbedUrl(lat: number, lng: number): string {
  const m = 0.01;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - m},${lat - m},${lng + m},${lat + m}&layer=mapnik&marker=${lat},${lng}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TripDetailMap({ latitude, longitude }: TripDetailMapProps) {
  const { t } = useAppTranslation();
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState(false);

  const uri = fallback ? buildEmbedUrl(latitude, longitude) : buildDataUri(latitude, longitude);

  const handleError = () => {
    if (!fallback) {
      // First failure → try OSM embed fallback
      setFallback(true);
    } else {
      // Both sources failed → show error state
      setLoading(false);
      setError(true);
    }
  };

  if (error) {
    return (
      <TwView className="h-48 w-full items-center justify-center rounded-xl bg-backgroundElement">
        <ThemedText themeColor="textSecondary">{t('map.offlineTitle')}</ThemedText>
      </TwView>
    );
  }

  return (
    <TwView className="h-48 w-full overflow-hidden rounded-xl bg-backgroundElement">
      {loading && <LoadingView message={t('map.loadingMap')} />}
      <WebView
        ref={webviewRef}
        source={{ uri }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        accessibilityLabel={t('map.loadingMap')}
        testID="trip-detail-map"
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        onLoadEnd={() => setLoading(false)}
        onError={handleError}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        mixedContentMode="compatibility"
      />
    </TwView>
  );
}
