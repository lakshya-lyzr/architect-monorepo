# Frontend

The frontend lives in `apps/web`. Its Nx project name is `web`.
It uses the Next.js App Router, React, and TanStack Query.

## API requests

[`app/providers.tsx`](../../apps/web/app/providers.tsx) supplies the QueryClient.
[`app/page.tsx`](../../apps/web/app/page.tsx) calls the backend with generated options:

```tsx
const greeting = useQuery(getGreetingOptions({ query: { name: submittedName } }));
```

Import query options from `@demo/api-client/query`. Import generated response
types or SDK functions from `@demo/api-client` when needed. The greeting response
includes `message: string`, `name: string`, and `language: 'go'`.

The Go endpoint defines these types. Run `pnpm generate` after changing the
contract; do not edit `packages/api-client/src/generated` by hand.
[`type-safety.ts`](../../apps/web/type-safety.ts) contains compile-only examples
that verify invalid inputs and response fields produce TypeScript errors.

## Backend connection

[`next.config.ts`](../../apps/web/next.config.ts) proxies `/api/*` and `/schemas/*`
to `API_URL`, which defaults to `http://127.0.0.1:8080`. Browser requests use the
frontend origin, so the demo does not require browser CORS configuration.

Set `API_URL` in the environment when starting development or building for another
backend address. Do not include a trailing slash. This server-side setting is
not a `NEXT_PUBLIC_*` variable. Production builds capture the rewrite destination
at build time; rebuild when that destination changes.

## Checks

Run from the repository root:

```sh
pnpm exec nx run web:lint
pnpm exec nx run web:format
pnpm exec nx run web:format:check
pnpm exec nx run web:typecheck
pnpm exec nx run web:build
```

Oxlint checks correctness, React Hooks, Next.js, and enabled accessibility rules.
Warnings fail the lint task. Oxfmt formats frontend files. Their configuration
files are `.oxlintrc.json` and `.oxfmtrc.json` inside `apps/web`.

The current project has backend tests and TypeScript contract checks, but no
frontend unit-test or browser-test suite configured.
