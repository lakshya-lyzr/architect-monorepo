# Common development workflow

Nx coordinates the `backend`, `api-client`, and `web` projects. pnpm manages the
JavaScript workspace; Go manages backend dependencies through `go.mod` and `go.sum`.

## Contract generation

The task dependency chain is:

```text
backend:openapi → api-client:generate → web:dev / web:typecheck / web:build
```

Huma exports the schema from registered Go operations. Hey API reads that schema
using [`openapi-ts.config.ts`](../../openapi-ts.config.ts) and generates TypeScript
types, a fetch client, SDK functions, and TanStack Query options.

Nx caches generation and configured check/build tasks. Mutating format and lint-fix
tasks are not cached. To investigate a cache-related problem, rerun a target with
`--skip-nx-cache`.

## Daily workflow

1. Run `pnpm install --frozen-lockfile` after cloning or pulling dependency changes.
2. Run `pnpm dev` to start both applications.
3. After changing Go endpoints, run `pnpm typecheck` and restart the dev command.
4. Run `pnpm check` before submitting changes.
5. Review and stage source changes together with any regenerated schema or client files.

`pnpm format`, `pnpm format:check`, `pnpm lint`, and `pnpm lint:fix` cover the two
application projects. They do not currently check root documentation, root tooling,
or the generated client package. `pnpm test` runs the backend tests only.

## Pre-commit hook

The `prepare` script installs Lefthook during `pnpm install`.
[`lefthook.yml`](../../lefthook.yml) runs these jobs sequentially:

1. Oxfmt formats matching staged frontend files and re-stages them.
2. Oxlint checks matching staged frontend JavaScript and TypeScript files.
3. `gofmt` formats staged Go files and re-stages them.
4. golangci-lint analyzes the backend and filters findings to staged Go files.

Go analysis still needs the full package context, so compilation failures outside
the staged files can block the hook. The hook does not run tests, builds, or
TypeScript checking; run `pnpm check` for those.

To run the hook manually without committing:

```sh
pnpm exec lefthook run pre-commit
```

Before a repository's first commit, Lefthook refuses partially staged files because
its backup step requires an existing commit. Fully stage each file for that initial
commit. Review the staged diff after automatic formatting.

## Current scope

This repository contains a local end-to-end demo. It does not yet configure CI,
production deployment, automatic Go reload, or continuous client regeneration.
Frontend and backend releases must preserve their shared API contract; generated
types alone do not enforce compatibility between independently deployed versions.
