# agent-scaffold

A plugin for AI coding assistants (Claude Code and GitHub Copilot CLI). Point it at any repo and it sets up everything the AI needs to work there safely: project docs for the AI to read, a safety guard, and a couple of helpers.

**New to this?** A quick glossary:
- **Plugin** - a package you install once that adds new abilities to your AI tool.
- **Skill** - a task the AI can run, written as instructions it follows step by step.
- **Hook** - a script that runs automatically before/after the AI does something, so you can block or log risky actions.
- **Sub-agent** - a specialized assistant for one job (here, fixing git conflicts) that the main AI can call in.

## What it creates

| It creates... | So that... |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md`, Copilot instructions | The AI knows your tech stack, coding style, and business rules |
| A safety hook | Risky commands get blocked or need your OK first (see below) |
| Frontend/backend skill guides | The AI follows your existing code patterns instead of guessing |
| A `git-reconciler` sub-agent | You can say "fix these merge conflicts" and it handles it safely |

It never overwrites your files. If something already exists, the new version is saved next to it as `name.generated.ext` so you can merge by hand.

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
