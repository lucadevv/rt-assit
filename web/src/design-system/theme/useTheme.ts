// Re-export the canonical useTheme hook from ThemeProvider so consumers can
// import it from either path. The hook's implementation lives in
// ThemeProvider.tsx (it's tightly coupled to the context defined there).
export { useTheme } from "./ThemeProvider";
export type { Theme, ResolvedTheme } from "./ThemeProvider";
