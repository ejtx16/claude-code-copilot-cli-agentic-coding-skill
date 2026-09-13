# GitHub Copilot CLI formats (verified 2026-09 against docs.github.com)

## Files Copilot CLI discovers

| Purpose | Path | Notes |
| --- | --- | --- |
| Root instructions | `AGENTS.md`, `CLAUDE.md` (also `.claude/CLAUDE.md`), `.github/copilot-instructions.md`, `GEMINI.md` | Combined; duplicates removed; no precedence order, so avoid conflicts |
| Includes | `@relative/path` inside `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | Not inside `*.instructions.md` or `GEMINI.md` |
| Path-scoped instructions | `.github/instructions/**/*.instructions.md` | Frontmatter `applyTo: "glob,glob"`; also user-level `~/.copilot/instructions/` |
| Skills | `.github/skills/`, `.claude/skills/`, `.agents/skills/` | Same `SKILL.md` format as Claude; one copy in `.claude/skills` serves both |
| Custom agents | `.github/agents/<name>.agent.md` (also user-level `~/.copilot/agents/`) | `.claude/agents/` is read by the plugin loader too, but keep a Copilot-native file |
| Hooks | `.github/hooks/*.json`; inline in `.github/copilot/settings.json`; user-level `~/.copilot/hooks/` | Repo hooks are version-controlled |
| Plugins | `copilot plugin install <path | owner/repo | plugin@marketplace>` | Legacy manifest accepts `.claude-plugin/plugin.json`; Agent Plugins 1.0 wants root `plugin.json` + `skills/` + `com.github.copilot/{agents,hooks,commands,rules}` |

## Hooks config

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [ { "type": "command", "bash": "node .claude/hooks/prompt-guard.js --copilot", "powershell": "node .claude/hooks/prompt-guard.js --copilot", "timeoutSec": 5 } ],
    "preToolUse":   [ { "type": "command", "bash": "node .claude/hooks/guard.js --copilot", "powershell": "node .claude/hooks/guard.js --copilot", "timeoutSec": 10 } ],
    "postToolUse":  [ { "type": "command", "bash": "node .claude/hooks/activity-logger.js --copilot", "powershell": "node .claude/hooks/activity-logger.js --copilot", "timeoutSec": 5 } ]
  }
}
```

- Events: `sessionStart`, `sessionEnd`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `agentStop`, `subagentStart`, `subagentStop`, `errorOccurred`, `preCompact`, `notification`, `permissionRequest`.
- `bash` runs on macOS/Linux, `powershell` on Windows; `command` is a cross-platform fallback copied to both. Relative paths resolve from the session cwd, so start `copilot` at the repo root.
- Input JSON (preToolUse): `{ sessionId, timestamp, cwd, toolName, toolArgs }`. `toolArgs` is opaque; the guard probes `command | cmd | path | file_path | filePath | content ...` then falls back to the serialized blob.
- Output (preToolUse): `{ "permissionDecision": "allow" | "deny" | "ask", "permissionDecisionReason": "..." }`. Exit 2 = deny (fail-closed); other non-zero = fail-open; timeout = fail-open.
- `sessionStart` output may include `{ "additionalContext": "..." }`.
- `userPromptSubmitted` command hooks have their output dropped; per-prompt context injection is impossible from config hooks. Enforcement is still per tool call via `preToolUse`.

## Custom agent file

```markdown
---
name: git-reconciler
description: Required. Purpose and triggers.
tools: ["execute", "read", "edit", "search"]
---
Body.
```

Tool aliases (case-insensitive): `execute` (shell/bash/powershell), `read`, `edit` (Edit/Write), `search` (Grep/Glob), `agent`, `web`, `todo`; MCP servers as `server/*`. Optional: `model`, `disable-model-invocation`, `user-invocable`, `mcp-servers`, `target`.

## Permissions

Copilot CLI has no repo-level allow/deny config. Command-line only: `--allow-tool`, `--deny-tool` (wins), `--available-tools`, `--excluded-tools`, `--allow-url`, `--deny-url`, `--allow-all-tools`. Example: `copilot --deny-tool "shell(git push --force*)"`. Saved URL rules go to `settings.json`; `permissions-config.json` does not support deny rules.

## Known upstream issues (verify locally)

- github/copilot-cli#2540: plugin-shipped `hooks.json` `preToolUse` hooks may not fire. This scaffold writes hooks into the repo instead.
- github/copilot-cli#3874: `preToolUse` deny reported flaky in some versions. The guard prints the JSON decision and exits 2 on deny to cover both paths; if it still passes, use `--deny-tool` flags.
