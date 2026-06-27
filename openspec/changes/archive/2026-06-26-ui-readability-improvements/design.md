# Design Document: Mejoras de legibilidad en el listado de Trips y Tracks

## Architecture & Layout

- Componente modificado: `ExperiencesScreen` en `apps/mobile/src/components/experiences-view.tsx`.
- Estilos aplicados al contenedor `TwPressable` de la fila:
  - Clase Tailwind: `flex-row items-center gap-4 px-5 py-4 rounded-[24px] active:opacity-75`
  - Prop de estilo `backgroundColor`:
    - `colors.homeExploreRoutesBg` si `selectedFormat === 'trip'`
    - `colors.homeExploreTracksBg` si `selectedFormat === 'track'`
- Estilos aplicados a los textos hijos (`ThemedText`):
  - Título: color `colors.homeCardText`
  - Descripción y duración: color `colors.homeCardSubtext`
- Estilo del ícono de menú de acciones:
  - `tintColor={colors.homeCardText}`
