# Verify Report: Flag de publicación por Experiencia

## Resultado: PASS

Validación de cada requisito funcional de `specs/spec.md` contra la implementación (evidencia: suite API 459/459, `tsc`, `eslint`, inspección de migración).

## Requisitos

| Requisito (spec)                                                    | Estado  | Evidencia                                                                                                                                                                             |
| ------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propiedad `published` boolean en entidad `experiences`              | ✅ PASS | `schema.ts`: `published: boolean('published').notNull()`                                                                                                                              |
| `NOT NULL` sin default; inserción exige valor explícito             | ✅ PASS | Schema sin `.default()`; snapshot `meta/0013_snapshot.json` sin `default`; `tsc` exige el campo en todo insert                                                                        |
| Backfill de filas existentes a `true`; columna sin default al final | ✅ PASS | `0013_stale_black_bolt.sql`: `ADD COLUMN ... DEFAULT true NOT NULL` + `ALTER COLUMN ... DROP DEFAULT`; journal idx 13                                                                 |
| `published=false` ⇒ no aparece en `GET /experiences`                | ✅ PASS | `routes/experiences.ts`: `.where(eq(experiences.published, true))`; test `filters out unpublished...` verde                                                                           |
| `published=false` ⇒ sin audio (propio ni waypoints)                 | ✅ PASS | `routes/audio.ts`: resolución key→dueñas (audio_url propio o waypoints); 404 si todas despublicadas; test `rejects stream...` verde                                                   |
| `published=false` ⇒ sin compra ni acceso                            | ✅ PASS | `/payments/create` y `/access`: `EXPERIENCE_NOT_FOUND` (access sin insert); `/purchased`: experiencia despublicada → `EXPERIENCE_NOT_FOUND` (404, decisión del usuario); tests verdes |
| Exclusión para todos, incluido compra previa                        | ✅ PASS | Listado filtra en origen; `/purchased` no revela; sin excepción por acceso previo                                                                                                     |
| Misma definición de `published` en listado, audio y pagos           | ✅ PASS | Columna única `experiences.published` usada en las 3 vías                                                                                                                             |
| Campo `published` en la respuesta JSON del listado                  | ✅ PASS | Spread de `exp` (select completo); test `exposes the published field` verde                                                                                                           |
| Seed setea `published` explícito                                    | ✅ PASS | `seed.ts`: 5 experiencias con valor explícito (`true` ×4, `false` ×1 en `pajaros-chiricotes` — decisión del usuario: caso de prueba en vivo de una experiencia despublicada)          |
| Migración no altera estado operativo actual                         | ✅ PASS | Backfill a `true` = estado publicado actual                                                                                                                                           |

## Observaciones

- `/audio/stream` condiciona el check a la presencia de DB (`c.var.db`); en producción `injectDb()` global siempre la inyecta.
- `/purchased` resuelve la experiencia primero: despublicada o inexistente → `EXPERIENCE_NOT_FOUND` (404, decisión del usuario; characterization actualizado).
- Decisión del usuario: `pajaros-chiricotes` queda despublicada en seed (caso de prueba en vivo).
- Follow-up no bloqueante: `GET /payments/purchases` (historial) no filtra por `published` — fuera de alcance de esta spec (el endpoint no se usa hoy en la app móvil).
