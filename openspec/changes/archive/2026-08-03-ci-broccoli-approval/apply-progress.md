# Apply Progress — ci-broccoli-approval

Cambio: `ci-broccoli-approval` · Store: both (openspec + engram) · Branch: `feat/ci-broccoli-approval`
Fecha de apply: 2026-08-03 (session apply única, sin batches previos — primer apply-progress).

## Structured status consumido/producido

```yaml
schemaName: spec-driven
changeName: ci-broccoli-approval
artifactStore: both
applyState: ready # previo; all_done al terminar la task de implementación
dependencies:
  apply: ready
  verify: pending # requiere parent-lifecycle (bounded review) antes de verify
  archive: blocked
taskProgress:
  total: 1 # implementation-owned
  complete: 1
  remaining: 0
  unchecked: []
deferredParentActions:
  remaining: 1 # "Start or reuse bounded review after apply" (parent-owned, no tocada)
actionContext:
  mode: repo-local
  workspaceRoot: /var/home/masch/dev/js/sonora
  allowedEditRoots: [branch feat/ci-broccoli-approval]
  warnings: []
```

## Tareas completadas (y checkbox persistido)

| id  | resultado                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | `.github/workflows/broccoli-approval.yml` creado (job único `broccoli-gate`, UN step `actions/github-script@v8`). Checkbox `- [x] Implement and verify the YAML workflow behavior (T1–T4). <!-- sdd-owner: implementation -->` marcado en `tasks.md` (línea 63). |
| T2  | Prettier aplicado a los archivos nuevos + a `design.md`/`tasks.md` (estaban sin formatear de las fases de planning; solo whitespace). `make format-check` pasa.                                                                                                  |
| T3  | `docs/broccoli-approval-gate.md` creado (config manual Branch Protection + verificación live §8 del design).                                                                                                                                                     |
| T4  | `openspec/changes/ci-broccoli-approval/state.yaml` creado siguiendo la convención del repo (evidencia: `openspec/changes/archive/2026-07-26-google-play-publishing/state.yaml`). NO se creó `config.md` dentro de changes.                                       |

## Files changed

- `.github/workflows/broccoli-approval.yml` (nuevo)
- `docs/broccoli-approval-gate.md` (nuevo)
- `openspec/changes/ci-broccoli-approval/state.yaml` (nuevo, tracking)
- `openspec/changes/ci-broccoli-approval/tasks.md` (checkbox T1–T4 `[x]`; formateado prettier)
- `openspec/changes/ci-broccoli-approval/design.md` (solo prettier/whitespace)
- `openspec/changes/ci-broccoli-approval/proposal.md` (sin cambios, verificado por prettier)

No se tocó `ci-pr.yml` ni código de apps.

## Comandos de verificación ejecutados

1. `python3 -c yaml.safe_load(...)` → `YAML_OK, name= Broccoli PR Approval Gate` (+ asserts estructurales: perms=4 items exactos, `cancel-in-progress: false`, 3 grupos de eventos + `workflow_dispatch`, types exactos, `runs-on: ubuntu-latest`, `if` guard, 1 step `actions/github-script@v8`).
2. `actionlint` → **no disponible** (no está en el tooling del repo: no existe en PATH ni en Makefile ni en `.github/actions`). Fallback documentado: YAML parse + syntax check JS del script.
3. Syntax check JS del script (envuelto en async fn por el `return` top-level del wrapper de github-script): `JS_SYNTAX_OK`. Semántica emoji verificada en node: `'\u{1F966}' === '🥦'` OK; regex `/\\u{1F966}/u` matchea `LGTM 🥦`; `/:broccoli:/u` matchea `LGTM :broccoli:`; no matchea comentario plano (no false success).
4. `make format-check` → `All matched files use Prettier code style!` (sin cambios pendientes).
5. `git status --short` → solo archivos nuevos del change (workflow, doc, openspec/); **no** `ci-pr.yml` ni `apps/`.

## Verificación estructural (design Section 8 + checklist tasks.md)

- `permissions.statuses`: exactamente 4 items (`contents: read, issues: write, pull-requests: write, statuses: write`).
- `concurrency.cancel-in-progress: false`; `group: broccoli-gate-${{ github.event.pull_request.number || github.event.issue.number }}`.
- `on:` → `pull_request [opened, synchronize, reopened]` + `issue_comment [created]` + `pull_request_review [submitted]` + `workflow_dispatch`.
- Context constante `Check PR broccoli comment` exact (capital C, sin espacios).
- Script: head SHA SIEMPRE `prData.head.sha` (fetch vivo `pulls.get`); guard `prData.base.ref !== 'main'` → return sin escribir status; `synchronize` → `pending` `Awaiting \u{1F966} broccoli comment...` con `target_url` del run; evaluación post-head con `>` estricto sobre `committer.date`, último comentario, `/\u{1F966}/u` (flag u) O `/:broccoli:/u` → `success`/`failure`; sin comentarios post-head → `failure`.
- El literal 🥦 NO aparece en el workflow (0 matches): se usa el escape `\u{1F966}` tanto en el regex como en las descripciones de status (el emoji queda semanticamente en el status escrito, cumpliendo la DoD de T1 `Awaiting 🥦 broccoli comment...`, y el archivo queda encoding-safe).

## TDD evidence

Strict TDD declarado (`strict_tdd: true` en config.yaml) pero no aplica TDD unitario: el deliverable es un workflow YAML de GitHub Actions sin unidad de test. Método de "test" usado: verificación estructural (parse YAML + asserts de invariantes) + syntax check JS + `make format-check`, según el checklist de tasks.md. No hay ciclo RED/GREEN aplicable.

## Deviations from design

- Descripciones de status usan `\u{1F966}` en vez del emoji literal (misma string semántica; alinea con la nota "file stays encoding-safe" y con el checklist "el literal 🥦 NO aparece en el script"). El regex de match sigue siendo `/\u{1F966}/u`.
- `make format` (tree-wide) NO se corrió: se formateó solo los archivos del change para evitar tocar archivos no relacionados; `make format-check` global pasa igual.
- `sleep` helper se mantiene del sample del design (sin `await sleep(...)`, como indica la nota de design §4).

## Remaining tasks / deferred

- `- [ ] Start or reuse bounded review after apply. <!-- sdd-owner: parent -->` — acción parent, NO implementada ni tocada (se reporta como deferred lifecycle action).
- Verificación runtime live post-merge (5 pasos de design Section 8) documentada en `docs/broccoli-approval-gate.md`; corresponde a verify/archive, no a apply.

## Workload / PR boundary

~200 líneas nuevas (workflow ~120 + doc ~110 + state/tasks). Forecast: `400-line budget risk: Low`, `Chained PRs recommended: No`, `Decision needed before apply: No`, delivery `single-pr`. Un solo PR, sin cadena.
