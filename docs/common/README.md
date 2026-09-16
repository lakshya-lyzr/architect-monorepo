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

## Branch workflow

| Branch           | Purpose                                        | Pull request target  |
| ---------------- | ---------------------------------------------- | -------------------- |
| Feature branches | Individual changes, starting from `dev`        | `dev`                |
| `dev`            | Default branch and integration of feature work | `main` for a release |
| `main`           | Production code                                | —                    |

Create feature branches from an up-to-date `dev`. Merge feature PRs into `dev`,
then use a release PR from `dev` to `main` to promote tested changes. Nx uses
`dev` as its default comparison base for affected-project commands.

This branch structure does not deploy either branch automatically.

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

## Continuous integration

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) defines one GitHub
Actions job named `Workspace checks`, running on Ubuntu 24.04.

| Event                                  | When CI runs                                       |
| -------------------------------------- | -------------------------------------------------- |
| Pull request targeting `dev` or `main` | When opened, reopened, or updated with new commits |
| Push to `dev` or `main`                | After a merge or direct push                       |
| Manual dispatch                        | From the repository's Actions tab                  |

Draft pull requests and documentation-only changes also run CI. A feature-branch
push without an open pull request does not trigger it. A newer run cancels an
older run for the same event and Git ref.

The workflow first checks the CI automation tests and determines relevant projects.
It always reports one `Workspace checks` result, including on documentation-only
changes, so required checks do not remain pending.

| Changes                                                            | Backend checks | Frontend checks | Regenerate and verify contract |
| ------------------------------------------------------------------ | -------------- | --------------- | ------------------------------ |
| Backend implementation or Go dependencies; unchanged OpenAPI       | Yes            | No              | Yes                            |
| Backend changes that change OpenAPI                                | Yes            | Yes             | Yes                            |
| Backend tests or Go lint configuration only                        | Yes            | No              | No                             |
| Frontend files only                                                | No             | Yes             | No                             |
| Client package or Hey API configuration                            | No             | Yes             | Yes                            |
| Shared dependencies, Nx configuration, CI policy, or unknown paths | Yes            | Yes             | Yes                            |
| Root README or files under `docs/` only                            | No             | No              | No                             |

Combinations take the union of the required work. A direct edit to the committed
OpenAPI file triggers regeneration and comparison. Formatting-only JSON changes
do not count as contract changes; object key order is ignored, while array order
and all schema values remain significant.

For PRs, CI compares the target base SHA from the event with the checked-out merge
commit. This includes the full PR, not just its latest commit. For pushes, it
compares against the most recent successful push run of this workflow on the same
branch that is an ancestor of the current commit. This covers work left unchecked
by cancelled or failed runs. It examines up to 300 successful runs; if none provides
a usable baseline, it runs everything. Force pushes, manual runs, missing history,
and API failures also select the full checks. Renames inspect both the old and new
paths, and deleted files count as changes.

Node.js 24.19.0 runs the selector without installing dependencies. Application
checks install the pnpm version from `package.json` with the frozen lockfile.
Go 1.26.7 is installed only when backend checks or contract generation need it.
The pnpm store and Go dependencies/build cache are cached; Nx task outputs are
not restored across CI runs.

Backend checks run linting, formatting checks, tests, and the Go build. Frontend
checks run linting, formatting checks, TypeScript checking, and the Next.js build.
Frontend tasks run sequentially and omit Nx task dependencies: CI already decides
whether generation is required, so frontend-only changes do not invoke Go.

When generation is required, CI exports the current OpenAPI schema and regenerates
the client. It rejects modified, deleted, or newly generated files that were not
committed. It compares the generated schema with the baseline's committed schema
to decide whether backend edits require frontend checks. Missing or malformed
baseline schemas select the frontend; malformed generated schemas fail the job.
Run `pnpm generate` and commit its output to fix a stale-contract failure.

Run `pnpm test:ci` to test CI selection and release automation locally. `pnpm check` still runs all
local checks, including those tests; selective execution applies only to CI.

The workflow has read-only repository access and does not deploy or push fixes.
To make passing CI mandatory before merging, configure branch protection or
rulesets for both `dev` and `main` requiring `Workspace checks`. The workflow alone does not
prevent merges.

## Automatic release PR

[`.github/workflows/release-pr.yml`](../../.github/workflows/release-pr.yml) runs
when a PR merges into `dev`, when a same-repository `dev` → `main` PR merges, or
when dispatched manually from Actions. Closing an unmerged PR skips the job.
It reads the latest branch tips and creates or updates one open `dev` → `main` PR.

The title uses `Release: dev -> main (12 September, 2026, 4 PRs)`, with the current
Asia/Kolkata date, a full month name, and a count of distinct unreleased PRs.
The body contains a production-branch introduction, a **Merged into dev since the
last release** heading, linked PR titles/numbers and authors, and an update footer.
The automation owns the title and body; manual edits are replaced on its next run.

The script paginates merged PR history and matches merge commits against unreleased
Git ancestry. For a prior merge release, it uses that merge's second parent as
the released `dev` snapshot. For squash or rebase releases, it uses the merged
release PR's recorded head. This prevents already released PRs from being counted
again even when their original commit IDs are absent from `main`.

Direct commits can appear in the release diff but do not increase the PR count.
Same-repository `main` → `dev` synchronization PRs are also excluded. An identical
branch tree or a `dev` tip already contained in `main` needs no new release PR.
Keep the long-lived branches' history intact; rewriting it can break the link
between merged PR records and the commits currently on the branches.

Runs are serialized and reread branch tips before and after writing. A concurrent
manual PR creation is handled by updating that PR. Repeated branch movement,
duplicate open release PRs, API failures, or oversized notes fail explicitly.
After resolving a failure, rerun **Release PR** from Actions to reconcile current
state. The script supports `--dry-run` to preview without changing PRs.

The job uses Node and Git only; it installs no application dependencies and runs
no application builds. It runs the release automation tests before updating GitHub.
The normal CI job also includes these tests in `pnpm test:ci`.

The workflow requests `contents: read` and `pull-requests: write` using the built-in
`GITHUB_TOKEN`. Enable **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests**. No extra secret is
needed. The job only creates or edits PRs; it never approves, merges, or deploys.
Its `pull_request_target` trigger checks out only the trusted `dev` branch after
a merge, never an incoming feature branch with the write-capable token.

[GitHub's token trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
require a repository writer to select **Approve workflows to run** for PR checks
triggered by `GITHUB_TOKEN`. The ordinary push CI on `dev` remains automatic.
Merges performed by another workflow using `GITHUB_TOKEN` may not trigger the
closed-PR event; use manual dispatch to reconcile those merges.

## Current scope

This repository contains a local end-to-end demo. It does not yet configure
production deployment, automatic Go reload, or continuous client regeneration.
Frontend and backend releases must preserve their shared API contract; generated
types alone do not enforce compatibility between independently deployed versions.
