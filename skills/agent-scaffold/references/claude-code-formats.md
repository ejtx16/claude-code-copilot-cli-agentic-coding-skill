# Claude Code formats (verified 2026-09 against code.claude.com/docs)

## Files Claude Code discovers

| Purpose | Path | Notes |
| --- | --- | --- |
| Root instructions | `CLAUDE.md` (also `.claude/CLAUDE.md`) | Supports `@relative/path` imports, nested up to 5 levels |
| Rules | `.claude/rules/*.md` | Auto-loaded; optional `paths:` frontmatter scopes a rule to globs |
| Settings | `.claude/settings.json` (shared), `.claude/settings.local.json` (gitignored) | Merged with `~/.claude/settings.json`; later levels add, never remove |
| Hooks scripts | anywhere; convention `.claude/hooks/*.js` | Referenced from settings via `$CLAUDE_PROJECT_DIR` |
| Skills | `.claude/skills/<name>/SKILL.md` | Frontmatter `name`, `description`; invocable as `/<name>` |
| Sub-agents | `.claude/agents/<name>.md` | Frontmatter `name`, `description`, `tools`, optional `model` |
| Plugins | `.claude-plugin/plugin.json` + `skills/ agents/ commands/ hooks/hooks.json` | Dev-load with `claude --plugin-dir <path>`; `/reload-plugins` |

## settings.json permissions

```json
{
  "permissions": {
    "allow": ["Bash(npm test)"],
    "ask": ["Bash(rm:*)", "Bash(git branch -D:*)"],
    "deny": ["Read(./.env)", "Read(**/.env.*)", "Edit(**/.env*)", "Bash(git push --force:*)", "mcp__server__tool"]
  }
}
```

- Rules run before hooks. `deny` wins over `allow`.
- File rules: `Read|Edit|Write(<glob>)`; `./` is project-relative, `**` any depth, `~/` home.
- Bash rules: prefix form `Bash(git push:*)` or glob form `Bash(git push * --force*)`. Leading `VAR=x` assignments are stripped; each subcommand of `&&`, `||`, `;`, `|` is checked; `$()` contents are checked.
- MCP tools: `mcp__<server>__<tool>` exact name.

## Hooks in settings.json

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash|PowerShell|Edit|Write|Read|mcp__.*",
        "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard.js\"", "timeout": 10 } ] }
    ],
    "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/prompt-guard.js\"" } ] } ],
    "PostToolUse": [ { "matcher": "Edit|Write|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/activity-logger.js\"" } ] } ]
  }
}
```

- `matcher` is matched against `tool_name`: exact names separated by `|`; other special characters make it a regex (`mcp__.*`). Omit for all tools.
- Hook stdin (PreToolUse): `{ session_id, hook_event_name, tool_name, tool_input: { command | file_path | content | new_string ... }, cwd, permission_mode }`.
- PreToolUse decision: exit 0 and print

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "why" } }
```

  `permissionDecision` is `allow | deny | ask`. Exit 2 also blocks (stderr becomes the reason). Other non-zero exits are ignored (fail-open).
- UserPromptSubmit: plain stdout (exit 0) is added to context on every prompt; or `{ "hookSpecificOutput": { "hookEventName": "UserPromptSubmit", "additionalContext": "..." } }`.
- SessionStart: same context injection, once.
- `$CLAUDE_PROJECT_DIR` = project root; `${CLAUDE_PLUGIN_ROOT}` = plugin dir inside plugin hooks.
- Windows: commands run through the same mechanism; quote paths (spaces are common).

## Sub-agent file

```markdown
---
name: git-reconciler
description: When to use it, in pushy detail; this is the trigger.
tools: Bash, Read, Edit, Grep, Glob
---
System prompt body.
```

`model` accepts `sonnet | opus | haiku | inherit` (omit to inherit).

## Skill file

```markdown
---
name: backend-skills
description: What it does and when to trigger, with the phrases users actually say.
---
Body under 500 lines; put big material in references/ and link it.
```

Plugin skills are invoked as `/<plugin>:<skill>`.

## Plugin manifest

```json
{ "name": "agent-scaffold", "description": "...", "version": "0.1.0", "author": { "name": "..." }, "license": "MIT" }
```

Local marketplace for install: `.claude-plugin/marketplace.json` with `plugins: [{ "name", "source": "./" }]`, then `/plugin marketplace add <path>` and `/plugin install <plugin>@<marketplace>`.
