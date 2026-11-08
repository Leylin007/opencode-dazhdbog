import solidPlugin from "@opentui/solid/bun-plugin"

// OpenCode 2.0.16 skips Solid's TSX transform inside node_modules.
// Compile JSX before publishing; share host runtime dependencies, but bundle
// small pure-JS helpers (jsonc-parser) so the installed folder stays portable.
const result = await Bun.build({
  entrypoints: ["src/tui.tsx", "src/server.ts"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  external: ["@opencode/*", "@opentui/*", "solid-js", "solid-js/*"],
  plugins: [solidPlugin],
})

if (!result.success) throw new AggregateError(result.logs, "Plugin build failed")
