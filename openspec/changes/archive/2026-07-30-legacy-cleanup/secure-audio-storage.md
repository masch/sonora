# Proposal: Almacenamiento Seguro de Audios con R2

Este cambio propone la implementación de un mecanismo de subida y descarga/streaming protegido de audios utilizando Cloudflare R2 como backend privado de almacenamiento de objetos, y un endpoint en el Worker que actúa como proxy autenticado para servir el stream con soporte de solicitudes de rango (Range Requests).

## User Review Required

> [!IMPORTANT]
> **Límite de tamaño de subida en Cloudflare Workers**
> Cloudflare Workers en el plan gratuito permite un tamaño de cuerpo de request (request body) de hasta **100 MB**. Los audios de Sonora pesan menos de 100 MB, por lo que la subida directa a través de la API es viable.

## Proposed Changes

### [Backend] API (Cloudflare Workers)

#### [MODIFY] [wrangler.toml](../../apps/api/wrangler.toml)

Vincular el bucket de R2 al Worker bajo el binding `BUCKET`.

#### [NEW] [audio.ts](../../apps/api/src/routes/audio.ts)

Crear rutas de administración protegidas por la API Key secreta para gestionar las subidas de audios y rutas de streaming para los usuarios.

---

## Verification Plan

### Automated Tests

- Pruebas unitarias en [audio.test.ts](../../apps/api/src/__tests__/audio.test.ts) que validan la subida (201), errores de autenticación (401), y streaming con Range headers (206).
