# Spec: Optimizar Output del pre-commit Hook

## Resumen Ejecutivo

Implementar un mecanismo de captura de output por paso en el hook pre-commit para reducir
el output exitoso de ~200 líneas a ~8 líneas, ahorrando tokens del agente en cada commit.

## Alcance

### In Scope

1. **Script `.githooks/pre-commit`**: reemplazar ejecución directa con wrapper `run_step()` que capture stdout+stderr a temp file individual por paso
2. **Nuevo target `make test-ci`**: variante silenciosa de `make test` para pre-commit y CI
3. **Nuevo target `make doctor-ci`**: variante de `make doctor` sin `--verbose`
4. El hook pre-commit existente se modifica **in-place** (no se crea nuevo archivo)

### Out of Scope

- No se instalan nuevas dependencias npm
- No se modifican los targets existentes `make test` ni `make doctor`
- No se cambia la semántica de error del hook
- No se tocan configuraciones de test runners en desarrollo local

## Requerimientos Funcionales

### RF1: Captura de output por paso

Cada paso del pre-commit captura su stdout+stderr a un archivo temporal individual.
En éxito: muestra una línea con "✓ nombre... done".
En fallo: muestra el output completo de ESE paso.

### RF2: Output compacto en éxito

Cuando todos los checks pasan, el output total del hook debe ser aproximadamente:

```
  ✓ format-check... ok
  ✓ test-ci... ok
  ✓ lint... ok
  ✓ typecheck... ok
  ✓ doctor-ci... ok
  ✓ expo-doctor... ok
  ✓ gga... ok
  ✓ All checks passed
```

### RF3: Falla detallada

Cuando un paso falla, se debe mostrar su output completo (sin depender de que el agente
vuelva a ejecutar el comando). Los pasos posteriores se ejecutan igual (fail-fast no aplica,
se quiere recolectar todos los errores de una corrida).

### RF4: Exit code correcto

Si algún paso falla, el hook sale con exit code 1. Si todo pasa, exit code 0.

### RF5: `make test-ci`

```makefile
test-ci: ## Run all tests silently (for pre-commit/CI)
 cd apps/mobile && bun run jest --passWithNoTests --watchAll=false --silent
 cd apps/api && bunx vitest run --reporter=dot --silent
 cd packages/shared && bunx vitest run --reporter=dot --silent
 cd apps/admin && bun run jest --passWithNoTests --watchAll=false --silent
```

Notas:

- `jest --silent` suprime console.log de tests; muestra PASS/FAIL (queremos ver detalle en fallo)
- `vitest --reporter=dot --silent`: dots en éxito, detalle solo en fallo
- `--reporter=summary` existe para Jest pero omite el detalle del test que falló

### RF6: `make doctor-ci`

```makefile
doctor-ci: ## Run React Doctor audit (terse, for pre-commit)
 cd apps/mobile && bunx react-doctor --scope full -y
```

(sin `--verbose`)

### RF7: Manejo de exit codes especiales

- `make gga` retorna exit code 2 cuando gga encuentra violaciones (make propaga el error del recipe como exit 2). No debe bloquear el commit (non-blocking, la AI review puede tener falsos positivos).
- `make expo-doctor` tiene falsos positivos conocidos con bun → debe ser non-blocking pero reportar output en fallo

### RF8: Restauración de `expo-env.d.ts`

El paso 0 que restaura `expo-env.d.ts` si expo-cli lo pisó debe mantenerse sin cambios.

## Output Esperado en Fallo

Cuando falla `make test-ci`:

```
  ✓ format-check... done
  ✓ test-ci... FAILED (exit 1)
<output completo de make test-ci>
  ✓ lint... done
  ✓ typecheck... done
  ✓ doctor-ci... done
  ✓ expo-doctor... done
  ✓ gga... done
pre-commit: Validation failed on targets: test-ci
```

## Criterios de Aceptación

1. Hook con todo OK produce ≤ 10 líneas de output
2. Hook con fallo en un paso produce output completo de ese paso + mensaje de error final
3. `make test-ci` existe y no produce output de tests pasando (solo summary en fallo)
4. `make doctor-ci` existe y no imprime cada check individual
5. `make test` y `make doctor` existentes siguen funcionando igual
6. GGA con exit code 2 (no staged files) no bloquea el commit
7. Expo-doctor fallido no bloquea el commit (non-blocking)
