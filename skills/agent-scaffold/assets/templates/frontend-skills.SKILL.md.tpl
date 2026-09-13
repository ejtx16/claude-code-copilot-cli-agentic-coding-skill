---
name: frontend-skills
description: How to build frontend work in {{PROJECT_NAME}} the way this codebase already does it - components, pages and routes, services and API calls, forms, i18n, theme tokens, tests. Use this skill whenever the task touches UI code in this repo, even if the user only says "add a button", "new screen", "call the endpoint from the UI", "fix the form", or "make it match the design".
---

# Frontend skills for {{PROJECT_NAME}}

<!-- agent-scaffold: fill every recipe with the real pattern from this repo (paths, snippets at most 15 lines, checklist).
     Keep under 200 lines. Delete every HTML comment. -->

## Read first

- `.claude/rules/tech-stack.md` - framework, versions, commands.
- `.claude/rules/design-notes.md` - palette, component and page templates.
- `.claude/rules/requirements.md` - roles, workflows, business rules the UI must respect.

## Layer map

| What | Where | Naming |
| --- | --- | --- |
| Components | | |
| Pages / features | | |
| Services / API | | |
| Routing | | |
| State | | |
| Styles / theme | | |
| i18n | | |
| Tests | | |

## Recipes

### Add a component

1. <!-- generator command or manual file set -->
2. <!-- where to register/import -->

```ts
```

### Add a page with a route

1.
2.

```ts
```

### Call an API endpoint

<!-- Service method + typed response envelope + error handling via interceptor. -->

```ts
```

### Add a form

<!-- Controls, validators, submit, error display, ids/names. -->

```ts
```

### Add an i18n key

<!-- Where translations live, key naming, how to use in template. -->

### Use theme tokens

<!-- Variables/utility classes; never hardcode colours. -->

### Write a test

<!-- Test runner, file naming, one minimal spec. -->

```ts
```

## Checklist before finishing

- ids and name attributes on controls and buttons; labels present; semantic HTML.
- Uses existing shared components, pipes and services instead of duplicating.
- Handles loading, empty and error states.
- Respects role-based visibility from requirements.md.
- Runs: <!-- lint / test / build commands from tech-stack.md -->
