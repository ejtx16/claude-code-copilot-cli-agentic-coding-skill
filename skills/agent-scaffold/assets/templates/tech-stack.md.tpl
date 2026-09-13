# Technology Stack

<!-- agent-scaffold: fill from the detect JSON (packages[].deps, scripts) and the codebase.
     Keep under 80 lines. Versions come from the manifest, never guessed.
     Delete every HTML comment before saving. -->

Project: `{{PROJECT_NAME}}` ({{PROJECT_KIND}}). Package manager: {{PACKAGE_MANAGER}}. Generated {{DATE}} by agent-scaffold.

## Core

| Area | Technology | Version | Notes |
| --- | --- | --- | --- |
| Runtime | <!-- Node.js 18+ / Python / .NET --> | | |
| Framework | <!-- Express / Angular / React / Nest --> | | |
| Database and ODM/ORM | | | |
| API layer | | | <!-- REST, GraphQL, RPC, Swagger --> |
| Auth | | | <!-- JWT, session, OAuth; token lifetimes --> |
| Realtime / messaging | | | |

## Supporting libraries

| Purpose | Package | Version |
| --- | --- | --- |
| Validation and security | | |
| File handling / storage | | |
| Documents / PDF / email | | |
| Utilities (logging, cache, cron) | | |
| Testing and dev tooling | | |

## Commands

```bash
{{SCRIPTS}}
```

## Environment variables (names only; values never belong in any instruction file)

{{ENV_VARS}}

## Architecture patterns

<!-- 3-6 bullets lifted from the code: layering, DI style, async style, error handling, logging, state management. -->
-

## Dependency rules

- Check this file and `package.json` before adding a dependency; prefer what is already installed.
- Match existing major versions; note pinned versions and why.
