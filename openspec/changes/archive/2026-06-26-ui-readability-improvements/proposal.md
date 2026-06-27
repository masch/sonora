# Proposal: Mejoras de legibilidad en el listado de Trips y Tracks

Este cambio propone transformar los items del listado de experiencias (`ExperiencesScreen`) en tarjetas (cards) con fondos sólidos para solucionar los problemas de contraste y legibilidad de texto sobre la imagen de fondo de la pantalla.

## User Review Required

> [!NOTE]
> Se utilizan los mismos colores de fondo definidos para las tarjetas del Home (`colors.homeExploreRoutesBg` para trips y `colors.homeExploreTracksBg` para tracks) junto con sus respectivos colores de texto (`colors.homeCardText` y `colors.homeCardSubtext`) para asegurar consistencia y accesibilidad.

## Proposed Changes

### [Mobile] Experiences Component

#### [MODIFY] [experiences-view.tsx](../../apps/mobile/src/components/experiences-view.tsx)

- Estilizar el contenedor de fila `TwPressable` agregando padding `px-5 py-4` y bordes redondeados `rounded-[24px]`.
- Asignar el color de fondo correspondiente según el formato utilizando `colors.homeExploreRoutesBg` y `colors.homeExploreTracksBg`.
- Modificar el color de los textos internos (`title`, `description`, `duration`) y el color de tintado (`tintColor`) del ícono de menú de acciones utilizando las variables de texto del home.

## Verification Plan

### Automated Tests

- Ejecutar los tests de la pantalla de experiencias:
  ```bash
  cd apps/mobile && bun jest src/__tests__/experiences.test.tsx --watchAll=false
  ```

### Manual Verification

- Levantar el servidor de desarrollo y verificar visualmente en la pantalla de Trips que los ítems ahora tengan un fondo verde agua (trip) o azul claro (track) con texto oscuro altamente legible.
