# Presentation layer

React + Next.js routing. Owns user-facing rendering only — never business
logic, never direct API calls. Composes use cases (from `application/`)
through hooks.

## Structure

```
presentation/
  components/   # Compuestos: combinan primitives del design-system
  hooks/        # Hooks que exponen use cases a la UI
```

## Routing — note on Next.js convention

The Next.js App Router has hard-coded discovery paths: it scans `./app` or
`./src/app` only. Custom locations like `src/presentation/app/` are NOT
supported by the framework.

To respect Clean Architecture intent while keeping the framework happy:

- **Routes (page.tsx, layout.tsx, globals.css)** live at `src/app/` because
  Next.js requires that exact path.
- **Components, hooks, and route-level helpers** live here at
  `src/presentation/`.
- Pages in `src/app/*` are intentionally thin — they import composites from
  `src/presentation/components/` and use cases via hooks in
  `src/presentation/hooks/`. The actual rendering logic stays in this
  layer; `src/app/` is only the Next.js binding.

This keeps presentation logic testable independently of Next routing while
satisfying the framework's file-system contract.
