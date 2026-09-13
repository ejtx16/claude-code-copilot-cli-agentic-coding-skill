# Copilot CLI instructions

@AGENTS.md

## Copilot specifics

- Guard hooks: `.github/hooks/agent-guard.json` runs `.claude/hooks/guard.js` on `preToolUse` (deny secrets, force push, wipes; ask on deletes), `prompt-guard.js` on `sessionStart`, `activity-logger.js` on `postToolUse`. Start `copilot` from the repo root so the relative paths resolve.
- Copilot has no repo-level deny list. For hard enforcement launch with flags, for example:

```bash
copilot --deny-tool "shell(git push --force*)" --deny-tool "shell(git push -f*)" --deny-tool "shell(git reset --hard*)" --deny-tool "shell(rm -rf*)"
```

- Path-scoped instructions: `.github/instructions/*.instructions.md` (generated from `.claude/rules/`; edit the source).
- Skills: `.claude/skills/*` (Copilot reads them). Custom agents: `.github/agents/*.agent.md`.
