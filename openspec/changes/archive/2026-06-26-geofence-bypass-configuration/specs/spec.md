# Specifications: Geocerca configurable por Experiencia

## Functional Requirements

- Agregar propiedad `geofenceBypassable` a la entidad `experiences` de base de datos.
- Por defecto, si no está configurada, el valor debe ser `false` (bloqueo estricto).
- Si el usuario está lejos del inicio del recorrido:
  - Si `geofenceBypassable` es `false`, se bloquea la reproducción y descarga (como hasta ahora).
  - Si `geofenceBypassable` es `true`, al intentar dar Play o Descargar, se muestra una alerta confirmando si desea continuar salteando la validación.
