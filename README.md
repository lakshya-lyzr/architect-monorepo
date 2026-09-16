# Architect Monorepo

An Nx workspace with a Next.js frontend and a Go backend built with Huma and Gin.
Go request and response types generate an OpenAPI schema. Hey API turns that schema
into TypeScript types, an HTTP client, and TanStack Query options.

## Get started

Install Node.js 22.18 or newer, pnpm 12.1.0, and Go 1.26 or newer.
The workspace pins pnpm in `package.json` and Go dependencies in `apps/backend/go.mod`.

```sh
git clone https://github.com/lakshya-lyzr/architect-monorepo.git
cd architect-monorepo
pnpm install --frozen-lockfile
pnpm dev
```

Installation sets up Lefthook's Git hooks. The first Go command downloads its dependencies.

| Service                       | Address                            |
| ----------------------------- | ---------------------------------- |
| Frontend                      | http://localhost:3000              |
| Backend API                   | http://127.0.0.1:8080/api/greeting |
| Interactive API documentation | http://127.0.0.1:8080/docs         |
| OpenAPI schema                | http://127.0.0.1:8080/openapi.json |

Enter a name on the frontend to call `GET /api/greeting`. Next.js proxies the request
to Go. The page uses generated TanStack Query options and inferred response types.

## Workspace layout

```text
apps/
  backend/             Go service, endpoint tests, and generated OpenAPI schema
  web/                 Next.js App Router frontend
packages/
  api-client/          Generated Hey API client and TanStack Query options
docs/
  frontend/            UI, query usage, and frontend tooling
  backend/             Endpoints, schema generation, and Go tooling
  common/              Shared workflow, Nx tasks, and Git hooks
tools/                 Formatting and staged Go lint helpers
```

## Commands

Run these commands from the repository root.

| Command             | Purpose                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`          | Generate the client and start both applications                                    |
| `pnpm generate`     | Export OpenAPI from Go and regenerate the frontend client                          |
| `pnpm typecheck`    | Regenerate the contract, generate Next.js route types, and check TypeScript        |
| `pnpm test`         | Run the Go endpoint tests                                                          |
| `pnpm build`        | Build both applications                                                            |
| `pnpm format`       | Format frontend and Go files                                                       |
| `pnpm format:check` | Check formatting without changing files                                            |
| `pnpm lint`         | Run Oxlint and golangci-lint                                                       |
| `pnpm lint:fix`     | Apply available automatic lint fixes                                               |
| `pnpm check`        | Run CI automation tests, lint, formatting checks, tests, type checking, and builds |

Next.js reloads frontend edits during development. The Go process and generated
client do **not** watch for changes. After changing an endpoint, run
`pnpm typecheck`, then restart `pnpm dev` to load the backend changes.

## Verify the type contract

Change the `message` JSON field name in
[`apps/backend/internal/api/api.go`](apps/backend/internal/api/api.go), then run
`pnpm typecheck`. TypeScript reports the frontend's now-invalid
`greeting.data.message` access. Restore the field and run the command again.

This checks the frontend against the generated contract at compile time. The
client does not validate response JSON at runtime or guarantee compatibility with
an independently deployed backend.

## Branches

`dev` is the default branch. Create feature branches from `dev` and merge their
pull requests back into `dev`. Promote tested changes through a release PR from
`dev` into `main`, which represents production. Deployment is not configured yet.

## Continuous integration

[GitHub Actions](.github/workflows/ci.yml) runs relevant project checks on pull
requests targeting `dev` or `main`, pushes to either branch, and manual runs.

| Change                                                       | Checks                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| Backend implementation or Go dependencies; unchanged OpenAPI | Backend + contract verification; frontend skipped       |
| Backend changes OpenAPI                                      | Both projects + contract verification                   |
| Backend tests or Go lint configuration only                  | Backend only                                            |
| Frontend files only                                          | Frontend only; no Go invocation                         |
| Generated client package or Hey API configuration            | Frontend + contract verification                        |
| Committed OpenAPI file only                                  | Contract verification; frontend if the contract changed |
| Root README or files under `docs/` only                      | CI automation tests only; application checks skipped    |
| Shared dependencies, Nx/CI configuration, or unknown paths   | Both projects + contract verification                   |

Backend checks include linting, formatting, Go tests, and the Go build. Frontend
checks include linting, formatting, TypeScript checking, and the Next.js build.
Contract verification regenerates OpenAPI and the client, then rejects generated
changes that were not committed. Combined changes run all relevant checks.

PRs compare against their target branch's base commit. Pushes compare against the
last successful CI push run on the same branch, so changes from failed or cancelled
runs are not missed. Renames and deletions count, and OpenAPI object key order alone
does not trigger frontend checks.

Manual runs, force pushes, missing comparison history, and GitHub API failures run
all checks. The first push run also checks everything if no successful baseline
exists. Newer runs cancel older runs for the same event and Git ref.

The `Workspace checks` result and CI automation tests always run, including for
documentation-only changes. Local `pnpm check` still runs the full suite. See the
[CI workflow guide](docs/common/README.md#continuous-integration) for details.

## Automatic release PR

[Release PR](.github/workflows/release-pr.yml) creates a `dev` → `main` pull request
when a PR merges into `dev`. Later merges update the same open release PR.

Example title: **Release: dev -> main (12 September, 2026, 4 PRs)**.
The date uses Asia/Kolkata and reflects the latest update. The description lists
merged PR titles, links, numbers, and authors under **Merged into dev since the
last release**, followed by an automatic-update footer.

The count includes unreleased PRs, not commits. It resets after a release merges,
including squash or rebase releases. Direct commits and `main` → `dev` sync PRs
do not increase the count. Direct pushes alone do not trigger this workflow;
use its manual run to refresh notes when needed. No release is created when the
branches have identical content.

The workflow also reconciles after a `dev` → `main` release merges. It updates
PR metadata only; it does not merge or deploy. GitHub's built-in token requires
**Allow GitHub Actions to create and approve pull requests** in repository Actions
settings. Bot-triggered PR checks require **Approve workflows to run** from a
writer; see [GitHub's trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
Normal pushes to `dev` continue to run CI automatically.

See the [release workflow guide](docs/common/README.md#automatic-release-pr) for
permissions, edge cases, and manual recovery.

## Documentation

Start with the [documentation index](docs/README.md):

- [Frontend](docs/frontend/README.md)
- [Backend](docs/backend/README.md)
- [Common development workflow](docs/common/README.md)
