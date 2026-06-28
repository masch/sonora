# Design: Audio Cache Invalidation

## 1. Storage of ETag metadata

- **iOS/Android (Native)**: Guardamos el `ETag` (o la cabecera personalizada `x-audio-etag`) en un archivo complementario `metadata.json` en la misma ruta que el audio (`${FileSystem.documentDirectory}tracks/${trackId}/metadata.json`).
- **Web**: Guardamos el valor en los encabezados del objeto `Response` de la caché (`sonora-audio-cache`) usando tanto la clave `ETag` como `x-audio-etag`.

## 2. Invalidation Logic in useTrackDownload Hook

- Al montar el hook:
  1. Verificar existencia del archivo local y leer su metadato JSON/header de caché.
  2. Si existe localmente y `isOnline` es verdadero, realizar un `fetch(remoteAudioUrl, { headers: { Range: 'bytes=0-0' } })`.
  3. Comparar el `x-audio-etag` (o `etag` estándar) del servidor con el local.
  4. Si hay discrepancia, invocar `deleteAsync` en el archivo local y metadato JSON (o `cache.delete` en web) y establecer `localCache` a `null`.
