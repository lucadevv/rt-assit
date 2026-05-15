# @susurra/tsconfig

Shared TypeScript configurations for Susurra workspaces.

- `base.json` — strict TS baseline (ES2022, bundler module resolution, noUncheckedIndexedAccess).
- `nextjs.json` — extends `base.json` with Next.js-specific options (DOM libs, JSX preserve, Next plugin).

Consume from any workspace via `"extends": "@susurra/tsconfig/nextjs.json"`.
