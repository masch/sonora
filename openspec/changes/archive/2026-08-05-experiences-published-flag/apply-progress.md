# Apply Progress: Flag de publicación por Experiencia

## Estado

Implementación completa (TDD: RED → GREEN). Suite API completa en verde: **40 archivos, 461 tests**.

## Cambios realizados

| Archivo                                         | Cambio                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/db/schema.ts`                     | Columna `published: boolean('published').notNull()` en tabla `experiences` (sin default). `NewExperience` exige el valor.                                                                                                                                                      |
| `apps/api/migrations/0013_stale_black_bolt.sql` | Migración generada con drizzle-kit + backfill: `ADD COLUMN published boolean DEFAULT true NOT NULL` + `ALTER COLUMN published DROP DEFAULT`. Snapshot `meta/0013_snapshot.json` sin default (consistente con schema).                                                          |
| `apps/api/src/db/seed.ts`                       | `published` explícito en las 5 experiencias: `true` ×4 y `false` ×1 (`pajaros-chiricotes`, decisión de usuario: caso de prueba en vivo).                                                                                                                                       |
| `apps/api/src/routes/experiences.ts`            | `GET /experiences` filtra `.where(eq(experiences.published, true))`. Bonus: `baseUrl` con try/catch (patrón payments.ts).                                                                                                                                                      |
| `apps/api/src/routes/audio.ts`                  | `/audio/stream`: si hay DB, resuelve key→experiencias (audio_url propio o waypoints); si todas las dueñas están despublicadas → 404.                                                                                                                                           |
| `apps/api/src/routes/payments.ts`               | `/payments/create` y `/experiences/:id/access`: `!experience.published` → `EXPERIENCE_NOT_FOUND` (access no inserta). `/experiences/:id/purchased`: experiencia despublicada o inexistente → `EXPERIENCE_NOT_FOUND` (decisión del usuario: 404 en vez de `{purchased:false}`). |
| `apps/api/src/scripts/test-mp-polling.ts`       | Inserción de test incluye `published: true` (requerido por NOT NULL sin default).                                                                                                                                                                                              |

## Tests

- Nuevos: experiences (filtro + exposición), audio (stream de despublicada → 404), payments create (despublicada → 404), purchased (despublicada → 404), characterization access (404 sin insert).
- Mocks actualizados con `published: true` en tests existentes que ejercitan `/payments/create`, `/access` y `/purchased`.
- RED confirmado (4 fallos) → GREEN total (461).

## Evidencia

- `cd apps/api && bunx vitest run` → 40 files / 461 tests passed.
- `cd apps/api && bunx tsc --noEmit` → exit 0.
- `cd apps/api && bunx eslint .` → exit 0.

## Notas / decisiones durante apply

- `/purchased` resuelve la experiencia primero; despublicada o inexistente → `EXPERIENCE_NOT_FOUND` (404, decisión del usuario). Characterization test actualizado al nuevo contrato.
- El check de audio solo corre si hay DB (`c.var.db`); en producción `injectDb` siempre la provee.
- No se tocaron `packages/shared` ni las apps mobile/admin. Cambios locales previos sin commit (seed.ts, locales) preservados.
- `pajaros-chiricotes` queda despublicada en seed (decisión del usuario: caso de prueba en vivo).

## Pendientes / follow-ups potenciales

- `GET /payments/purchases` (listado de compras por email) no filtra por `published`; decidir si debe ocultar experiencias despublicadas del historial.
