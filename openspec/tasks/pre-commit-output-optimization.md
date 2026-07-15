# Tasks: Optimizar Output del pre-commit Hook

## Task List

### 1. Agregar target `test-ci` al Makefile

- **File**: `Makefile`
- **Description**: Nuevo target que ejecuta tests de todos los workspaces con flags silenciosos
- **Mobile jest**: `--passWithNoTests --watchAll=false --silent`
- **Admin jest**: same flags
- **API vitest**: `--reporter=dot --silent`
- **Shared vitest**: `--reporter=dot --silent`
- **Dependency**: none

### 2. Agregar target `doctor-ci` al Makefile

- **File**: `Makefile`
- **Description**: Nuevo target igual a `doctor` pero sin `--verbose`
- **Command**: `cd apps/mobile && bunx react-doctor --scope full -y`
- **Dependency**: none

### 3. Modificar `.githooks/pre-commit` con wrapper `run_step()`

- **File**: `.githooks/pre-commit`
- **Description**: Reemplazar toda la lógica de ejecución con el wrapper `run_step()` que captura output a temp file
- **Incluye**:
  - Función `run_step()` con soporte de exit code permitido (3er arg opcional)
  - Cada paso envuelto en `run_step "nombre" "comando" [exit_code_permitido]`
  - `expo-doctor` como non-blocking (no agrega a FAILED_TARGETS)
  - `gga` con exit code 2 permitido
  - Paso 0 de restauración de `expo-env.d.ts` se mantiene intacto
- **Dependency**: 1, 2

### 4. Verificar funcionamiento ✅

- **Description**: Verificado: `make test-ci` pasa, `make doctor-ci` compacto, hook funciona, output ~8 líneas en éxito
- **Dependency**: 3

**Resultado**: ✅ `make test-ci` pasa silenciosamente. `make doctor-ci` sin verbose. Hook ~8 líneas. Temp files se limpian en éxito.

## Dependencies Graph

```
task-1 ─→ task-3 ─→ task-4
task-2 ─→ task-3
```

## Review Workload Forecast

- **Estimated changed lines**: ~40 (30 en pre-commit + 10 en Makefile)
- **Chained PRs recommended**: No (single PR, under 100 lines)
- **400-line budget risk**: Low
- **Decision needed before apply**: No
