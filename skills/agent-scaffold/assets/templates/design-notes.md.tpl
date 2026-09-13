# Design Notes

<!-- agent-scaffold: code templates lifted from THIS repo. Keep under 150 lines total.
     Every snippet is at most 15 lines, trimmed from a real file, with the source path above it.
     Keep only the sections that apply (frontend, backend, or both). Delete every HTML comment. -->

Project: `{{PROJECT_NAME}}` ({{PROJECT_KIND}}). Generated {{DATE}} by agent-scaffold.

## Frontend

### Design system

<!-- Palette tokens (hex + usage), typography scale, spacing, icon set, component library, theme variables and where they live. Prefer a compact table. -->

| Token | Value | Usage |
| --- | --- | --- |
| | | |

### Component

<!-- Source: path/to/example.component.ts (or .tsx/.vue). Show the shape: imports, decorator/props, one input, one output, one signal/state. -->

```ts
```

### Template and styles

<!-- Source: path/to/example.component.html + .scss. Show form field with label, id and name attributes, a button, one theme token usage. -->

```html
```

```scss
```

### Page and route

<!-- Source: app routes file. Show one lazy route with guard/role data if the repo uses them. -->

```ts
```

### Service and API call

<!-- Source: path/to/example.service.ts. Show one typed GET/POST using the shared HTTP client, base URL from environment, response envelope handling. -->

```ts
```

### Form

<!-- Source: a reactive/template form. Show control creation, validation, submit and error display. -->

```ts
```

### Frontend checklist

- ids and name attributes on every control and button; labels for accessibility; semantic elements.
- Palette and spacing via theme tokens or utility classes, never hardcoded colours.
- No `innerHTML`, `eval`, or unsanitized user content; redirect targets allow-listed.
- Consume the API envelope exactly as the backend returns it.

## Backend

### Layer map

<!-- Directory -> responsibility, in request order (routes -> controllers -> services -> models). -->

| Layer | Directory | Responsibility |
| --- | --- | --- |
| | | |

### Model

<!-- Source: models/Example.js. Show schema with validation, index, timestamps, and the export. -->

```js
```

### Service

<!-- Source: services/ExampleService.js. Show the class shape, base class if any, one async method with try/catch and the custom error class. -->

```js
```

### Controller

<!-- Source: controllers/ExampleController.js. Show the response envelope for success and error, status codes, logger usage. -->

```js
```

### Route and registration

<!-- Source: routes/ExampleRoutes.js + the app entry. Show auth middleware, role check, and how the router is mounted. -->

```js
```

### Error handling and logging

<!-- Source: the error classes and logger. Show class names, status codes, and the log call shape. -->

```js
```

### Backend checklist

- Auth middleware and role check on every non-public route.
- Success `{ success, data, message }`, error `{ success: false, message, errors }` (adjust to this repo if it differs).
- Custom error classes for expected failures; logger (not console) for everything else.
- Validate input at the boundary; never trust request bodies in queries.
- JSDoc on public service methods; no secrets or PII in logs or responses.
