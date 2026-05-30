# GitHub Issue Description

## Title

`bug(gga): strict mode parser fails when AI provider output includes markdown formatting (e.g., **STATUS: PASSED**)`

## Body

```markdown
### Bug Description

When `STRICT_MODE` is set to `true` in `.gga`, the parser expects to find the exact, unformatted string `STATUS: PASSED` or `STATUS: FAILED` within the first 15 lines of the AI response.

However, modern markdown-capable LLM providers (including the default `opencode`) frequently wrap headers or indicators in standard markdown styling, yielding outputs like:

- `**STATUS: PASSED**` (bold)
- `## STATUS: PASSED` (header)

Because the strict parser performs a literal check without striping markdown decorators first, it fails to match these valid responses, throwing an ambiguous response error and exiting with code 2.

### Constraints & Requirements

- `STRICT_MODE` must remain `true` in the project configuration.
- The `AGENTS.md` configuration file should remain clean and focus only on coding standards, rather than containing prompts to force specific output formatting styles on the LLM.

### Suggested Resolution

Update the parsing logic inside the `gga` binary/script to strip common markdown decorators (`*`, `#`, `_`) and surrounding whitespace from the status lines before performing the `STATUS: PASSED` / `STATUS: FAILED` regex matching.
```
