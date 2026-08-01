# README Specification

## Purpose

`README.md` is the project's primary entry point and landing page on GitHub and other
code-hosting platforms. It communicates the project's purpose, technology stack, setup
instructions, development workflow, platform support, and contribution guidelines to
developers and contributors.

## Requirements

### Requirement: Project Name and Description

The README MUST begin with a level-1 heading identifying the project name (`# Sonora`),
immediately followed by a short description paragraph explaining what the project is.

#### Scenario: Heading rendered first

- GIVEN a visitor opens the README
- WHEN they view the file
- THEN the first meaningful content they see is `# Sonora`
- AND the paragraph immediately below reads "Universal Expo app targeting iOS, Android, and Web."

### Requirement: Gentle AI Review Badge

The README MUST display a clickable Gentle AI Review badge image as the very first line
of the file, positioned above the `# Sonora` heading.

#### Specification

| Field         | Value                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Markdown      | `[![Gentle AI Review](https://img.shields.io/badge/Gentle_AI_Review-Reviewed-brightgreen)](https://github.com/features/actions)` |
| Badge label   | `Gentle AI Review`                                                                                                               |
| Badge message | `Reviewed`                                                                                                                       |
| Badge color   | `brightgreen`                                                                                                                    |
| Badge service | [Shields.io](https://shields.io) — stable, free, universally resolvable                                                          |
| Link target   | `https://github.com/features/actions`                                                                                            |
| Placement     | Line 1 of `README.md`, before the `# Sonora` heading                                                                             |

#### Format

```
[![Gentle AI Review](https://img.shields.io/badge/Gentle_AI_Review-Reviewed-brightgreen)](https://github.com/features/actions)

# Sonora
```

The badge line MUST be followed by exactly one blank line before the `# Sonora` heading.

#### Scenario: Badge renders at the top

- GIVEN a visitor opens the README on GitHub
- WHEN they view the page
- THEN they see a badge image reading "Gentle AI Review | Reviewed" in bright green
- AND the badge is a clickable link to `https://github.com/features/actions`

#### Scenario: Badge is the first file content

- GIVEN the README is read as raw text
- WHEN the first line is inspected
- THEN it MUST be exactly `[![Gentle AI Review](https://img.shields.io/badge/Gentle_AI_Review-Reviewed-brightgreen)](https://github.com/features/actions)`
- AND the second line MUST be empty
- AND the third line MUST be `# Sonora`

### Requirement: No Other Changes

The change MUST NOT alter any other part of `README.md`. All existing headings, sections,
code blocks, links, and formatting MUST remain identical to the original file, byte-for-byte
for unmodified lines.

#### Scenario: Existing content preserved

- GIVEN the README after the change
- WHEN any line below the `# Sonora` heading is inspected
- THEN its content MUST match the original file exactly
- AND no lines are added, removed, or modified below line 3

## Acceptance Criteria

1. The badge image renders correctly in GitHub's Markdown renderer.
2. The badge links to `https://github.com/features/actions` when clicked.
3. The original `# Sonora` heading remains at line 3 (after badge + blank line).
4. `git diff` shows exactly:
   - One added line (the badge markdown)
   - One added blank line
   - No deletions, no modifications to existing content
5. The change produces a non-trivial diff suitable for the Gentle AI review pipeline.
