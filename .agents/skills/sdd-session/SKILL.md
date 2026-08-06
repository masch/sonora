---
name: sdd-session
description: "Trigger: /sdd-new, SDD, spec-driven development, arrancate un SDD. Inicia y guía una sesión completa de Spec-Driven Development con gentle-ai (proposal, specs, design, tasks)."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract
Usar cuando el usuario solicita iniciar una sesión SDD (`/sdd-new` o pedido de SDD).

## Hard Rules
- Consultar de a UNA pregunta por vez antes de escribir especificaciones.
- Respetar la jerarquía OpenSpec: `proposal.md` -> `specs/` -> `design.md` -> `tasks.md`.
- Sincronizar estado con `gentle-ai sdd-status <change>` y `gentle-ai sdd-continue <change>`.

## Execution Steps
1. Crear el directorio `openspec/changes/<change-name>/`.
2. Redactar la propuesta inicial en `proposal.md`.
3. Entrevistar al usuario de a una pregunta por vez para refinar `specs/` y `design.md`.
4. Generar la lista de tareas en `tasks.md`.
5. Ejecutar `gentle-ai sdd-status <change-name>` para validar la alineación del orchestrador.
