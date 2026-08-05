# Design: Flag de publicación por Experiencia

## Schema Changes

- En `/var/home/masch/dev/js/sonora/apps/api/src/db/schema.ts`, agregar a la tabla `experiences`:
  ```ts
  published: boolean('published').notNull(),
  ```
  Sin default. El tipo `NewExperience` pasará a exigir `published`, y `Experience` lo incluirá en el select.

## Migración y backfill

- La columna es `NOT NULL` sin default y la tabla ya tiene filas, por lo que no puede agregarse con un simple `ADD COLUMN ... NOT NULL` (violaría `NOT NULL` en filas existentes).
- Estrategia vía `drizzle-kit generate`: agregar la columna con **DEFAULT true** para el backfill y, en la misma migración, hacer `ALTER COLUMN ... DROP DEFAULT`, dejando la DB sin default — consistente con `schema.ts`.
- Resultado final en DB: `published boolean NOT NULL` sin default.
- El snapshot de migración (`meta`) debe reflejar la columna sin default, coincidiendo con el schema.
- El seed (`apps/api/src/db/seed.ts`) deberá setear `published: true` explícitamente en `trips`, `tracks` y `generalFeedback`.

## Exclusión por ruta (misma definición de `published`)

### 1. `GET /experiences` — `routes/experiences.ts`

- Agregar `.where(eq(experiences.published, true))` al `db.select().from(experiences)`.
- El campo `published` se expone en la respuesta via el spread de `exp`.

### 2. `GET /audio/stream` — `routes/audio.ts`

- Agregar `dbGuard()` al handler (actualmente usa `privateBucketGuard` + `jwtGuard`, sin inyección de DB).
- Antes de streamear, resolver el `key` a sus experiencias dueñas:
  ```sql
  select distinct experiences.published
  from experiences
  left join waypoints on waypoints.experience_id = experiences.id
  where experiences.audio_url = :key or waypoints.audio_url = :key
  ```
- Regla:
  - Si el `key` pertenece a ≥1 experiencia y **todas** están despublicadas → `problem(c, ERRORS.NOT_FOUND)` (no revelar existencia).
  - Si al menos una dueña está publicada, o el key no tiene dueña → continuar con el streaming.
- Costo: una query extra por stream; aceptable.

### 3. `POST /payments/create` — `routes/payments.ts`

- Ya consulta la experiencia. Agregar, tras el check de existencia:
  ```ts
  if (!experience.published) return problem(c, ERRORS.EXPERIENCE_NOT_FOUND);
  ```
  Impide iniciar una compra nueva de una despublicada (equivalente a "no existe").

### 4. `GET /experiences/:id/purchased` — `routes/payments.ts`

- Consultar la experiencia; si está despublicada → `problem(c, ERRORS.EXPERIENCE_NOT_FOUND)` (no revelar existencia ni estado de compra), en lugar de informar `purchased`.

### 5. `POST /experiences/:id/access` — `routes/payments.ts`

- Ya consulta la experiencia (para `price`). Si `!experience.published` → `problem(c, ERRORS.EXPERIENCE_NOT_FOUND)` sin insertar registro de acceso.

## Tests (TDD, vitest)

- `apps/api/src/__tests__/experiences.test.ts`: el listado excluye experiencias `published=false`; incluye las publicadas; expone el campo `published` en la respuesta.
- Audio: un key de una experiencia despublicada se rechaza (404 / no stream). Reutilizar setup/mocks existentes de audio.
- Payments: `/payments/create` con experiencia despublicada → 404; `/access` no registra acceso de despublicada; `/purchased` de despublicada → 404.

## Consideraciones

- La ruta de audio pasa a depender de la DB (inyección vía `dbGuard`); validar coherencia con `jwtGuard` y `privateBucketGuard`.
- No se toca la app `mobile` ni `admin`.
- Implica una query extra por stream; documentada como tradeoff aceptado.
