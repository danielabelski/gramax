# Gramax — Claude context

## Repos
- **Upstream (code + CI)**: `gitlab.ics-it.ru/ics/doc-reader.git`
- **GitHub mirror (issues only)**: https://github.com/gram-ax/gramax — read-only for code; issues/labels/board live here. Use `gh -R gram-ax/gramax` for issue work. No code MRs on GitHub.

## Rules
- **Read the workspace `CLAUDE.md`** (parent dir). Cross-repo rules (Bun/uv/rg/fd/fzf, `.specs/` at workspace root, GitLab auth) not restated here.
- **MR write/review/board-URL resolve**: skill `merge-request`.
- **UI**: new UI MUST use `@core/ui-kit`. Missing primitive → add under `core/ui-kit/components/<Name>/`. Never ad-hoc styled wrappers in `core/components/`.
- **Overflow text**: whenever text can be truncated, render it with `TextOverflowTooltip` from `@ui-kit/Tooltip`; do not apply Tailwind `truncate` directly to text elements.
- **UI decomposition**: keep container components focused on visibility and composition; move independent controls into dedicated subcomponents that own their hooks, state, and behavior.
- **Editor guards**: before using an editor, check both that it exists and that it has not been destroyed: `if (!editor || editor.isDestroyed) return;`. Do not check only `!editor`.
- **Article CSS units**: in `core/styles/article.css`, use `em` for spatial dimensions and spacing. Use `px` only for visual effects such as borders, outlines, and shadows.
- **DOM performance**: separate DOM reads from DOM writes. Batch reads (`getBoundingClientRect`, `getComputedStyle`, `offset*`, `client*`, `scroll*`) before writes (`style`, `classList`, attributes, DOM mutation, React state); never alternate them in a loop. Do not use `innerText` for search/indexing when `textContent` or a single `TreeWalker` pass is sufficient.
- **Safari CSS selectors**: avoid broad relational selectors such as `body:has(...)`, `.article *:has(...)`, and `:has()` on other high-cardinality roots. DOM mutations can make Safari re-evaluate them across a large subtree. Prefer an explicit class/data attribute set by the component or controller, or an equivalent narrow direct selector. If `:has()` is unavoidable, scope it to the smallest stable subtree and profile `Styles Recalculated` in Safari on a large document.
  - **Never ship `:has()` whose argument is dynamic** — `:hover`, `:focus`, `aria-expanded`, `data-state`, or any attribute that flips during interaction (`:has(*[aria-expanded="true"])`, `has-[input:focus]:`, `[&:has([data-menu-item-action]:hover)]`, Tailwind `has-[...]` over the same). WebKit's `:has()` invalidation is coarse: one such rule anywhere in the loaded CSS makes **every** matching state change recalculate the whole document, and the cost scales with total DOM size, not with what changed. Measured on a board catalog: a single dropdown open cost ~640 ms of `Styles Recalculated` (two forced ~210 ms passes inside `pointerdown` plus one scheduled ~224 ms), constant to ±4% regardless of the change — the signature of a full-document pass. Blink invalidates `:has()` per element, so this is invisible in Chrome; verify in Safari.
  - **Replacements**: `:has(input:focus)` / `:has(...:focus)` → `:focus-within` (has a fast path in WebKit, and is equivalent in nearly every case). Ancestor reacting to a descendant's open state → report the state from React and set `data-*` on the ancestor (see `LeftNavigationTabs/Item.tsx` + `BaseRightExtensions`, `TablePlusActions.tsx` + `PlusMenu`). Wrapper styled only because its child is open → move the class onto the trigger itself as `data-[state=open]:…`. Static structural `:has()` (`has-[iframe]`, `has-[>svg]`, `:has(> ul)`) is fine — the argument never changes.
