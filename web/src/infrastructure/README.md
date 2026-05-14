# Infrastructure layer

Adapters that implement application ports. Concrete bindings to the outside
world: HTTP clients, WebSocket clients, browser APIs (audio capture,
WebRTC), local storage, third-party SDKs (Clerk, Lemon Squeezy).

## Rules

- Implements interfaces defined in `application/ports/`.
- May import from `domain/` and `application/` only.
- MUST NOT be imported from `domain/` or `application/`.
- Wired by the composition root in `infrastructure/di/container.ts`.

## Structure (populated F1+)

```
infrastructure/
  audio/           # AudioCapturePort impl using getUserMedia + AudioWorklet
  ws/              # WebSocketClientPort impl
  http/            # HTTP clients for /api/* (sessions, documents, billing, etc.)
  pip/             # Document Picture-in-Picture launcher (FR-22)
  auth/            # Clerk wrapper -> AuthPort
  di/              # Composition root: container.ts singleton
```

This layer is intentionally empty in F0 — the foundation phase only
delivers the design system. F1 adds auth + HTTP client; later phases add
specific adapters as the use cases that need them are introduced.

## Note on Next.js routing convention

`src/app/` is the Next.js App Router root (framework constraint — it does
not support custom locations). It is logically part of the presentation
layer; the rendering logic for each route still lives in
`src/presentation/`. See `src/presentation/README.md` for details.

