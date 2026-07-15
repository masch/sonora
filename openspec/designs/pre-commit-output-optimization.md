# Design: Optimizar Output del pre-commit Hook

## Architecture

Cambio localizado en dos archivos: `.githooks/pre-commit` y `Makefile`.
No involucra cambios de arquitectura del proyecto.

## Componentes

### 1. Wrapper `run_step()` en `.githooks/pre-commit`

```sh
run_step() {
  NAME=$1
  CMD=$2
  ALLOWED_EXIT=$3
  printf "  ✓ %s... " "$NAME"
  TMPFILE=$(mktemp)
  if eval "$CMD" > "$TMPFILE" 2>&1; then
    printf "done\n"
    rm -f "$TMPFILE"
  else
    EXIT_CODE=$?
    if [ -n "$ALLOWED_EXIT" ] && [ "$EXIT_CODE" = "$ALLOWED_EXIT" ]; then
      printf "skipped (exit %d)\n" "$EXIT_CODE"
      rm -f "$TMPFILE"
    else
      printf "FAILED (exit %d)\n" "$EXIT_CODE"
      cat "$TMPFILE"
      rm -f "$TMPFILE"
      FAILED_TARGETS="$FAILED_TARGETS $NAME"
    fi
  fi
}
```

- `$1`: Nombre del paso (para output y error reporting)
- `$2`: Comando a ejecutar
- `$3` (opcional): Exit code permitido que no se considera fallo (ej: 2 para gga)

### 2. Modificaciones a Makefile

**Nuevo target `test-ci`**: corre los mismos tests que `make test` pero con:

| Workspace       | Runner | Flags                                                                             |
| --------------- | ------ | --------------------------------------------------------------------------------- |
| apps/mobile     | Jest   | `--passWithNoTests --watchAll=false --silent --reporters=@jest/reporters-summary` |
| apps/api        | Vitest | `run --reporter=basic`                                                            |
| packages/shared | Vitest | `run --reporter=basic`                                                            |
| apps/admin      | Jest   | `--passWithNoTests --watchAll=false --silent --reporters=@jest/reporters-summary` |

**Nuevo target `doctor-ci`**: igual que `doctor` pero sin `--verbose`.

### 3. Flujo completo del pre-commit optimizado

```
inicio
  ├─ [0] Restaurar expo-env.d.ts (sin cambios)
  ├─ [1] run_step "format-check" "make format-check"
  ├─ [2] run_step "test-ci" "make test-ci"
  ├─ [3] run_step "lint" "make lint"
  ├─ [4] run_step "typecheck" "make typecheck"
  ├─ [5] run_step "doctor-ci" "make doctor-ci"
  ├─ [6] run_step "expo-doctor" "make expo-doctor"  (non-blocking)
  ├─ [7] Condicional: si apps/api/* cambiados → run_step "api-validate" "make api-validate"
  ├─ [8] run_step "gga" "make gga" 2  (exit 2 = no staged files, permitido)
  └─ [9] Si FAILED_TARGETS no vacío → exit 1, sino "All checks passed" → exit 0
```

## Consideraciones

### Non-blocking steps

`expo-doctor` tiene falsos positivos con bun. Actualmente imprime error pero no bloquea.
En la nueva versión, se ejecuta con `run_step` pero su fallo NO agrega a `FAILED_TARGETS`.
Se puede lograr con `run_step "expo-doctor" "make expo-doctor" && true` o manejando
el exit code internamente.

**Decisión**: usar `|| FAILED_EXPO=1` y verificar al final: si solo `expo-doctor` falló,
no se bloquea el commit. Si además otro paso falló, se bloquea igual.

### Temp files

Se usa `mktemp` (POSIX) para crear archivos temporales. Se limpian siempre después de
cada paso (tanto en éxito como en fallo). No hay acumulación de temp files.

### Preservación del paso 0

El bloque de restauración de `expo-env.d.ts` se mantiene exactamente igual, antes del
wrapper `run_step()`, porque es lógica de reparación de entorno, no de verificación.
