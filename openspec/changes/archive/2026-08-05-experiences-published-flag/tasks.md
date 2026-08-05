# Tasks: Flag de publicación por Experiencia

- [x] Schema: agregar `published: boolean('published').notNull()` a la tabla `experiences` en `apps/api/src/db/schema.ts`
- [x] Migración: generar con drizzle-kit; columna con backfill `DEFAULT true` + `ALTER ... DROP DEFAULT` (DB final sin default)
- [x] Seed: setear `published` explícito por experiencia; `pajaros-chiricotes` queda `false` (caso de prueba en vivo — decisión del usuario), el resto `true` (`apps/api/src/db/seed.ts`), respetando cambios locales existentes
- [x] Test RED: listado excluye `published=false` y expone el campo `published` en la respuesta
- [x] Implementar filtro en `GET /experiences` (`routes/experiences.ts`): `.where(eq(experiences.published, true))`
- [x] Test RED: `/audio/stream` rechaza key de experiencia despublicada (404, sin revelar existencia)
- [x] Implementar check de `published` en `/audio/stream` (`routes/audio.ts`): `dbGuard()`, resolver key→experiencias (audio_url propio o de waypoints), rechazar si todas las dueñas están despublicadas
- [x] Test RED: `/payments/create` rechaza experiencia despublicada (404)
- [x] Implementar check en `/payments/create` (`routes/payments.ts`): `if (!experience.published) return EXPERIENCE_NOT_FOUND`
- [x] Test RED: `/experiences/:id/purchased` no revela experiencia despublicada (404)
- [x] Implementar check en `/experiences/:id/purchased` (`routes/payments.ts`)
- [x] Test RED: `/experiences/:id/access` no registra acceso de experiencia despublicada (404)
- [x] Implementar check en `/experiences/:id/access` (`routes/payments.ts`), sin insertar registro
- [x] Typecheck + lint + suite de tests API completa en verde

## Review Workload Forecast

- Archivos tocados: ~6 (schema, seed, experiences.ts, audio.ts, payments.ts, tests) + migración.
- Líneas estimadas: < 300 (incluye tests).
- PRs encadenados: No recomendado (cambio único y acotado).
- Presupuesto de review: 400 líneas — sin riesgo.
