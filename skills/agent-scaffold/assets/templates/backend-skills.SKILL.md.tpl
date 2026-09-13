---
name: backend-skills
description: How to build backend work in {{PROJECT_NAME}} the way this codebase already does it - models, services, controllers, routes and registration, auth middleware and roles, error classes, logging, tests. Use this skill whenever the task touches server code in this repo, even if the user only says "add an endpoint", "new field", "expose this in the API", "fix the validation", or "add a cron job".
---

# Backend skills for {{PROJECT_NAME}}

<!-- agent-scaffold: fill every recipe with the real pattern from this repo (paths, snippets at most 15 lines, checklist).
     Keep under 200 lines. Delete every HTML comment. -->

## Read first

- `.claude/rules/tech-stack.md` - runtime, framework, versions, commands.
- `.claude/rules/design-notes.md` - layer map and code templates.
- `.claude/rules/requirements.md` - roles, workflows, business rules the API must enforce.

## Layer map

| What | Where | Naming |
| --- | --- | --- |
| Models / schemas | | |
| Services | | |
| Controllers | | |
| Routes | | |
| Middlewares | | |
| DTOs / validation | | |
| Config / env | | |
| Tests | | |

## Recipes

### Add a model or field

<!-- Schema with validation, index, timestamps; migration or seed impact. -->

```js
```

### Add a service method

<!-- Class shape, base service if any, try/catch, custom error class, JSDoc. -->

```js
```

### Add a controller action

<!-- Success and error envelope, status codes, logger. -->

```js
```

### Add a route and register it

<!-- Router file, auth middleware, role check, mount point in the app entry. -->

```js
```

### Protect with auth and roles

<!-- Middleware name, role constants, how to allow a role list. -->

### Handle errors and log

<!-- Error classes with status codes; logger levels; never leak internals. -->

### Write a test

<!-- Test runner and command, file naming, one minimal test. -->

```js
```

## Checklist before finishing

- Auth middleware and role check on the new route; public routes justified.
- Input validated at the boundary; no raw request data in queries.
- Response envelope matches the rest of the API.
- No console logging; no secrets, tokens or PII in logs or responses.
- JSDoc on new public methods; tests added or updated.
- Runs: <!-- syntax check / test commands from tech-stack.md -->
