# Repository guidance

## Scope and references

Read [README.md](README.md) for setup and the workspace map. Before editing a
project, read its scoped instructions, even when starting from the repository root:

| Work                           | Instructions                                                   |
| ------------------------------ | -------------------------------------------------------------- |
| Next.js frontend               | [apps/web/AGENTS.md](apps/web/AGENTS.md)                       |
| Go backend                     | [apps/backend/AGENTS.md](apps/backend/AGENTS.md)               |
| Generated API client           | [packages/api-client/AGENTS.md](packages/api-client/AGENTS.md) |
| CI scripts or GitHub workflows | [tools/ci/AGENTS.md](tools/ci/AGENTS.md)                       |

Apply this file across the repository and scoped files within their directories.
For work spanning projects, read each affected project's instructions. Read
[docs/common/README.md](docs/common/README.md) before changing Nx dependencies,
Git hooks, branch workflows, or CI behavior.

## Shared workflow

- Use pnpm for JavaScript dependencies and Nx tasks; Go dependencies live in the backend module.
- Run workspace commands from the repository root. Read `package.json` and the affected `project.json` for current tasks.
- Target feature PRs at `dev`; `main` receives production promotions through release PRs.
- Commit and push only when the user requests them or authorizes a task that requires them, such as opening a PR.
- Verify documentation claims against code and configuration; update guidance when behavior changes.

## API contract

Go types and Huma operations define the API contract. After changing an endpoint's
request or response contract, run `pnpm generate` and `pnpm typecheck`. Include the
Go change, generated OpenAPI, generated client, and any required consumer updates
in the same PR. Resolve frontend type errors by updating the consumer or contract,
not by casting away the generated types.

## Verification

Run the affected project's checks described in its scoped instructions. Use
`pnpm check` for changes spanning projects or shared build/dependency configuration.
For instruction-only edits, verify referenced paths, commands, and Claude imports;
application builds are unnecessary. State which checks ran and which were skipped.

## Maintaining agent context

Keep shared rules here and project rules beside the project. Each `CLAUDE.md`
contains only `@AGENTS.md`, importing its sibling as the single source of guidance.
Keep detailed explanations in `docs/frontend`, `docs/backend`, or `docs/common`,
and link them with a clear condition for reading. Preserve generated instruction
blocks. Keep credentials, personal machine paths, and session transcripts out of
tracked context files.
