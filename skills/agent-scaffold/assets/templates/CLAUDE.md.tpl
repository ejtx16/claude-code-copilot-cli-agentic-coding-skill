# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Hooks and permission rules live in `.claude/settings.json` (`permissions.deny` / `permissions.ask` run before the `PreToolUse` guard). Scripts: `.claude/hooks/guard.js`, `prompt-guard.js`, `activity-logger.js`.
- Rules are auto-loaded from `.claude/rules/`; the Copilot copies in `.github/instructions/` are generated from them.
- Skills: `.claude/skills/*`. Sub-agents: `.claude/agents/*` (invoke via `/agents` or by asking for the task).
- Regenerate this bootstrap with the `agent-scaffold` plugin: `/agent-scaffold:agent-scaffold both`. After editing a rule file run the mirror step so Copilot stays in sync.
