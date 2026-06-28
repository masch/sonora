# Tasks: Audio Cache Invalidation

- [x] Modificar `download-manager-store.ts` para guardar el ETag al completar la descarga
  - [x] Implementar la extracción de ETag en `performFileDownload` (para nativo) y guardarlo en `metadata.json`
  - [x] Implementar la extracción de ETag en `performWebDownload` (para web) y guardarlo en los encabezados de la caché web
- [x] Modificar `use-track-download.ts` para validar el ETag local contra el servidor
  - [x] Leer el ETag del archivo `metadata.json` local (en nativo) o de la caché web (en web)
  - [x] Realizar la solicitud HTTP liviana con `Range: bytes=0-0` si el archivo existe y estamos online
  - [x] Invalidar (eliminar archivo local/caché) si hay discrepancia de ETag
- [x] Actualizar y agregar pruebas unitarias en `use-track-download.test.ts`
- [x] Verificar que todos los tests sigan pasando con `bun --cwd apps/mobile test -- --watchAll=false`
