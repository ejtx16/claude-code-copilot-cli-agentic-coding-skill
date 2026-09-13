# agent-scaffold

A plugin for AI coding assistants (Claude Code and GitHub Copilot CLI). Point it at any repo and it sets up everything the AI needs to work there safely: project docs for the AI to read, a safety guard, and a couple of helpers.

**New to this?** A quick glossary:
- **Plugin** - a package you install once that adds new abilities to your AI tool.
- **Skill** - a task the AI can run, written as instructions it follows step by step.
- **Hook** - a script that runs automatically before/after the AI does something, so you can block or log risky actions.
- **Sub-agent** - a specialized assistant for one job (here, fixing git conflicts) that the main AI can call in.
- **CLAUDE.md/AGENTS.md** - plain-English project docs the AI reads before it touches your code: your stack, conventions and rules. `AGENTS.md` is the shared one; `CLAUDE.md` and `.github/copilot-instructions.md` are thin tool-specific wrappers around it (see below).

## What it creates

| It creates... | So that... |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md`, Copilot instructions | The AI knows your tech stack, coding style, and business rules |
| A safety hook | Risky commands get blocked or need your OK first (see below) |
| Frontend/backend skill guides | The AI follows your existing code patterns instead of guessing |
| A `git-reconciler` sub-agent | You can say "fix these merge conflicts" and it handles it safely |

It never overwrites your files. If something already exists, the new version is saved next to it as `name.generated.ext` so you can merge by hand.

## AGENTS.md and CLAUDE.md

These are the docs the AI loads before it works in your repo. One shared file, plus a thin wrapper per tool.

### AGENTS.md - the canonical file

Lives in your repo root and is tool-neutral: Claude Code, Copilot CLI, or anything else that reads it gets the same brief. The scaffold fills it in from what it detects in your repo (project name and kind, git remotes, package registry) and leaves `<!-- agent-scaffold: ... -->` comments where you should add the parts only you know.

Sections it ships with:

| Section | Holds |
| --- | --- |
| Project | 3-5 lines: what the system is, who uses it, the stack, sibling repos |
| General Principles | Style and workflow rules - keep solutions small, review files before refactors, ask before big changes |
| Code Quality | Data structures, least privilege, no needless dependencies, pin versions from your dependency file |
| Version Control | Atomic commits, clear messages, no auto-push, repo allowlist |
| AI Restrictions | No customer personal data, no credentials, verify packages against your registry |
| Always-apply standards | Imports `.claude/rules/tech-stack.md` and `requirements.md` so they load every session |
| Scoped guidance | Files the AI should read only when relevant, like `design-notes.md` before UI work |
| Hooks / Skills / Sub-agents | Inventory of what is installed, so the AI knows what it can call |

### CLAUDE.md - the Claude Code entry point

Claude Code auto-loads `CLAUDE.md` at the start of every session. Ours is deliberately short: `@AGENTS.md` pulls in the shared brief, then a few Claude-only notes - where permission rules live (`.claude/settings.json`), where hook scripts live (`.claude/hooks/`), that rules auto-load from `.claude/rules/`, and where skills and sub-agents live (`.claude/skills/`, `.claude/agents/`).

### .github/copilot-instructions.md - the Copilot CLI entry point

Same pattern: `@AGENTS.md` plus Copilot-only notes - hook config at `.github/hooks/agent-guard.json`, the `--deny-tool` flags for hard enforcement, path-scoped instructions in `.github/instructions/`, and custom agents in `.github/agents/`.

### Which one do I edit?

Put anything both tools should know in **AGENTS.md**. Touch `CLAUDE.md` or `copilot-instructions.md` only for tool-specific plumbing. `.github/instructions/` is generated from `.claude/rules/` - edit the rule file, then re-run the mirror step, or your change gets overwritten.


## Install

```bash
git clone <this-repo-url> agent-scaffold
cd agent-scaffold
```

**Claude Code**, try it without installing:

```bash
claude --plugin-dir .
```

**Claude Code**, install for good:

```
/plugin marketplace add /path/to/agent-scaffold
/plugin install agent-scaffold@agent-scaffold-local
```

**Copilot CLI**:

```bash
copilot plugin install /path/to/agent-scaffold
```

No dependencies to install — it's plain Node.js. Works on Windows, macOS and Linux with Node 18+ and git.

## Use

Go to the repo you want to set up, then in Claude Code:

```
/agent-scaffold:agent-scaffold both
```

(`both` covers Claude and Copilot; use `claude` or `copilot` for just one. Add `--dry-run` to preview first, `--force` to overwrite existing files.)

In Copilot CLI, just ask: *"scaffold the agent config for this repo."*

## What gets blocked

| It stops... | Because it's... |
| --- | --- |
| Reading/writing `.env` files, API keys, passwords, credentials | Secrets that should never touch source code or chat history |
| `git push --force`, `git reset --hard`, deleting git history | Hard to undo and risks losing teammates' work |
| Wiping folders (`rm -rf`), dropping databases | Destructive and irreversible |

Less severe actions (deleting a single file, `git clean`, removing a branch) just ask you to confirm first, instead of blocking outright.

This is a safety net, not a lock — it catches the common cases, not every possible trick.

## Good to know

- Copilot CLI can't show a reminder on every single message the way Claude Code can; instead it reminds itself once per session.
- Start `copilot` from your repo's root folder so its hook can find the right files.
