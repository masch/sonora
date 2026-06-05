# Proposal: Cambiar fuente global a Caveat

## Intent

Reemplazar la fuente global de la app (`Spline Sans`) por **Caveat**, una fuente manuscrita alineada con la identidad visual del proyecto.

## Scope

### In Scope

- Instalar `@expo-google-fonts/caveat` y registrar via `expo-font` config plugin en `app.config.ts`
- Actualizar `--font-sans` en `src/global.css` — Caveat como primer valor, remover override iOS `system-ui`
- Actualizar `openspec/specs/nativewind-styling/spec.md` línea 36 (referencia a Spline Sans)
- `npx expo prebuild` + development build

### Out of Scope

- Cambiar `--font-mono`, `--font-serif`, `--font-rounded`
- Cargar con `useFonts` (flash de fuente)
- Variable fonts (incompatible con Expo)

## Capabilities

### New Capabilities

None — cambio de configuración puro.

### Modified Capabilities

- `nativewind-styling`: requisito en spec preservando `Spline Sans` → cambia a `Caveat`.

## Approach

`@expo-google-fonts/caveat` + `expo-font` plugin (object syntax). 4 pesos (Regular 400, Medium 500, SemiBold 600, Bold 700) mapean 1:1 con `font-medium`, `font-semibold`, `font-bold`.

1. `bunx expo install @expo-google-fonts/caveat`
2. Agregar plugin `expo-font` en `app.config.ts` con `fontFamily: "Caveat"`
3. `--font-sans`: anteponer `Caveat` en `:root`, eliminar `@media ios { --font-sans: system-ui }`
4. Actualizar spec nativewind-styling
5. `npx expo prebuild` + dev build

Sin cambios en consumidores (`TwText`, `ThemedText`) — la fuente se hereda por CSS.

## Affected Areas

| Area                                        | Impact   | Description                                 |
| ------------------------------------------- | -------- | ------------------------------------------- |
| `package.json`                              | Modified | Nueva dep `@expo-google-fonts/caveat`       |
| `app.config.ts`                             | Modified | Agregar plugin `expo-font`                  |
| `src/global.css`                            | Modified | `--font-sans` → Caveat; borrar iOS override |
| `openspec/specs/nativewind-styling/spec.md` | Modified | Línea 36: Spline Sans → Caveat              |

## Risks

| Risk                                       | Likelihood | Mitigation                               |
| ------------------------------------------ | ---------- | ---------------------------------------- |
| Expo Go no soporta fonts via config plugin | High       | Usamos dev builds; documentar limitación |
| PostScript name distinto de "Caveat"       | Low        | `@expo-google-fonts` estandariza naming  |

## Rollback Plan

1. `bun remove @expo-google-fonts/caveat`
2. Revertir `app.config.ts`, `global.css`, y el spec
3. `npx expo prebuild` + dev build

## Dependencies

- `@expo-google-fonts/caveat`

## Success Criteria

- [ ] App buildea sin errores en iOS, Android, Web
- [ ] Todo texto renderiza con Caveat en pesos correctos
- [ ] `make validate` pasa (typecheck + lint + tests)
