# Proposal: Optimizar Output del pre-commit Hook

## Resumen

Reducir drásticamente el output del hook `.githooks/pre-commit` cuando todos los checks pasan,
para que el agente de IA consuma menos tokens durante la ejecución de un commit.

## Problema

El hook actual ejecuta 7+ pasos secuenciales (`format-check`, `test`, `lint`, `typecheck`, `doctor`,
`expo-doctor`, `gga`, y condicionalmente `api-validate`). Cada paso imprime output verbose incluso
cuando pasa exitosamente. En total son ~120-200+ líneas de output en el "happy path", la gran
mayoría innecesarias para el agente que solo necesita saber que todo está OK.

Esto es un problema porque:

- Cada línea significa tokens consumidos por el LLM
- El agente ejecuta el hook en cada commit
- El output exitoso no aporta información útil

## Solución Propuesta

### 1. Captura de output por paso (core)

Wrapper `run_step()` que capture stdout+stderr de cada paso a un archivo temporal individual.
En éxito: muestra "✓ nombre... done" (una línea). En fallo: hace `cat` del temp file de ESE
paso y lo agrega a la lista de fallos.

### 2. Target `make test-ci` (nuevo)

Variante silenciosa de `make test` usando:

- **Jest** (mobile, admin): `--silent` + `--reporters=@jest/reporters-summary`
- **Vitest** (api, shared): `--reporter=basic`

### 3. Target `make doctor-ci` (nuevo)

Variante de `make doctor` **sin** `--verbose`.

### 4. Modificar `.githooks/pre-commit`

- Usar `run_step()` para todos los pasos
- `make format-check` → run_step
- `make test-ci` → run_step (en lugar de `make test`)
- `make lint` → run_step
- `make typecheck` → run_step
- `make doctor-ci` → run_step
- `make expo-doctor` → run_step
- `make gga` → run_step (con manejo de exit code 2 como no-fallo)
- `make api-validate` → run_step condicional

### 5. Output esperado

**Antes** (~120-200+ líneas en éxito):

```
Running make test...
PASS src/__tests__/foo.test.ts
PASS src/__tests__/bar.test.ts
Tests: 15 passed, 15 total
Running make doctor...
[react-doctor] checking rule-1...
[react-doctor] checking rule-2...
...
Running make gga...
[GGA] Scanning staged files...
...
pre-commit: All checks passed
```

**Después** (~7-8 líneas en éxito):

```
  ✓ format-check... done
  ✓ test-ci... done
  ✓ lint... done
  ✓ typecheck... done
  ✓ doctor-ci... done
  ✓ expo-doctor... done
  ✓ gga... done
  ✓ All checks passed
```

## Cambios Concretos

| Archivo                | Cambio                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `.githooks/pre-commit` | Reemplazar toda la lógica con `run_step()` con temp files individuales |
| `Makefile`             | Agregar target `test-ci` con flags silenciosos                         |
| `Makefile`             | Agregar target `doctor-ci` sin `--verbose`                             |

## No Goals

- No cambiar el comportamiento funcional de ningún check
- No cambiar la semántica de error (si algo falla, el commit se bloquea igual)
- No instalar nuevas dependencias (usar solo reporters built-in de Jest/Vitest)
- No tocar los test runners en desarrollo local (solo un target nuevo)

## Review Workload

Cambios pequeños y acotados: ~50 líneas modificadas en total. Un solo PR.
