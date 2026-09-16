# API client guidance

Read [contract generation](../../docs/common/README.md#contract-generation)
before changing the generator or package exports.

- `src/generated/` is generated output. Change Go endpoint definitions or root `openapi-ts.config.ts`, then run `pnpm generate`; never hand-edit generated files.
- Keep this instruction file and other maintained files outside `src/generated/`.
- Preserve the package exports consumed by frontend code: `@demo/api-client` and `@demo/api-client/query`.
- Include changed generated files with their source changes. Review deletions as well as additions.
- Generation verifies consistency; it does not prove compatibility with existing consumers or deployed services.

After changing generation or exports, run `pnpm generate`, `pnpm typecheck`, and
`pnpm exec nx run web:build` from the repository root. Read the frontend
instructions before changing consumers to accommodate a contract change.