- **`transition: all` / `transition-all` is banned in anything rendered per row** (list items, tree nodes, property tags, TOC links, diff entries). `all` makes every style change on that element animate and fire `transitionend`, so N rows turn one layout change into N transitions and N JS wake-ups — Safari stutters on scroll. Enumerate the properties actually animated (`transition-[width,padding-left,opacity]`, `transition-colors`). Acceptable only on singleton elements.
- **Shared layout measurements**: shared container dimensions MUST be measured once at the nearest common layout owner and distributed through a stable store/context. Use one `ResizeObserver` per shared container; child components MUST NOT each observe or remeasure the same ancestor. Keep local measurement only for genuinely independent/nested containers.
- **Hot DOM events**: coalesce `resize`, `scroll`, and pointer-move work with `requestAnimationFrame`; skip unchanged React state and DOM style writes. Prefer scrolling the known article container directly; use `scrollIntoView` only as a fallback because it may traverse scroll ancestors and force layout.
- **E2E**: everything lives in `e2e-pw/` (Playwright). Write/run/debug → skill `e2e`. GitLab fixtures come from `gitlab.ics-it.ru` — read-only catalogs in `gx/test`, throwaway repos in `gx/test/temp` (`GX_E2E_GIT_*`).
- **Lint gate**: after edit any TS/JS/JSON run `bunx biome check --write <file>`, fix all. Project gate: `bun run lint` (= `tsc --incremental false && biome ci`).
- **Tests**: `bun run test <path/to/file.test.ts>` single suite (`scripts/run-tests.ts` routes path → jest), `bun run test:unit` for `*.unit.test.ts`, `bun run test:int` integration. `--no-server` / `-n` skips git-http-mock-server boot. Worktree dirs cause `jest-haste-map` collision warnings — harmless.
- **Logging**: no `console.*`. Emit via OpenTelemetry from `@ext/loggers/opentelemetry` — wrap work units in `traced(name, () => …)` (or `@trace()` decorator) to open span, then `span()?.addEvent(name, attrs)` for diagnostics. Outside active span `addEvent` no-ops → caller must be traced. Thrown errors: let `traced` record (`span.recordException`); `addEvent` for non-throwing signals. **Naming**: span + event names use `kebab-case` with `-` separator (`lfs-batch-pull`, not `lfs.batch.pull`). Events render under span → keep event names short, unprefixed (`add`, `flush`, `done`); span name carries namespace.
- **Worktrees**: placement is the workspace rule. After creating one run `./scripts/link-worktree-deps.sh` — it symlinks `node_modules`, `.cache`, `services/node_modules` from main. Never `bun install` inside worktree.
- **Maintainability first**: avoid ad-hoc hacks, prefer explicit wiring. Code that has to be explained is bad code — write plain code instead.
- **Comments**: a block that needs a comment to be understood needs a name — extract a hook/function and let the name carry it. Comment only what the code cannot state (external constraint, race, cost, third-party behaviour), 1–2 lines, never a retelling of the code. House density in `core/` + `apps/` is under 1% of lines. One fact in one place: the same invariant in a prop's JSDoc, in the component and in its caller is three copies that will diverge — the long explanation belongs in the MR description.
- **Honest types over optional guards**: `?` and `?.` are for values that really can be absent, not for callers you did not want to touch. Never `?.` a field the type declares required, and never let a shared component invent a fallback for input its caller should have passed. Check a DTO at its edges — where it enters and where it leaves — instead of guarding every use of it downstream.
- **Component = markup + hooks**: more orchestration above `return` than markup below it → move the orchestration into a hook named after what it maintains. Cut out the whole lifecycle, not one concern of it: a hook that needs four refs passed in hides the coupling instead of removing it.
- **Branches**: `release/*` → production env, `develop` → nightly dev channel, MRs → MR pipeline, `us/*` → user story branch, `epic/*` → epic branch.

### Floating panels
- Build floating panels with `@ui-kit/FloatingPanel`; define a stable panel ID constant and mount the panel once inside the shared `FloatingPanelLayout` tree (for catalog pages, next to the other panels in `CatalogComponent`).
- Triggers MUST use the shared `usePanelToggle(panelId, triggerRef?)` hook. Do not create panel-specific toggle hooks with duplicated open/close/positioning logic.
- Panel content MUST be wrapped in `<ComponentVariantProvider variant="glass">`. Keep the content root `flex min-h-0 flex-1 flex-col` so scrolling belongs to the intended inner section.
- Inputs inside floating panels MUST use `PopoverInput` from `@ui-kit/Input`. Do not use the default `Input`, `TextInput`, or ad-hoc input styling inside a floating panel.
- Use `headerTitle` and `headerActions` for custom header content; do not recreate the panel header or its close/maximize/dock controls inside panel content.

