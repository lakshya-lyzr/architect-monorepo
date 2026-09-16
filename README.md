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

| Command             | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`          | Generate the client and start both applications                             |
| `pnpm generate`     | Export OpenAPI from Go and regenerate the frontend client                   |
| `pnpm typecheck`    | Regenerate the contract, generate Next.js route types, and check TypeScript |
| `pnpm test`         | Run the Go endpoint tests                                                   |
| `pnpm build`        | Build both applications                                                     |
| `pnpm format`       | Format frontend and Go files                                                |
| `pnpm format:check` | Check formatting without changing files                                     |
| `pnpm lint`         | Run Oxlint and golangci-lint                                                |
| `pnpm lint:fix`     | Apply available automatic lint fixes                                        |
| `pnpm check`        | Run lint, formatting checks, tests, type checking, and builds               |

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

## Documentation

Start with the [documentation index](docs/README.md):

- [Frontend](docs/frontend/README.md)
- [Backend](docs/backend/README.md)
- [Common development workflow](docs/common/README.md)
