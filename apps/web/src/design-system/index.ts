// Susurra Design System — public surface.
// All primitives, tokens + icons re-exported from a single entrypoint
// so consumers in higher layers (presentation/) can import via:
//   import { Button, Pill } from "@/design-system";
//
// NOTE: theme/* (ThemeProvider + useTheme) was removed in Camino C —
// Susurra is a light-only product, no theme context needed.

export * from "./tokens";
export * from "./primitives";
export * from "./icons";
