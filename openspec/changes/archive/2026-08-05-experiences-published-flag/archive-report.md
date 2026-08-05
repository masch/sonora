# Archive Report: Flag de publicación por Experiencia

## Estado final

**Resultado: ARCHIVED — implementado, verificado y cerrado.**

- Change: `experiences-published-flag` (archivado como `2026-08-05-experiences-published-flag`).
- Implementación completa y en verde: **461/461 tests API (40 archivos)**, `tsc --noEmit` exit 0, `eslint .` exit 0.
- Migración `apps/api/migrations/0013_stale_black_bolt.sql` + snapshot `meta/0013_snapshot.json` generados.

## Lo que se entregó

- Columna `published` (`boolean NOT NULL`, sin default) en la tabla `experiences`.
- `published=false` ⇒ experiencia fuera de la API pública: no aparece en `GET /experiences`, no streamea audio (propio ni waypoints) en `/audio/stream`, no inicia compra en `/payments/create`, no otorga acceso en `/experiences/:id/access`, y `/experiences/:id/purchased` responde 404.
- Backfill de filas existentes a `true`; la columna queda sin default en DB (consistente con schema).
- Seed con `published` explícito por experiencia.

## Decisiones del usuario (confirmadas durante el flujo)

1. `published=false` ⇒ la experiencia queda **totalmente fuera** de la API (lista, audio, compras/accesos), sin excepción para compras previas.
2. Campo llamado `published` (no `enabled`/`isEnabled`).
3. Columna `NOT NULL` sin default; inserción exige valor explícito.
4. Seed: `pajaros-chiricotes` queda **despublicada** (caso de prueba en vivo); el resto `true`.
5. `/experiences/:id/purchased` de una experiencia despublicada → `404 EXPERIENCE_NOT_FOUND` (no `{purchased:false}`).

## Evidencia

- `cd apps/api && bunx vitest run` → 40 files / 461 tests passed.
- `cd apps/api && bunx tsc --noEmit` → exit 0.
- `cd apps/api && bunx eslint .` → exit 0.
- Migración `0013`: `ADD COLUMN ... boolean DEFAULT true NOT NULL` + `ALTER COLUMN ... DROP DEFAULT`.

## Follow-ups (fuera de alcance, no bloqueantes)

- `GET /payments/purchases` (historial por email) no filtra por `published`: hoy devolvería compras de experiencias despublicadas. El endpoint **no se usa en la app móvil** (`listPurchases` existe en `payment-client.ts` pero no tiene consumidor). Cuando exista pantalla de historial, decidir si filtrar.

## Alcance respetado

- Solo `apps/api` (+ migración + tests). No se tocaron `packages/shared`, ni apps `mobile`/`admin`.
- Cambios locales previos sin commit en `apps/api/src/db/seed.ts` y `packages/shared/src/locales/{en,es}.ts` preservados e incorporados sin pisarse.