## Layout

| Path | Role |
|------|------|
| `apps/tauri/` | Desktop editor (Tauri + Rust). Dev: `bun run tauri`. |
| `apps/web/` | Web editor (WASM backend). Dev: `bun run web`. |
| `apps/next/` | Docportal (Next.js SSR). |
| `core/` | Shared FE. `ui-kit/` (design system), `components/` (product UI), `ui-logic/`, `logic/`, `extensions/`, `plugins/`. |
| `app/commands/` | Namespaced command tree — canonical FE↔BE call surface. |
| `app/resolveModule/` | Platform-aware module wiring (FE/BE injection + `rustcall/` dispatcher). |
| `crates/` | Rust workspace (`fs`, `git`, `core`, `spa`, `bugsnag`, `opentelemetry`). |
| `e2e-pw/` | Playwright tests. |
| `.ci/` | GitLab CI fragments. |

## Frontend architecture
Shared FE in `core/` runs in 6 envs by `VITE_ENVIRONMENT`: `browser`, `tauri`, `next`, `docportal`, `static`, `cli` (`test` aliases `next`). See `app/resolveModule/env.ts`. Platform code injected via 3 layers — extend right one:

1. `app/resolveModule/index.ts` — `DynamicModules` (FE) / `BackendDynamicModules` (BE) interfaces (Cookie, Router, Fetcher, openInExplorer, initWasm, getDOMParser, …). Each app wires impls at boot.
2. `app/resolveModule/{frontend,backend}/` — per-env impls.
3. `app/resolveModule/rustcall/` — single entry for native FS/git calls. Use `rustCall<O>("fs.<cmd>" | "git.<cmd>", args)`. `initRustCall()` (lazy) picks backend by `getExecutingEnvironment()`: web→wasm worker, tauri→`invoke`, next→Node, static→static, cli→cli. Namespace MUST be `fs` or `git`; `parseCommand` throws otherwise.

### Commands
New backend call → add command under `app/commands/<namespace>/`, not ad-hoc fetcher. `createCommands(app)` (`app/commands/index.ts`) walks tree, injects `_app` (`Application` instance) + `_commands` (full tree) into each leaf so commands call siblings. `findCommand(commands, path)` resolves by `_c.path`. Tree exposed as `window.commands` for in-browser debug.

## Runtime logs (desktop)
NDJSON spans, one per line:
- macOS: `$HOME/Library/Application Support/gramax.dev/logs/`
- Windows: `%APPDATA%/gramax.dev/logs/`
- Linux: `$XDG_CONFIG_HOME/gramax.dev/logs/` (fallback `$HOME/.config/gramax.dev/logs/`)

Files: `gx-YYYY-MM-DD_HH-MM-SS.ndjson`. **Never `cat`** — pipe through `jq`.

Record shape:
```json
{"name":"WorkspaceManager.setWorkspace","spanId":"...","traceId":"...","duration":34.0,"timestamp":1780318178.0,"error":null,"args":null,"result":null,"attrs":{...},"events":[],"parentSpanId":"..."}
```

Snippets (newest file):
```sh
LOG_DIR="$HOME/Library/Application Support/gramax.dev/logs"
LATEST=$(ls -t "$LOG_DIR"/*.ndjson | head -1)

# Top-level spans with duration
jq -c 'select(.parentSpanId == null) | {name, duration}' "$LATEST"

# Errors
jq -c 'select(.error != null) | {name, error, traceId}' "$LATEST"

# Spans for one traceId
jq -c --arg t "<traceId>" 'select(.traceId == $t) | {name, parentSpanId, spanId, duration, error}' "$LATEST"

# Slowest 20
jq -s 'sort_by(-.duration) | .[:20] | .[] | {name, duration}' "$LATEST"
```

Call tree = join records on `parentSpanId → spanId` within `traceId`.
