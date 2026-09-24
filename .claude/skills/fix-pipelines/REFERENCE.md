# fix-pipelines — harness reference

How to reproduce each CI test job locally. All commands run from `gramax/`
(`cd gramax` first). Non-enterprise only — see **Out of scope** at the bottom.

## Preflight (JS / e2e harnesses)

```sh
cd gramax
./install-deps.sh --ci --node          # deps; drop --node for e2e-pw jobs (they use --ci only)
npm rebuild better-sqlite3 --build-from-source
# smoke the two native modules the harnesses load:
node -e "require('canvas').createCanvas(1,1).getContext('2d')"
node -e "const D=require('better-sqlite3'); new D(':memory:').close()"
```

**Native addon `gramax-core.node`** — required by the catalog/FS/multilingual
jest suites and by *every* next/docportal e2e. Build it with:

```sh
bun run --cwd apps/next/crates/next-gramax-core build   # == the *:build-git scripts
```

First build compiles the Rust workspace (slow); later builds are incremental.

## Jest suites — CI job `tests`

Runner: `scripts/run-tests.ts` (via `bun run test:*`). It auto-manages the
git-http mock server and fixtures — **always go through the `test:*` scripts,
never raw `jest`**. Flags baked in: `--runInBand --forceExit --ci`.

```sh
bun run tsc --incremental false     # typecheck (job runs this first)
bun run test:unit                   # **/*.unit.test.ts
bun run test:int                    # **/*.int.test.ts
# narrow to one file while iterating:
bun run test:unit path/to/foo.unit.test.ts
```

## Rust — CI job `tests-rust`

```sh
./gx make-icons
cargo test --all-targets -p spa       --tests --manifest-path ./Cargo.toml
cargo test --all-targets -p gramax-git --tests --manifest-path ./Cargo.toml
```

## Biome / lint — CI job `biome`

```sh
bun run biome ci --diagnostic-level error
# MR-scoped (only changed files vs target), mirrors the job:
bun run biome ci --no-errors-on-unmatched --error-on-warnings \
  --files-ignore-unknown=true --changed --since=origin/<target-branch>
```

(The `lint` package script also runs `tsc` — biome alone won't catch type
errors.)

## Playwright e2e — `e2e-pw/` project

Pattern: build the app → start it in the background → run the Playwright
project. Ports differ per app. Failure artifacts land in `e2e-pw/report`.

| Job | Build | Start (bg) | Run |
| --- | --- | --- | --- |
| `web-e2e-pw` | `bun run --cwd e2e-pw web:build` | `bun run --cwd e2e-pw web:start &` (PORT 6001) | `bun run --cwd e2e-pw web:ci` |
| `next-e2e-pw` | `next:build-git` then `next:build` | `next:start &` (PORT 6003) | `next:ci` |
| `docportal-e2e-pw` | `docportal:build-git` then `docportal:build` | `docportal:start &` (PORT 6004) | `docportal:ci` |

```sh
# next example (mirrors the job):
bun run --cwd e2e-pw next:build-git
bun run --cwd e2e-pw next:build
bun run --cwd e2e-pw next:start &
until curl -s --max-time 5 -o /dev/null http://127.0.0.1:6003/; do sleep 1; done
bun run --cwd e2e-pw next:ci
```

`next:ci`/`docportal:ci` set `ROOT_PATH=$(pwd)/<app>-test-data` and run a
`*-prepare` project before the main one — the package scripts already handle
that, run them as-is. `next:start`/`docportal:start` wipe+recreate their
test-data dir on each start.

## GitLab fixtures — `GX_E2E_GIT_*`

All e2e jobs talk to `gitlab.ics-it.ru`. Values live in `.ci/tests.yml`
(`.e2e-gitlab-env`); only `GX_E2E_GIT_TOKEN` is a CI variable.

| Var | Role |
| --- | --- |
| `GX_E2E_GIT_HOST` | server host, no scheme |
| `GX_E2E_GIT_GROUP` | group holding the read-only fixture catalogs |
| `GX_E2E_GIT_TEMP_GROUP` | group receiving the throwaway repos of a run |
| `GX_E2E_GIT_TEST_REPO` / `..._NO_INDEX` | the two fixture catalogs |
| `GX_E2E_RUN_ID` | pipeline id — temp repos are named `e2e-$GX_E2E_RUN_ID-*` |
| `GX_E2E_GIT_TOKEN` | Dedicated PAT (project- or group-level CI variable; independent from `AI_GITLAB_TOKEN`) |

The PAT needs `api` and `write_repository` scopes. Its owner must be able to read the fixture
projects in `gx/test`, create projects in `gx/test/temp`, and delete the projects it creates. Keep
the CI variable masked; mark it protected only if E2E runs exclusively on protected refs.

Temp repos are deleted by the Playwright `globalTeardown`. Leftovers are swept by
the scheduled `e2e-temp-cleanup` job (`$E2E_CLEANUP == "true"`), which runs
`./.ci/e2e/delete-repos.ts` — run it locally with `--dry-run` first.

## static (cli) — CI job `static-e2e-pw`

Exercises the **CLI build path** (the `playwright --project static` run is
commented out in the job). Needs the `GX_E2E_GIT_*` creds — the same ones the
e2e jobs use — to clone the fixture catalog:

```sh
cd apps/cli
git clone "https://git:$GX_E2E_GIT_TOKEN@$GX_E2E_GIT_HOST/$GX_E2E_GIT_GROUP/$GX_E2E_GIT_TEST_REPO.git"
bun run build
bun run dist/index.js build -s "$GX_E2E_GIT_TEST_REPO" --skip-check
```

## Common failure signatures

| Signature in trace | Cause / fix |
| --- | --- |
| `Build failed because of webpack errors` + `better-sqlite3/lib/*` import trace | native module not rebuilt → `npm rebuild better-sqlite3 --build-from-source` |
| catalog/FS/multilingual jest suite fails at load / missing `gramax-core.node` | build the addon (`*:build-git`) |
| `canvas` load error | `install-deps.sh` + rebuild; check the canvas smoke line |
| e2e times out waiting on the port | app didn't start — check the `*:start &` process / build step |
| job killed / OOM / exceeded `CI_JOB_MAX_DURATION` | runner infra, not code — bump resources/timeout in the job (CI fix, push direct) |

## Out of scope

- **Enterprise harnesses** — `ges` (`bun run test:ges`), all `*-enterprise`
  jobs, keycloak/GES stack. They need the enterprise env
  (`scripts/enterprise/test-local/`, keycloak secrets, `NODE_TLS_REJECT_UNAUTHORIZED=0`)
  that this skill doesn't set up.
- The CI job that *invokes* this skill — wired separately.
