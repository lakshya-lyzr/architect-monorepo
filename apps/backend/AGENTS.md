# Backend guidance

Read [backend documentation](../../docs/backend/README.md) before changing
endpoints, schema export, server configuration, or Go tooling.

- Register typed endpoints through Huma in `internal/api`; Gin supplies routing.
- Keep HTTP serving and offline schema export on the same registration path.
- Treat operation IDs and JSON/query tags as public contract names. Changing them can change generated frontend APIs.
- Add or update endpoint tests for changed behavior, including affected validation and error responses.
- Follow the root contract workflow when endpoint types or metadata change.
- Restart the Go development process after code changes; it does not hot reload.

Run from the repository root after Go changes:

```sh
pnpm exec nx run-many -t lint,format:check,test,build --projects=backend
```

Use `pnpm exec nx run backend:format` to apply gofmt. After editing `.golangci.yml`,
also run `pnpm exec nx run backend:lint:config`.
