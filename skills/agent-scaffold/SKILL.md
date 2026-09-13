---
name: agent-scaffold
description: Scaffold the AI-agent bootstrap for a repository for Claude Code and GitHub Copilot CLI - instruction files (tech-stack, design-notes, requirements), guard hooks (deny secrets and force-push, ask on deletes), frontend/backend skills, a git-reconciler sub-agent, and AGENTS.md / CLAUDE.md / copilot-instructions.md. Use whenever the user wants to set up, bootstrap, initialise or regenerate agent config, rules, hooks, permissions, skills or sub-agents for a project, says "scaffold agents", "set up claude or copilot for this repo", "generate CLAUDE.md or AGENTS.md", "add guard hooks", "protect .env from the agent", "mirror rules to copilot", or starts a new project that needs AI guidance files - even if they only mention one piece.
---

# agent-scaffold

Generate the agent bootstrap for the repository in the current working directory, for Claude Code, Copilot CLI, or both. Deterministic work (detection, hook install, settings merge, agent files, rule mirroring, placeholder filling) is done by `scripts/scaffold.js`; you do the analysis and write the four content files that need judgement. Nothing is ever overwritten: an existing target gets a `<name>.generated.<ext>` sibling instead (unless the user passed `--force`).

Works on Windows and macOS: every command is `node <script>`; paths are forward-slash and quoted; no shell-specific syntax is needed.

## Setup

- `SKILL_DIR` = the directory containing this SKILL.md (Claude Code prints it when the skill loads; inside the plugin it is `<plugin-root>/skills/agent-scaffold`). Set `S="<SKILL_DIR>/scripts"`.
- Arguments from the user: `claude | copilot | both` (default `both`), `--force`, `--dry-run`. Pass them through to every script call.
- Target repo = current working directory (the script climbs to the git top level).
- Read `references/claude-code-formats.md` and `references/copilot-cli-formats.md` once if you need to reason about a generated file; do not re-derive formats from memory.

## Step 1 - Detect

```bash
node "$S/scaffold.js" detect . --tools both
```

Read the JSON. Fields you will use: `projectName`, `kind` (frontend | backend | fullstack | unknown), `packages[]` (name, kind, deps, scripts), `git.remotes`, `repoAllowlist`, `registryHost`, `defaultBranch`, `testCommand`, `envVarNames`, `docs[]`, `layers.backend/frontend` (sample files per layer), `targets[]` (`path`, `exists`, `writeTo`). `writeTo` is the path you must write each file to; it already applies the no-clobber rule.

If `kind` is `unknown` and `otherManifests` is empty, ask the user one question: which skills to generate (frontend, backend, both, none). Otherwise continue without asking.

If `--dry-run`: print the `targets` table (path, exists, writeTo) and stop.

## Step 2 - Deterministic files

```bash
node "$S/scaffold.js" hooks  . --tools both
node "$S/scaffold.js" agents . --tools both
```

`hooks` copies `guard.js`, `prompt-guard.js`, `activity-logger.js` into `.claude/hooks/`, merges the deny/ask lists and hook wiring into `.claude/settings.json` (additive), writes `.github/hooks/agent-guard.json`, and creates `docs/activity-log/`. `agents` writes `git-reconciler` for each tool with the project name, default branch and test command filled in. Both print a JSON list of `{target, action, wroteTo}`; keep it for the final report.

## Step 3 - Analyse the codebase

Follow `references/analysis-checklist.md`. Budget: about 25 file reads. Prefer `docs[]` from detect for business content, `layers` for code snippets, and greps for enums and status lists. Never open files the guard would deny (`.env*`, keys, credentials); use `.env.example` and `envVarNames` for variable names only.

## Step 4 - Instruction files

For each of `tech-stack.md.tpl`, `design-notes.md.tpl`, `requirements.md.tpl`:

```bash
node "$S/scaffold.js" fill tech-stack.md.tpl .
```

The output has mechanical placeholders filled (project name, scripts, env var names, date). Complete the rest from your analysis, delete every HTML comment, respect the caps in the template (tech-stack 80 lines, design-notes 150, requirements 150; snippets 15 lines each, lifted from real files with the source path noted). Write the result with your file tool to the `writeTo` path for `.claude/rules/<name>.md`.

Then, if Copilot is a target:

```bash
node "$S/scaffold.js" mirror .
```

This produces `.github/instructions/<name>.instructions.md` with `applyTo` frontmatter from every `.claude/rules/*.md` (existing rule files included, which is desired).

## Step 5 - Skills

Only for kinds detected (frontend, backend, or both):

```bash
node "$S/scaffold.js" fill frontend-skills.SKILL.md.tpl .
node "$S/scaffold.js" fill backend-skills.SKILL.md.tpl .
```

Fill every recipe with the real pattern from this repo: the path convention, a snippet of at most 15 lines from an actual file, and the registration step. Keep each under 200 lines. Write to the `writeTo` path for `.claude/skills/<name>/SKILL.md`. Copilot reads `.claude/skills`, so there is no second copy.

## Step 6 - Root instruction files

```bash
node "$S/scaffold.js" fill AGENTS.md.tpl .
node "$S/scaffold.js" fill CLAUDE.md.tpl .
node "$S/scaffold.js" fill copilot-instructions.md.tpl .
```

- `AGENTS.md`: complete the Project section (3-5 lines: what the system is, who uses it, the stack in one line, sibling repos). Everything else is already filled: repo allowlist from git remotes, registry host, rule imports, hooks summary, skills and sub-agent lists. If `repoAllowlist` is still the `<REPO_ALLOWLIST>` placeholder (no GitHub remote), leave it and tell the user.
- `CLAUDE.md` (Claude target) and `.github/copilot-instructions.md` (Copilot target): write as produced.
- Write each to its `writeTo` path. When `AGENTS.md` or `CLAUDE.md` already existed, the new content lands as `.generated.md`; in the report tell the user to keep their content and add the missing sections (rule imports, hooks, skills, sub-agents) from the generated file.

## Step 7 - Verify and report

```bash
node "$S/verify.js" .
node "$S/scaffold.js" report .
```

`verify.js` runs the guard fixtures against the installed `.claude/hooks/guard.js` (both payload formats), checks the settings and Copilot hook wiring, and lists pending `.generated` files. Fix anything that fails before reporting.

Final message to the user, in this order:

1. A table of every file: path, action (written / generated / merged / unchanged), owner (claude / copilot / shared).
2. Pending merges: each `.generated` file and what to take from it.
3. Placeholders left for the user (repo allowlist, anything you could not source from docs).
4. Next steps: restart the CLI in the repo root. Claude Code: `/hooks` shows PreToolUse, UserPromptSubmit, PostToolUse; `/agents` shows git-reconciler; asking to read `.env` is denied and `rm` prompts. Copilot CLI: start from the repo root; ask it to `git push --force` and confirm the hook denies; if it does not (upstream issues #2540 / #3874), use the `--deny-tool` flags listed in `.github/copilot-instructions.md`.
5. Platform note: hooks run through `node`, no exec bit or shell needed; Windows and macOS behave the same.

## Rules

- Never write secret values anywhere; names only. Never open `.env*`, keys or credential files.
- Never overwrite; always use the `writeTo` path from detect (or run the scripts, which enforce it).
- Every snippet comes from a real file in this repo with its source path; never invent APIs.
- Mark anything not backed by docs as "(inferred from code)"; list contradictions under Open questions.
- Keep to the line caps. Shorter and accurate beats complete and vague.
- ASCII only, no emojis, 2-space indentation, same style as the repo.
- Do not commit or push. Do not add files under `docs/` other than the activity log directory the hook needs.
