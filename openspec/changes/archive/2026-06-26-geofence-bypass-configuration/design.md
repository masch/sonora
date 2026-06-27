# Design: Geocerca configurable por Experiencia

## Schema Changes

- Agregar columna booleana `geofenceBypassable` a la tabla `experiences` en Drizzle.
- Alinear el tipo TS `Experience` en `packages/shared`.

## UI/UX Changes

- Modificar `trip-detail-view.tsx` para interceptar las acciones de reproducción (`onPlay`) y descarga (`onDownload`).
- Si `showBypassWarning` es verdadero, disparar una confirmación nativa `Alert.alert` (o `window.confirm` en web) con opciones para continuar o cancelar.
