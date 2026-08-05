# Specifications: Flag de publicación por Experiencia

## Functional Requirements

### Campo publicado

- Agregar la propiedad `published` de tipo `boolean` a la entidad `experiences` de base de datos.
- `published` debe ser `NOT NULL` y **sin default**: toda inserción debe declarar el valor explícitamente.
- La columna debe quedar sin default al finalizar la migración; las filas existentes se backfillean a `true`.

### Exclusión de la API pública

- Una experiencia con `published = false` no debe aparecer en `GET /experiences`.
- Una experiencia con `published = false` no debe permitir reproducir ni descargar su audio, ni el audio de sus waypoints, a través de la ruta de streaming.
- Una experiencia con `published = false` no debe permitir iniciar compra (`/experiences/:id/purchased`) ni otorgar acceso (`/experiences/:id/access`).
- La exclusión aplica a todos los usuarios por igual, incluido quien ya compró o tenía acceso previo.
- Las rutas de listado, audio y pagos deben utilizar la misma definición de `published` para garantizar consistencia.

### Respuesta del API

- El campo `published` debe exponerse en la respuesta JSON del listado `GET /experiences`.

### Seed y datos existentes

- El seed debe setear `published: true` explícitamente en cada experiencia.
- La migración no debe alterar el estado operativo actual de las experiencias existentes (quedan publicadas).
