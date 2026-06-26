# Proposal: Fondo de pantalla con home-Background.jpeg en la Home

Este cambio propone configurar una imagen de fondo (`home-Background.jpeg`) que cubra la pantalla de la Home (`apps/mobile/src/app/(tabs)/index.tsx`) de forma responsiva y adaptativa, unificando los estilos para que los contenedores hijos tengan fondos transparentes.

## User Review Required

> [!NOTE]
> La imagen ya se encuentra en el repositorio bajo la ruta `assets/images/sonora/home-Background.jpeg`.

## Proposed Changes

### [Mobile] Home Screen

#### [MODIFY] [index.tsx](<../../apps/mobile/src/app/(tabs)/index.tsx>)

- Importar `home-Background.jpeg`.
- Cambiar la clase de fondo de `ScrollScreenWrapper` a `bg-transparent`.
- Renderizar la imagen usando `<TwImage>` posicionada absolutamente (`absolute inset-0 w-full h-full`) como primer elemento del wrapper.

## Verification Plan

### Automated Tests

- Ejecutar `npx jest src/__tests__/app-tabs.test.tsx` para verificar que la renderización de la Home no rompa tests existentes.

### Manual Verification

- Levantar el servidor de desarrollo y verificar visualmente en la web/emulador que la imagen de fondo se escale correctamente y no tape el contenido interactivo.
