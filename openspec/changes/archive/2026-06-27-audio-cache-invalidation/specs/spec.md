# Specification: Audio Cache Invalidation

## 1. Problem Statement

Actualmente, los audios descargados localmente se guardan en la caché del dispositivo (o del navegador) y no se actualizan si se sube una nueva versión al servidor (R2) usando la misma ruta, ya que el cliente solo verifica la existencia física del archivo local.

## 2. Requirements

- **Validación del servidor**: Antes de reproducir o al cargar el track, si existe una versión local y hay conexión a internet, realizar un control contra el servidor usando una petición HTTP liviana (`Range: bytes=0-0`).
- **ETag**: Utilizar el `ETag` devuelto por Cloudflare R2 para comparar la versión local con la del servidor.
- **Invalidación automática**: Si los `ETag` difieren, el archivo local debe ser eliminado y el estado del gancho restablecido a `idle` para forzar una nueva descarga.
- **Modo offline robusto**: Si el cliente no tiene conexión a internet o el servidor no responde dentro de un timeout de 5 segundos, mantener la versión local sin interrumpir la reproducción.
