# Tasks: Optimizar Output del pre-commit Hook

## Task List

- [x] **Task 1**: Agregar target `test-ci` al Makefile
  - File: `Makefile`
  - Flags silenciosos para Jest (`--silent --reporters=@jest/reporters-summary`) y Vitest (`--reporter=basic`)
  - Dependency: none

- [x] **Task 2**: Agregar target `doctor-ci` al Makefile
  - File: `Makefile`
  - Igual a `doctor` pero sin `--verbose`
  - Command: `cd apps/mobile && bunx react-doctor --scope full -y`
  - Dependency: none

- [x] **Task 3**: Modificar `.githooks/pre-commit` con wrapper `run_step()`
  - File: `.githooks/pre-commit`
  - Reemplazar lógica de ejecución con `run_step()` que captura output a temp file
  - `expo-doctor` como non-blocking
  - `gga` con exit code 2 permitido
  - Paso 0 de restauración de `expo-env.d.ts` intacto
  - Dependency: 1, 2

- [ ] **Task 4**: Verificar funcionamiento
  - Ejecutar `make test-ci`, `make doctor-ci`, `make format-check`
  - Dependency: 3

## Dependencies Graph

```
task-1 ─→ task-3 ─→ task-4
task-2 ─→ task-3
```
