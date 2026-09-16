# Backend

The backend lives in `apps/backend`. Its Nx project name is `backend`.
Gin handles routing, and Huma registers typed operations, validates inputs, and
generates OpenAPI.

## Endpoint and schema

[`internal/api/api.go`](../../apps/backend/internal/api/api.go) registers
`GET /api/greeting` with operation ID `getGreeting`. The `name` query parameter
defaults to `Lakshya` and accepts between 1 and 80 characters. The handler returns
a greeting, the name, and the language value `go`.

[`cmd/backend/main.go`](../../apps/backend/cmd/backend/main.go) uses the same
registration function to serve HTTP or export OpenAPI without starting a server.

Run from the repository root:

```sh
pnpm exec nx run backend:openapi
pnpm generate
```

The first command exports `apps/backend/openapi.json`. The second also runs
Hey API to update `packages/api-client/src/generated`. Both generated outputs are
tracked in Git. Include regenerated changes when changing an endpoint's contract.

## Server configuration

`API_ADDR` controls the listen address and defaults to `127.0.0.1:8080`.
If you change it, set the frontend's `API_URL` to the corresponding HTTP address.
The backend reads `API_ADDR` from the process environment; it does not load dotenv
files itself.

The backend exposes `/docs`, `/openapi.json`, and JSON schemas under `/schemas/`.
The development command runs `go run`; restart it after editing Go code.

## Checks

Run from the repository root:

```sh
pnpm exec nx run backend:test
pnpm exec nx run backend:format
pnpm exec nx run backend:format:check
pnpm exec nx run backend:lint
pnpm exec nx run backend:lint:config
pnpm exec nx run backend:build
```

`gofmt` comes with Go. The formatting check exits unsuccessfully if any Go file
needs formatting. The build writes `apps/backend/dist/backend`.

The workspace runs golangci-lint v2.13.2 through `go run`, so no global installation
is required. Its first invocation downloads and compiles the tool.
[`.golangci.yml`](../../apps/backend/.golangci.yml) enables `errcheck`, `govet`,
`ineffassign`, `staticcheck`, and `unused`.

The endpoint tests cover the default name, a custom name, and rejection of an
overlong name.
