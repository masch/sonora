# Proposal: Refactor de Clientes de API con Fallback Offline Unificado

Este cambio propone la unificación y abstracción de las llamadas de fetch a la API del front-end en un cliente base unificado (`api-client.ts`). Este cliente encapsulará la configuración de la URL base, manejo de errores genéricos, carga de datos, almacenamiento automático de caché local para peticiones de lectura (`GET`) y la lógica de fallback offline.

## Status

**Completed** — All tasks done. 26 tests with 100% coverage (Stmts/Branch/Funcs/Lines).

## Artifacts

| Phase  | Path                                                            |
| ------ | --------------------------------------------------------------- |
| Spec   | [spec.md](../specs/refactor-api-offline-fallback/spec.md)       |
| Design | [design.md](../designs/refactor-api-offline-fallback-design.md) |
| Tasks  | [tasks.md](../tasks/refactor-api-offline-fallback-tasks.md)     |

## User Review Required

> [!IMPORTANT]
> **Efectos de Caching Automático**
> Para las peticiones `GET`, el cliente de API guardará automáticamente en el almacenamiento de base de datos local SQLite (KV-Store) la última respuesta exitosa. En caso de fallas de red, retornará el contenido en caché de forma transparente y emitirá una advertencia silenciosa en los logs. Esto unifica y elimina el código repetitivo de caching manual en los hooks y data providers.

## Proposed Changes

### [Frontend] Mobile App

#### [NEW] [api-client.ts](../../apps/mobile/src/services/api-client.ts)

Crear un cliente de API base genérico con soporte para `GET`, `POST` y caching automático con fallback offline para peticiones de lectura.

#### [MODIFY] [experiences.ts](../../apps/mobile/src/data/experiences.ts)

Refactorizar `fetchThemes` y `fetchExperiences` para utilizar el cliente de API base, eliminando la duplicación del try-catch y caching.

#### [MODIFY] [use-feedback-feed.ts](../../apps/mobile/src/hooks/use-feedback-feed.ts)

Refactorizar la función `fetchFeedData` para utilizar el cliente de API base.

#### [MODIFY] [use-feedback-sync.ts](../../apps/mobile/src/hooks/use-feedback-sync.ts)

Refactorizar `flushQueue` para utilizar el cliente de API base.

#### [MODIFY] [messages.tsx](<../../apps/mobile/src/app/(tabs)/messages.tsx>)

Refactorizar el envío de feedback para utilizar el cliente de API base.

#### [MODIFY] [trip-detail-view.tsx](../../apps/mobile/src/components/trip-detail-view.tsx)

Refactorizar el envío de feedback para utilizar el cliente de API base.

---

## Verification Plan

### Automated Tests

- Pruebas unitarias en [api-client.test.ts](../../apps/mobile/src/services/__tests__/api-client.test.ts) — 26 tests, 100% coverage (Stmts/Branch/Funcs/Lines).
- Validación completa del proyecto con `make validate` — 285 tests passing.
