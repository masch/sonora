# Proposal: Invalidación de Caché de Audio por ETag

Este cambio implementa un mecanismo de detección de actualización de audios descargados localmente basándonos en el `ETag` de los objetos en Cloudflare R2, asegurando que los usuarios obtengan la versión más reciente cuando están online.

## Proposed Changes

### apps/mobile

#### [MODIFY] [download-manager-store.ts](../../apps/mobile/src/store/download-manager-store.ts)

- Al completar la descarga, extraer el `ETag` del header y guardarlo localmente:
  - En nativo, en `metadata.json` junto al audio.
  - En web, dentro de los headers del objeto `Response` en la caché.

#### [MODIFY] [use-track-download.ts](../../apps/mobile/src/hooks/use-track-download.ts)

- Leer el `ETag` de la caché/metadata local.
- Realizar una solicitud `GET` liviana con `Range: bytes=0-0` para validar si el `ETag` del servidor coincide con el local.
- Eliminar los archivos de caché si hay discrepancia para forzar la descarga de la nueva versión.

---

## Verification Plan

### Automated Tests

- Pruebas en [use-track-download.test.ts](../../apps/mobile/src/hooks/__tests__/use-track-download.test.ts) que verifican la lectura de metadatos, invalidación por ETag no coincidente, y mantenimiento de caché offline.
