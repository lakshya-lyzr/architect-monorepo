# CI automation guidance

Read [CI behavior](../../docs/common/README.md#continuous-integration) before
changing project selection or checks. Read [release automation](../../docs/common/README.md#automatic-release-pr)
before changing release PR creation, counting, or permissions. These rules also
apply to `.github/workflows/` through the root instructions.

- Keep `Workspace checks` reporting for every supported CI event, including documentation-only changes.
- Select full checks when comparison history or API results are unreliable. Preserve coverage of failed or cancelled pushes.
- Verify generated files before deciding whether a backend contract change requires frontend checks.
- Keep frontend-only checks independent of Go setup and generation.
- Keep release PR updates idempotent and based on current branch history; cover prior releases and concurrent updates.
- Treat PR titles and other GitHub payload text as data. Execute trusted code only when using write-capable tokens.
- Add regression cases to the existing Node tests when changing selection or release behavior.

Run `pnpm test:ci` from the repository root after script changes. After workflow
edits, also validate both workflows:

```sh
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/ci.yml .github/workflows/release-pr.yml
```

Update the README change/checks table and common workflow guide whenever selection
or trigger behavior changes.
