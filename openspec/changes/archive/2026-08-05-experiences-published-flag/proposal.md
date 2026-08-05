# Proposal: Flag de publicación por Experiencia

Este cambio agrega a la entidad `experiences` un campo booleano `published` que determina si una experiencia es visible y funcional en la API pública.

Con `published = false` la experiencia queda **totalmente fuera de la API pública**: no aparece en el listado, no se puede reproducir su audio (ni el de sus waypoints) y no admite nuevas compras ni otorga accesos. La exclusión aplica a todos los usuarios, incluidos quienes ya compraron o tenían acceso previo.

## Contexto

Hoy la tabla `experiences` no tiene ningún mecanismo de habilitación/deshabilitación: `GET /experiences` devuelve todas las filas, y las rutas de audio y pagos operan sobre cualquier experiencia existente. No existe forma de retirar de producción una experiencia incorrecta o temporalmente fuera de servicio sin borrarla (con la consiguiente pérdida de accesos, compras y feedback asociados) o modificar datos de manera invasiva.

El flag `published` da un control operativo no destructivo: despublicar conserva la fila y todo su historial, y publicar de nuevo restaura el estado sin migraciones ni reconstrucciones.

## Objetivo

- Agregar `published` (`boolean`, `NOT NULL`, **sin default**) a la tabla `experiences`.
- Hacer que `published = false` excluya la experiencia de toda vía de la API pública: listado, audio/streaming y compras/accesos.
- Backfillear las filas existentes a `true` para que el estado operativo actual no cambie.
- Exigir el valor explícito en toda inserción nueva (el seed lo setea por experiencia).

## Reglas de negocio

1. `published = false` ⇒ la experiencia no aparece en `GET /experiences`.
2. `published = false` ⇒ no se puede reproducir ni descargar su audio, ni el de sus waypoints.
3. `published = false` ⇒ no se puede iniciar una nueva compra ni obtener acceso (`/experiences/:id/purchased`, `/experiences/:id/access`).
4. La exclusión aplica a todos los usuarios por igual, sin excepción por compra o acceso previo.
5. Las tres vías (listado, audio, pagos/access) usan la misma definición de `published` para evitar inconsistencias.
6. `published` es un campo requerido al insertar (NOT NULL sin default); el seed declara el valor explícitamente.

## Alcance

- Schema Drizzle, migración generada, seed y tests de la API.
- Filtros en las rutas públicas del API (`experiences`, `audio`, `payments`).
- Exposición del campo `published` en la respuesta JSON del listado.

## No-goals

- No se toca la app móvil ni la admin (el alta/edición de experiencias sigue sin UI).
- No se agrega fecha de inicio/fin de publicación ni ventanas de visibilidad.
- No se elimina ni se marca borrado lógico de experiencias; el flag es independiente de un futuro soft-delete.
- No se cambia el modelo de accesos/compras (los registros previos persisten, simplemente no se sirven mientras esté despublicada).

## Edge cases declarados

- **Backfill**: la columna se agrega `NOT NULL` con backfill a `true` para las filas existentes, quedando sin default al final de la migración.
- **Compra en curso**: si una experiencia se despublica con una compra pendiente, la compra puede persistir en `pending`, pero nunca deriva en acceso mientras la experiencia esté despublicada.
- **Slug existente despublicado**: la experiencia sigue ocupando su `slug` único; publicarla de nuevo la restaura tal cual.
- **Inserción sin valor**: el `NOT NULL` sin default fuerza al emisor a decidir el estado; el seed setea `true` explícitamente.

## Impacto y tradeoffs

- Cambio de comportamiento del API: clientes que hoy listan todo dejarán de ver experiencias despublicadas (es el objetivo).
- La migración es aditiva y no destructiva; no altera filas ni datos existentes salvo el backfill.
- Se respetan los cambios locales no commiteados en `apps/api/src/db/seed.ts` y locales de `packages/shared`.
