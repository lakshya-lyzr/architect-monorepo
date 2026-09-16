<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Frontend project guidance

Read [frontend documentation](../../docs/frontend/README.md) before changing
queries, proxy configuration, or frontend tooling.

- Use generated TanStack Query options from `@demo/api-client/query` for backend calls.
- Use inferred or generated contract types; keep request and response definitions in the Go source.
- Route browser backend requests through the existing same-origin proxy. `API_URL` is a server-side setting captured by production builds.
- Preserve the generated Next.js instruction block above; put maintained guidance outside its markers.

Run from the repository root after frontend code changes:

```sh
pnpm exec nx run-many -t lint,format:check,typecheck,build --projects=web --parallel=1
```

Use `pnpm exec nx run web:format` to apply Oxfmt. Type checking and builds include
contract generation through Nx dependencies. For UI behavior changes, also check
the affected flow in the browser; this project has no frontend test suite yet.
