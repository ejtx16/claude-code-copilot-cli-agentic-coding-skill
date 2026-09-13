# Analysis checklist

What to read to fill each template, with read budgets. Use the `detect` JSON first; open files only for what it cannot tell you. Total budget about 25 reads; use greps and heading extraction instead of whole-file reads where possible.

## tech-stack.md (3-5 reads)

| Need | Source |
| --- | --- |
| Runtime, framework, DB, API layer, auth, libs, versions | `packages[].deps` from detect (exact versions from the manifest) |
| Commands | `packages[].scripts` (already in `{{SCRIPTS}}`) |
| Env var names | `envVarNames` (already in `{{ENV_VARS}}`); never open `.env` |
| Architecture patterns | entry file (`layers.backend.entry` or the app bootstrap), one service, one component; existing `.claude/rules/tech-stack.md` or `.cursor/rules/tech-stack` if present |
| Non-Node stacks | `otherManifests` (requirements.txt, go.mod, pom.xml, csproj) |

## design-notes.md (8-12 reads)

Backend: one file each from `layers.backend.models`, `services`, `controllers`, `routes`, `middlewares`, plus the error classes and logger (grep `class .*Error`, `winston|pino|logger`). Lift the model schema, one service method with try/catch, one controller action with the response envelope, one route with auth middleware and its mount line in the entry file.

Frontend: one file each from `layers.frontend.components` (ts + html + scss of the same component), `pages`, `services`, `routes`, `forms`, `styles`, `i18n`. Extract palette tokens and typography from the theme/styles file (grep `--` custom properties or `$` SCSS variables). Existing design docs (`.cursor/rules/design-notes`, `docs/*design*`) override guesses.

Trim every snippet to 15 lines: keep imports that show the pattern, the signature, one representative body line, the export. Put the source path in the line above the code fence.

## requirements.md (5-8 reads)

| Need | Source, in priority order |
| --- | --- |
| Purpose, stakeholders | README, `docs/*brd*`, `docs/*requirement*`, `docs/*prd*` (headings first, then the overview sections) |
| Roles and access | role constants in code (grep `ROLE|SUPER_ADMIN|permissions`), role matrix in docs |
| Entities | `layers.backend.models` file names plus schema fields; ERD sections in docs |
| Workflows and status transitions | status enums (grep `STATUS|status:` in models/constants), transition maps (grep `TRANSITION|canTransition|allowed`), workflow sections in docs |
| Business rules, validation | docs first; then validators in models/DTOs (`required`, `enum`, `min`, `max`, `validate`) |
| Integrations and side effects | env var names (mail, storage, payment, cron), services named `Email|Storage|Payment|Notification|Cron` |
| Out of scope | docs sections named excluded, deferred, phase 2, roadmap |

Mark anything that only exists in code as "(inferred from code)". Put contradictions between docs and code under Open questions instead of choosing silently.

## frontend-skills / backend-skills (reuse the reads above)

Each recipe = path convention + registration step + one snippet. Take the snippets from the same files used for design-notes; do not read new ones unless a layer was empty. Include the exact test and lint commands from `scripts`.

## AGENTS.md project section (0-1 reads)

README first paragraph, or the purpose you already extracted for requirements.md. Mention sibling repos if `docs` or README name them.
